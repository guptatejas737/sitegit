import "./style.css";

// One public capture; all three phases are illustrative vertical reveals, not dated scans.
const phases = [
  {
    title: "Lower floors",
    note: "The first visible layers of the site record.",
    marker: "01 / Lower floors",
    cutoff: -0.1,
    anchor: [0.18, -0.23, -0.12],
  },
  {
    title: "Upper floors",
    note: "New layers appear in the same 3D position.",
    marker: "02 / Upper floors",
    cutoff: 0.19,
    anchor: [0.17, 0.08, -0.13],
  },
  {
    title: "Roof & facade",
    note: "Scrub back to revisit an earlier layer.",
    marker: "03 / Roof & facade",
    cutoff: 0.58,
    anchor: [0.16, 0.31, -0.12],
  },
];
const $ = (id) => document.getElementById(id);
const viewer = $("viewer"),
  canvas = $("scene"),
  slider = $("timeline");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const query = new URLSearchParams(location.search);
if (query.has("capture")) document.body.classList.add("capture-mode");
let phaseValue = query.has("phase")
  ? Math.min(2, Math.max(0, Number(query.get("phase")) || 0))
  : 2;
let phaseIndex = Math.round(phaseValue),
  playing = false,
  lastTime = 0,
  clock = 0;
let app,
  camera,
  pc,
  sceneMaterial,
  failed = false,
  loaded = false,
  viewDirty = true;
let targetCutoff = phases[phaseIndex].cutoff,
  currentCutoff = targetCutoff;
let orbit = { yaw: 2.5, pitch: 0.28, distance: 2.35 };
let desiredOrbit = { ...orbit };
const pointers = new Map();
let pinchDistance = 0;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const initialStill = "./data/building/source-preview.webp";

function stop() {
  playing = false;
  $("play").setAttribute("aria-pressed", "false");
  $("play").setAttribute("aria-label", "Play timeline");
  $("play-label").textContent = "Play";
  $("play-icon").innerHTML = '<path d="M6 3.8 16 10 6 16.2Z"/>';
}

function setPhase(value, manual = false) {
  if (manual) stop();
  phaseValue = clamp(Number(value), 0, 2);
  phaseIndex = Math.round(phaseValue);
  const p = phases[phaseIndex],
    lower = Math.floor(phaseValue),
    upper = Math.min(2, lower + 1);
  targetCutoff =
    phases[lower].cutoff +
    (phases[upper].cutoff - phases[lower].cutoff) * (phaseValue - lower);
  slider.value = phaseValue;
  slider.setAttribute(
    "aria-valuetext",
    `Week 0${phaseIndex + 1}: ${p.title}, illustrative`,
  );
  $("phase-title").textContent = p.title;
  $("phase-count").textContent = `0${phaseIndex + 1} / 03`;
  $("change-text").textContent = p.note;
  $("annotation-text").textContent = p.marker;
  $("rail-fill").style.width = `${phaseValue * 50}%`;
  document.querySelectorAll(".phase-stop[data-phase]").forEach((button, i) => {
    button.classList.toggle("active", i === phaseIndex);
    if (i === phaseIndex) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  viewer.dataset.phase = phaseIndex;
  viewDirty = true;
  if (failed) setStill();
  if (app) app.renderNextFrame = true;
}

function setStill() {
  const still = $("still");
  still.onerror = () => {
    still.onerror = null;
    still.src = initialStill;
  };
  still.src = `./data/stills/phase-${phaseIndex + 1}.webp`;
  still.alt = `Illustrative phase ${phaseIndex + 1}: ${phases[phaseIndex].title}; a vertical reveal of the same public building splat`;
}

function fallback(reason) {
  if (failed) return;
  failed = true;
  stop();
  clearTimeout(loadTimeout);
  console.info("Sitegit still-image fallback:", reason);
  viewer.classList.remove("ready");
  viewer.classList.add("fallback");
  viewer.dataset.renderMode = "stills";
  $("loading").hidden = true;
  $("fallback-note").hidden = false;
  $("render-label").textContent = "STILL SEQUENCE";
  $("reset").disabled = true;
  setStill();
  if (app) app.autoRender = false;
}

slider.addEventListener("input", () => setPhase(slider.value, true));
// Native range controls retain keyboard semantics; one key moves a complete commit.
slider.addEventListener("keydown", (e) => {
  const movements = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
  if (e.key in movements) {
    e.preventDefault();
    setPhase(Math.round(phaseValue) + movements[e.key], true);
  }
  if (e.key === "Home" || e.key === "End") {
    e.preventDefault();
    setPhase(e.key === "Home" ? 0 : 2, true);
  }
});
document
  .querySelectorAll(".phase-stop[data-phase]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      setPhase(button.dataset.phase, true),
    ),
  );
$("play").addEventListener("click", () => {
  if (playing) return stop();
  if (phaseValue >= 1.98) setPhase(0);
  clock = phaseValue * 3;
  playing = true;
  $("play").setAttribute("aria-pressed", "true");
  $("play").setAttribute("aria-label", "Pause timeline");
  $("play-label").textContent = "Pause";
  $("play-icon").innerHTML = '<path d="M5 4h3v12H5zm7 0h3v12h-3z"/>';
});
$("reset").addEventListener("click", () => {
  desiredOrbit = { yaw: 2.5, pitch: 0.28, distance: 2.35 };
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
  }
});
canvas.addEventListener("pointermove", (e) => {
  const old = pointers.get(e.pointerId);
  if (!old) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    desiredOrbit.yaw -= (e.clientX - old.x) * 0.008;
    desiredOrbit.pitch = clamp(
      desiredOrbit.pitch + (e.clientY - old.y) * 0.006,
      -0.15,
      1.2,
    );
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()],
      distance = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDistance > 0 && distance > 0)
      desiredOrbit.distance = clamp(
        (desiredOrbit.distance * pinchDistance) / distance,
        0.7,
        3.3,
      );
    pinchDistance = distance;
  }
});
function release(e) {
  pointers.delete(e.pointerId);
  pinchDistance = 0;
}
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);
canvas.addEventListener("lostpointercapture", release);
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    desiredOrbit.distance = clamp(
      desiredOrbit.distance * Math.exp(clamp(e.deltaY, -120, 120) * 0.0015),
      0.7,
      3.3,
    );
  },
  { passive: false },
);
canvas.addEventListener("keydown", (e) => {
  if (
    ![
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "+",
      "=",
      "-",
    ].includes(e.key)
  )
    return;
  e.preventDefault();
  if (e.key === "ArrowLeft") desiredOrbit.yaw -= 0.12;
  if (e.key === "ArrowRight") desiredOrbit.yaw += 0.12;
  if (e.key === "ArrowUp")
    desiredOrbit.pitch = clamp(desiredOrbit.pitch + 0.08, -0.15, 1.2);
  if (e.key === "ArrowDown")
    desiredOrbit.pitch = clamp(desiredOrbit.pitch - 0.08, -0.15, 1.2);
  if (e.key === "+" || e.key === "=")
    desiredOrbit.distance = clamp(desiredOrbit.distance * 0.9, 0.7, 3.3);
  if (e.key === "-")
    desiredOrbit.distance = clamp(desiredOrbit.distance * 1.1, 0.7, 3.3);
});
canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  fallback("WebGL context lost");
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});
const touchScreen = matchMedia("(pointer: coarse), (max-width: 540px)");
const updateHint = () => {
  $("view-help").textContent = touchScreen.matches
    ? "DRAG TO ORBIT / PINCH TO ZOOM"
    : "DRAG TO ORBIT / SCROLL TO ZOOM";
};
touchScreen.addEventListener("change", updateHint);
updateHint();
setPhase(phaseValue);
const loadTimeout = setTimeout(() => fallback("3D loading timed out"), 25000);

function update(t) {
  const dt = Math.min((t - lastTime) / 1000, 0.1);
  lastTime = t;
  if (playing && !document.hidden) {
    clock += dt;
    setPhase(
      reducedMotion
        ? Math.min(2, Math.floor(clock / 2))
        : Math.min(2, clock / 3),
    );
    if (phaseValue >= 2) stop();
  }
  if (loaded && !failed) {
    let moving = false;
    for (const key of ["yaw", "pitch", "distance"]) {
      const delta = desiredOrbit[key] - orbit[key];
      if (Math.abs(delta) > 0.00001) {
        moving = true;
        orbit[key] += delta * (reducedMotion ? 1 : Math.min(1, dt * 14));
      }
    }
    if (Math.abs(currentCutoff - targetCutoff) > 0.00001) {
      moving = true;
      currentCutoff +=
        (targetCutoff - currentCutoff) *
        (reducedMotion ? 1 : Math.min(1, dt * 16));
      sceneMaterial.setParameter("uReveal", currentCutoff);
      sceneMaterial.update();
    }
    if (moving || viewDirty) {
      const aspect = Math.max(0.5, viewer.clientWidth / viewer.clientHeight);
      const radius = orbit.distance * (aspect < 0.9 ? 1.08 : 1);
      camera.setPosition(
        Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * radius,
        Math.sin(orbit.pitch) * radius,
        Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * radius,
      );
      camera.lookAt(0, -0.015, 0);
      canvas.dataset.camera = [orbit.yaw, orbit.pitch, orbit.distance]
        .map((x) => x.toFixed(3))
        .join(",");
      app.renderNextFrame = true;
      viewDirty = false;
    }
    // PlayCanvas updates its projection dimensions during rendering, after ResizeObserver.
    // Reproject the small overlay each frame so a viewport change cannot leave it stale.
    const a = phases[phaseIndex].anchor;
    const screen = camera.camera.worldToScreen(new pc.Vec3(...a));
    $("annotation").style.left =
      `${clamp(screen.x, 35, viewer.clientWidth - (viewer.clientWidth < 540 ? 160 : 205))}px`;
    $("annotation").style.top =
      `${clamp(screen.y, 65, viewer.clientHeight - 75)}px`;
  }
  requestAnimationFrame(update);
}
requestAnimationFrame(update);

async function start() {
  if (query.has("fallback")) return fallback("Fallback preview requested");
  const probe = document.createElement("canvas");
  const gl = probe.getContext("webgl2");
  if (!gl) return fallback("WebGL 2 unavailable");
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  pc = await import("playcanvas");
  if (failed) return;
  app = new pc.Application(canvas, {
    graphicsDeviceOptions: {
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: query.has("capture"),
    },
  });
  app.graphicsDevice.maxPixelRatio = Math.min(
    devicePixelRatio,
    viewer.clientWidth < 600 ? 1.5 : 2,
  );
  app.setCanvasFillMode(
    pc.FILLMODE_NONE,
    viewer.clientWidth,
    viewer.clientHeight,
  );
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.autoRender = true;
  app.scene.toneMapping = pc.TONEMAP_LINEAR;
  camera = new pc.Entity("Camera");
  camera.addComponent("camera", {
    clearColor: new pc.Color(24 / 255, 27 / 255, 25 / 255),
    fov: 44,
    nearClip: 0.03,
    farClip: 20,
  });
  app.root.addChild(camera);
  const asset = new pc.Asset("Construction building", "gsplat", {
    url: "./data/building/meta.json",
  });
  app.assets.add(asset);
  await new Promise((resolve, reject) => {
    asset.ready(resolve);
    asset.once("error", reject);
    app.assets.load(asset);
  });
  if (failed) {
    asset.unload();
    app.destroy();
    app = null;
    return;
  }
  const building = new pc.Entity("Building — one public capture");
  building.setEulerAngles(0, 0, 180);
  building.addComponent("gsplat", { asset });
  app.root.addChild(building);
  sceneMaterial = app.scene.gsplat.material;
  // This is a presentation mask only. No generated geometry, invented scans, or change-detection claim.
  sceneMaterial.getShaderChunks("glsl").set(
    "gsplatModifyVS",
    `
    uniform float uReveal;
    void modifySplatCenter(inout vec3 center) {}
    void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {}
    void modifySplatColor(vec3 center, inout vec4 color) {
      float height = center.y;
      float visibility = 1.0 - smoothstep(uReveal - 0.008, uReveal + 0.008, height);
      color.a *= visibility;
    }
  `,
  );
  sceneMaterial.setParameter("uReveal", currentCutoff);
  sceneMaterial.update();
  const resize = () => {
    if (!app || failed) return;
    app.resizeCanvas(viewer.clientWidth, viewer.clientHeight);
    viewDirty = true;
    app.renderNextFrame = true;
  };
  new ResizeObserver(resize).observe(viewer);
  resize();
  loaded = true;
  app.start();
  app.renderNextFrame = true;
  clearTimeout(loadTimeout);
  viewer.classList.add("ready");
  viewer.dataset.renderMode = "gaussian-splat";
  $("loading").hidden = true;
  $("render-label").textContent = "GAUSSIAN SPLAT";
  // Authoring-only image export makes fallback stills from the actual GPU-rendered scene.
  if (query.has("capture")) {
    const exportButton = document.createElement("button");
    exportButton.id = "export-still";
    exportButton.textContent = "Export phase still";
    exportButton.style.cssText =
      "position:fixed;top:0;right:0;z-index:20;background:#121413;color:white;padding:10px";
    document.body.append(exportButton);
    exportButton.onclick = () =>
      canvas.toBlob(
        (blob) => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `phase-${phaseIndex + 1}.webp`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        },
        "image/webp",
        0.88,
      );
  }
}
start().catch((error) => fallback(error.message || String(error)));
