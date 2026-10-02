import "./survey.css";

const $ = (id) => document.getElementById(id);
const viewer = $("viewer"),
  query = new URLSearchParams(location.search);
const dates = ["27 Sep 2024", "18 Oct 2024", "27 Nov 2024"];
let manifest,
  selected = 2,
  requested = 2,
  serial = 0,
  comparing = false,
  wipe = 0.5;
let renderer,
  camera,
  controls,
  THREE,
  SparkRenderer,
  SplatMesh,
  currentPoints,
  previousPoints;
let fallback = query.has("fallback"),
  dirty = true,
  rendering = false;
const cache = new Map();
let needsSplatUpdate = true,
  renderedFrames = 0;
function invalidateView() {
  dirty = true;
  needsSplatUpdate = true;
}

function setRecordUI(index) {
  selected = index;
  const record = manifest.records[index];
  $("capture-date").textContent = record.label;
  $("current-title").textContent = record.label;
  $("image-count").textContent = record.imageCount;
  $("record-hash").textContent = record.sha256.slice(0, 8);
  $("record-note").textContent = record.note;
  $("point-count").textContent =
    `${record.pointCount.toLocaleString()} GAUSSIANS`;
  $("survey-caption").textContent = `SURVEY 0${index + 1}`;
  $("timeline").value = index;
  $("timeline").setAttribute("aria-valuetext", record.label);
  $("still").src = record.still;
  $("mobile-still").srcset = record.stillMobile || record.still;
  $("still").alt = `Construction site recorded ${record.label}`;
  document
    .querySelectorAll("[data-record]")
    .forEach((b) =>
      b.setAttribute("aria-current", String(+b.dataset.record === index)),
    );
  document
    .querySelectorAll("[data-date]")
    .forEach((b) => b.classList.toggle("active", +b.dataset.date === index));
  $("compare").disabled = index === 0 || fallback || !previousPoints;
  viewer.dataset.record = record.date;
  viewer.dataset.asset = record.url;
  if (index === 0) setCompare(false);
}

function showFallback(reason) {
  fallback = true;
  renderer?.dispose();
  $("loading").hidden = true;
  $("fallback-note").hidden = false;
  $("view-type").textContent = "Survey image";
  viewer.classList.remove("ready");
  viewer.classList.add("fallback");
  viewer.dataset.renderMode = "still";
  $("compare").disabled = true;
  $("reset").disabled = true;
  setCompare(false);
  if (manifest) setRecordUI(requested);
  console.info("Still fallback:", reason);
}

async function loadRecord(index) {
  if (cache.has(index)) return cache.get(index);
  const job = (async () => {
    const mesh = new SplatMesh({
      url: manifest.records[index].url,
      lod: false,
    });
    await mesh.initialized;
    const scene = new THREE.Scene();
    const spark = new SparkRenderer({
      renderer,
      autoUpdate: false,
      enableLod: false,
      onDirty: () => (dirty = true),
      minSortIntervalMs: 40,
    });
    scene.add(spark, mesh);
    return { scene, spark, mesh };
  })();
  cache.set(index, job);
  try {
    return await job;
  } catch (e) {
    cache.delete(index);
    throw e;
  }
}

async function selectRecord(index) {
  if (!manifest) return;
  requested = Math.max(
    0,
    Math.min(manifest.records.length - 1, Math.round(index)),
  );
  const token = ++serial,
    targetIndex = requested;
  if (fallback) {
    setRecordUI(targetIndex);
    return;
  }
  $("loading-label").textContent = `Opening ${dates[targetIndex]} survey`;
  $("loading").hidden = false;
  try {
    const target = await loadRecord(targetIndex);
    if (token !== serial || fallback) return;
    currentPoints = target;
    previousPoints = null;
    setCompare(false);
    setRecordUI(targetIndex);
    $("loading").hidden = true;
    invalidateView();
    if (targetIndex > 0)
      loadRecord(targetIndex - 1)
        .then((previous) => {
          if (token !== serial || fallback) return;
          previousPoints = previous;
          $("compare").disabled = false;
          dirty = true;
        })
        .catch(() => {
          $("compare").title = "Previous survey unavailable";
        });
  } catch (e) {
    if (token === serial) showFallback(e.message);
  }
}

function setCompare(enabled) {
  comparing = Boolean(enabled && selected > 0 && !fallback);
  $("compare").setAttribute("aria-pressed", String(comparing));
  $("comparison").hidden = !comparing;
  viewer.classList.toggle("is-comparing", comparing);
  if (comparing) {
    $("previous-label").textContent = dates[selected - 1];
    $("selected-label").textContent = dates[selected];
  }
  invalidateView();
}
function setWipe(value) {
  wipe = Math.max(0.08, Math.min(0.92, value));
  $("wipe-line").style.left = `${wipe * 100}%`;
  dirty = true;
}
$("wipe-handle").addEventListener("pointerdown", (e) => {
  e.stopPropagation();
  e.currentTarget.setPointerCapture(e.pointerId);
});
$("wipe-handle").addEventListener("pointermove", (e) => {
  if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
  const r = viewer.getBoundingClientRect();
  setWipe((e.clientX - r.left) / r.width);
});
$("wipe-handle").addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    e.preventDefault();
    setWipe(wipe + (e.key === "ArrowLeft" ? -0.04 : 0.04));
  }
});
$("compare").addEventListener("click", () => setCompare(!comparing));
document
  .querySelectorAll("[data-record]")
  .forEach((b) =>
    b.addEventListener("click", () => selectRecord(+b.dataset.record)),
  );
document
  .querySelectorAll("[data-date]")
  .forEach((b) =>
    b.addEventListener("click", () => selectRecord(+b.dataset.date)),
  );
$("timeline").addEventListener("input", (e) => selectRecord(+e.target.value));
function resetCamera() {
  if (!controls) return;
  camera.position.fromArray(
    viewer.clientWidth / viewer.clientHeight < 0.9
      ? manifest.camera.mobilePosition
      : manifest.camera.position,
  );
  controls.target.fromArray(manifest.camera.target);
  controls.update();
  dirty = true;
}
$("reset").addEventListener("click", resetCamera);
$("scene").addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  showFallback("WebGL context lost");
});
const small = matchMedia("(pointer: coarse), (max-width:640px)");
const hint = () =>
  ($("view-help").textContent = small.matches
    ? "Drag to orbit · Pinch to zoom"
    : "Drag to orbit · Scroll to zoom");
small.addEventListener("change", hint);
hint();

async function draw() {
  requestAnimationFrame(draw);
  if (fallback || !renderer || !currentPoints || document.hidden) return;
  controls.update();
  if (!dirty || rendering) return;
  rendering = true;
  dirty = false;
  try {
    camera.updateMatrixWorld();
    // Sort and regenerate only when the view or selected record changes.
    // Spark's onDirty also requests a final draw after its worker finishes;
    // that draw must not launch another forced update and keep the GPU busy.
    if (needsSplatUpdate) {
      needsSplatUpdate = false;
      await currentPoints.spark.update({ scene: currentPoints.scene, camera });
      if (comparing && previousPoints)
        await previousPoints.spark.update({
          scene: previousPoints.scene,
          camera,
        });
    }
    if (fallback) return;
    const width = viewer.clientWidth,
      height = viewer.clientHeight;
    renderer.setScissorTest(false);
    renderer.clear();
    if (comparing && previousPoints) {
      renderer.setScissorTest(true);
      const split = Math.round(width * wipe);
      renderer.setScissor(0, 0, split, height);
      renderer.render(previousPoints.scene, camera);
      renderer.setScissor(split, 0, width - split, height);
      renderer.render(currentPoints.scene, camera);
      renderer.setScissorTest(false);
    } else {
      renderer.render(currentPoints.scene, camera);
    }
    $("scene").dataset.camera = camera.position
      .toArray()
      .map((x) => x.toFixed(2))
      .join(",");
    $("scene").dataset.frames = String(++renderedFrames);
    viewer.classList.add("ready");
    viewer.dataset.renderMode = "gaussian-splatting";
  } catch (e) {
    showFallback(e.message);
  } finally {
    rendering = false;
  }
}

async function start() {
  const response = await fetch("./data/surveys/manifest.json");
  if (!response.ok) throw new Error("Survey manifest unavailable");
  manifest = await response.json();
  const startRecord = Number(query.get("record") ?? 2);
  requested =
    Number.isInteger(startRecord) && startRecord >= 0 && startRecord <= 2
      ? startRecord
      : 2;
  setRecordUI(requested);
  if (fallback) return showFallback("Requested");
  THREE = await import("three");
  ({ SparkRenderer, SplatMesh } = await import("@sparkjsdev/spark"));
  const { OrbitControls } = await import(
    "three/addons/controls/OrbitControls.js"
  );
  if (fallback) return;
  renderer = new THREE.WebGLRenderer({
    canvas: $("scene"),
    antialias: false,
    preserveDrawingBuffer: query.has("capture"),
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.setClearColor("#e9e9e3");
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  camera = new THREE.PerspectiveCamera(43, 1, 0.1, 3000);
  camera.position.fromArray(manifest.camera.position);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.fromArray(manifest.camera.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 20;
  controls.maxDistance = 700;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.addEventListener("change", invalidateView);
  controls.update();
  const resize = () => {
    if (fallback) return;
    const w = viewer.clientWidth,
      h = viewer.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    invalidateView();
  };
  new ResizeObserver(resize).observe(viewer);
  resize();
  resetCamera();
  $("scene").addEventListener("keydown", (e) => {
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "+",
        "-",
        "=",
      ].includes(e.key)
    )
      return;
    e.preventDefault();
    const offset = camera.position.clone().sub(controls.target),
      spherical = new THREE.Spherical().setFromVector3(offset);
    if (e.key === "ArrowLeft") spherical.theta -= 0.1;
    if (e.key === "ArrowRight") spherical.theta += 0.1;
    if (e.key === "ArrowUp") spherical.phi = Math.max(0.1, spherical.phi - 0.1);
    if (e.key === "ArrowDown")
      spherical.phi = Math.min(1.5, spherical.phi + 0.1);
    if (e.key === "+" || e.key === "=") spherical.radius *= 0.9;
    if (e.key === "-") spherical.radius *= 1.1;
    camera.position
      .copy(controls.target)
      .add(new THREE.Vector3().setFromSpherical(spherical));
    controls.update();
    dirty = true;
  });
  draw();
  await selectRecord(requested);
  if (fallback) return;
  loadRecord(0).catch(() => {});
  if (query.has("capture")) {
    const button = document.createElement("button");
    button.textContent = "Save survey still";
    button.id = "save-still";
    button.style.cssText =
      "position:fixed;right:0;top:0;z-index:50;background:white;padding:10px";
    button.onclick = () => {
      const filename = `${manifest.records[selected].date}${viewer.clientWidth / viewer.clientHeight < 0.9 ? "-mobile" : ""}.webp`;
      button.disabled = true;
      button.textContent = "Saving survey still";
      dirty = true;
      requestAnimationFrame(() =>
        $("scene").toBlob(
          async (blob) => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            if (import.meta.env.DEV) {
              button.disabled = true;
              try {
                const response = await fetch(`/__save-still/${a.download}`, {
                  method: "POST",
                  body: blob,
                  headers: { "Content-Type": "image/webp" },
                });
                if (!response.ok) throw new Error(await response.text());
                button.textContent = await response.text();
              } catch (error) {
                button.textContent = `Export failed: ${error.message}`;
              }
              button.disabled = false;
            } else {
              a.click();
              button.disabled = false;
              button.textContent = "Save survey still";
            }
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          },
          "image/webp",
          0.9,
        ),
      );
    };
    document.body.append(button);
  }
}
const timeout = setTimeout(() => showFallback("Loading timeout"), 45000);
start()
  .catch((e) => showFallback(e.message))
  .finally(() => clearTimeout(timeout));
