/**
 * Embedded, demand-rendered survey history. Assets and camera come exclusively
 * from the verified survey manifest. A splat intersection is a derived visual
 * anchor, never a surveyed coordinate or an independently validated measurement.
 */
export async function createHistoryViewer({
  canvas,
  container,
  manifest,
  onState = () => {},
  onPick = () => {},
  forceFallback = false,
  lowPower = false,
}) {
  if (!canvas || !container || !manifest?.records?.length) {
    throw new Error(
      "A canvas, viewer container and survey manifest are required.",
    );
  }

  const records = new Map(
    manifest.records.map((record) => [record.date, record]),
  );
  const cache = new Map();
  const listeners = [];
  const captures = [];
  let THREE, SparkRenderer, SplatMesh, renderer, camera, controls, observer;
  let current,
    previous,
    date = manifest.records.at(-1).date,
    beforeDate = null;
  let disposed = false,
    hardFallback = forceFallback,
    fallback = forceFallback;
  let dirty = false,
    sortDirty = true,
    rendering = false,
    raf = 0,
    serial = 0;
  let frameCount = 0,
    wipe = 0.5,
    picking = false,
    anchor = null;
  let pointerStart = null,
    resourcesReleased = false,
    captureRequested = false,
    pendingReady = null;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const validVector = (value) =>
    Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
  const notify = (state) => {
    if (!disposed) onState({ date, ...state });
  };
  const addListener = (target, name, handler, options) => {
    target.addEventListener(name, handler, options);
    listeners.push(() => target.removeEventListener(name, handler, options));
  };
  const marker = document.createElement("span");
  marker.className = "history-anchor";
  marker.setAttribute("aria-hidden", "true");
  marker.hidden = true;
  marker.style.cssText =
    "position:absolute;z-index:4;width:17px;height:17px;border:3px solid #ff5a1f;border-radius:50%;background:#fafaf8;box-shadow:0 0 0 3px #1c211b88;transform:translate(-50%,-50%);pointer-events:none";
  container.append(marker);

  function getCamera() {
    return {
      position: camera
        ? camera.position.toArray()
        : [...manifest.camera.position],
      target: controls
        ? controls.target.toArray()
        : [...manifest.camera.target],
    };
  }

  function reflect() {
    canvas.dataset.date = date;
    canvas.dataset.beforeDate = beforeDate || "";
    canvas.dataset.renderMode = fallback
      ? "still"
      : current
        ? "gaussian-splatting"
        : "loading";
    canvas.dataset.frameCount = String(frameCount);
    canvas.dataset.frames = String(frameCount);
    canvas.dataset.camera = JSON.stringify(getCamera());
  }

  function invalidate(needsSort = true) {
    if (disposed || fallback) return;
    dirty = true;
    sortDirty ||= needsSort;
    if (!raf && !rendering && !document.hidden)
      raf = requestAnimationFrame(draw);
  }

  function destroyRecord(resource) {
    if (!resource || resource.disposed) return;
    resource.disposed = true;
    resource.scene.clear();
    resource.spark.dispose();
    resource.mesh.dispose();
  }

  function releaseResources() {
    if (resourcesReleased || rendering) return;
    resourcesReleased = true;
    for (const entry of cache.values()) destroyRecord(entry.resource);
    cache.clear();
    renderer?.dispose();
  }

  function showFallback(message, permanent = false) {
    fallback = true;
    hardFallback ||= permanent;
    dirty = false;
    pendingReady = null;
    cancelAnimationFrame(raf);
    raf = 0;
    marker.hidden = true;
    if (controls) controls.enabled = false;
    reflect();
    notify({ status: "fallback", message });
    while (captures.length) captures.shift().reject(new Error(message));
  }

  function trimCache() {
    while (cache.size > 3) {
      const candidate = [...cache].find(
        ([key]) => key !== date && key !== beforeDate,
      );
      if (!candidate) break;
      const [key, entry] = candidate;
      entry.evicted = true;
      cache.delete(key);
      if (rendering)
        entry.promise
          .finally(() =>
            requestAnimationFrame(() => destroyRecord(entry.resource)),
          )
          .catch(() => {});
      else destroyRecord(entry.resource);
    }
  }

  async function loadRecord(recordDate) {
    if (cache.has(recordDate)) {
      const entry = cache.get(recordDate);
      cache.delete(recordDate);
      cache.set(recordDate, entry);
      return entry.promise;
    }
    const record = records.get(recordDate);
    const entry = { resource: null, evicted: false, promise: null };
    entry.promise = (async () => {
      const mesh = new SplatMesh({
        url: record.url,
        lod: false,
        raycastable: true,
        minRaycastOpacity: 0.25,
        onProgress: (event) => {
          if (disposed || fallback || ![date, beforeDate].includes(recordDate))
            return;
          const total = event.total || record.bytes;
          notify({
            status: "loading",
            date: recordDate,
            message: `Opening ${record.label} survey`,
            ...(total ? { progress: clamp(event.loaded / total, 0, 1) } : {}),
          });
        },
      });
      let timeout,
        timedOut = false;
      try {
        await Promise.race([
          mesh.initialized,
          new Promise((_, reject) => {
            timeout = setTimeout(() => {
              timedOut = true;
              reject(
                new Error(
                  `The ${record.label} survey did not finish loading. The dated still remains available.`,
                ),
              );
            }, 45000);
          }),
        ]);
        if (disposed || entry.evicted)
          throw new Error("Survey request was superseded.");
        const scene = new THREE.Scene();
        const spark = new SparkRenderer({
          renderer,
          autoUpdate: false,
          enableLod: false,
          minSortIntervalMs: lowPower ? 70 : 40,
          onDirty: () => invalidate(false),
        });
        scene.add(spark, mesh);
        entry.resource = {
          scene,
          spark,
          mesh,
          date: recordDate,
          disposed: false,
        };
        return entry.resource;
      } catch (error) {
        if (timedOut)
          mesh.initialized.then(
            () => mesh.dispose(),
            () => mesh.dispose(),
          );
        else if (!entry.resource) mesh.dispose();
        if (cache.get(recordDate) === entry) cache.delete(recordDate);
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    })();
    cache.set(recordDate, entry);
    trimCache();
    return entry.promise;
  }

  async function select(nextDate, nextBeforeDate = null) {
    if (disposed) return false;
    if (
      !records.has(nextDate) ||
      (nextBeforeDate && !records.has(nextBeforeDate))
    ) {
      notify({
        status: "error",
        message: "This date does not have a verified 3D survey.",
      });
      return false;
    }
    date = nextDate;
    beforeDate =
      nextBeforeDate && nextBeforeDate !== date ? nextBeforeDate : null;
    const token = ++serial;
    marker.hidden = true;
    reflect();
    if (hardFallback || !renderer) {
      showFallback(
        forceFallback
          ? "Still-image mode requested. Orbiting requires WebGL."
          : "3D is unavailable in this browser. Showing the actual dated survey still.",
      );
      return false;
    }
    fallback = false;
    controls.enabled = !picking;
    notify({
      status: "loading",
      message: `Opening ${records.get(date).label} survey`,
      progress: 0,
    });
    try {
      const [target, before] = await Promise.all([
        loadRecord(date),
        beforeDate ? loadRecord(beforeDate) : null,
      ]);
      if (disposed || token !== serial) return false;
      current = target;
      previous = before;
      pendingReady = {
        token,
        message: beforeDate
          ? "Two dated surveys share the same camera. Alignment is approximate."
          : "Drag to orbit. Pinch or scroll to zoom.",
      };
      notify({
        status: "loading",
        progress: 1,
        message:
          "Preparing the 3D view. The first frame may take a moment while graphics shaders compile.",
      });
      reflect();
      invalidate();
      return true;
    } catch (error) {
      if (!disposed && token === serial)
        showFallback(
          error.message ||
            "The survey could not be opened. Showing its dated still.",
        );
      return false;
    }
  }

  function positionMarker() {
    if (
      !anchor ||
      !validVector(anchor.position) ||
      fallback ||
      !camera ||
      ![current?.date, previous?.date].includes(anchor.date)
    ) {
      marker.hidden = true;
      return;
    }
    const point = new THREE.Vector3()
      .fromArray(anchor.position)
      .project(camera);
    const x = (point.x + 1) / 2;
    const visibleHalf =
      !previous || (anchor.date === previous.date ? x <= wipe : x >= wipe);
    marker.hidden =
      !visibleHalf ||
      point.z < -1 ||
      point.z > 1 ||
      Math.abs(point.x) > 1 ||
      Math.abs(point.y) > 1;
    const rect = canvas.getBoundingClientRect();
    const outer = container.getBoundingClientRect();
    marker.style.left = `${rect.left - outer.left + ((point.x + 1) * rect.width) / 2}px`;
    marker.style.top = `${rect.top - outer.top + ((1 - point.y) * rect.height) / 2}px`;
  }

  async function draw() {
    raf = 0;
    if (disposed || fallback || !current || rendering || document.hidden)
      return;
    rendering = true;
    const token = serial;
    try {
      const cameraChanged = controls.update();
      if (!dirty && !captureRequested) return;
      dirty = false;
      const a = current,
        b = previous;
      camera.updateMatrixWorld();
      if (sortDirty) {
        sortDirty = false;
        await a.spark.update({ scene: a.scene, camera });
        if (b) await b.spark.update({ scene: b.scene, camera });
      }
      if (disposed || fallback || token !== serial) return;
      const width = Math.max(1, canvas.clientWidth || container.clientWidth);
      const height = Math.max(1, canvas.clientHeight || container.clientHeight);
      renderer.setScissorTest(false);
      renderer.clear();
      if (b) {
        const split = Math.round(width * wipe);
        renderer.setScissorTest(true);
        renderer.setScissor(0, 0, split, height);
        renderer.render(b.scene, camera);
        renderer.setScissor(split, 0, width - split, height);
        renderer.render(a.scene, camera);
        renderer.setScissorTest(false);
      } else renderer.render(a.scene, camera);
      frameCount++;
      reflect();
      positionMarker();
      if (pendingReady?.token === token) {
        const ready = pendingReady;
        pendingReady = null;
        notify({ status: "ready", message: ready.message, progress: 1 });
      }
      if (captureRequested) {
        captureRequested = false;
        const batch = captures.splice(0);
        // Start the copy synchronously in the rendered frame; no persistent GPU
        // drawing buffer is needed during ordinary interaction.
        canvas.toBlob((blob) => {
          for (const pending of batch)
            blob
              ? pending.resolve(blob)
              : pending.reject(
                  new Error("The browser could not export this view."),
                );
        }, "image/png");
      }
      // OrbitControls damping needs successive frames until it settles. Spark
      // worker redraws alone do not force another sort or a permanent loop.
      if (cameraChanged) {
        dirty = true;
        sortDirty = true;
      }
    } catch (error) {
      showFallback(
        error.message || "Rendering failed. Showing the dated still.",
      );
    } finally {
      rendering = false;
      if (disposed) releaseResources();
      else if (dirty || sortDirty || captureRequested) invalidate(false);
    }
  }

  function setWipe(value) {
    if (!Number.isFinite(value)) return;
    wipe = clamp(value, 0, 1);
    invalidate(false);
  }

  function reset() {
    if (!controls || fallback || disposed) return;
    // Flush an unfinished drag before applying a deterministic saved view.
    controls.enableDamping = false;
    controls.update();
    const narrow =
      container.clientWidth / Math.max(1, container.clientHeight) < 0.9;
    camera.position.fromArray(
      narrow && manifest.camera.mobilePosition
        ? manifest.camera.mobilePosition
        : manifest.camera.position,
    );
    controls.target.fromArray(manifest.camera.target);
    controls.update();
    controls.enableDamping = true;
    invalidate();
  }

  function setTour(progress) {
    if (
      !camera ||
      !controls ||
      fallback ||
      disposed ||
      !Number.isFinite(progress)
    )
      return;
    controls.enableDamping = false;
    controls.update();
    const p = clamp(progress, 0, 1);
    const narrow =
      container.clientWidth / Math.max(1, container.clientHeight) < 0.9;
    const start =
      narrow && manifest.camera.mobilePosition
        ? manifest.camera.mobilePosition
        : manifest.camera.position;
    const target = new THREE.Vector3().fromArray(manifest.camera.target);
    const offset = new THREE.Vector3().fromArray(start).sub(target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    // A deliberately restrained orbit of the actual scene, with no construction
    // reveal, geometry animation, or fabricated intermediate epochs.
    spherical.theta += 0.72 * p;
    spherical.radius *= 1 - 0.12 * Math.sin(Math.PI * p);
    spherical.phi = clamp(
      spherical.phi + 0.035 * Math.sin(Math.PI * 2 * p),
      0.15,
      Math.PI * 0.47,
    );
    camera.position
      .copy(target)
      .add(new THREE.Vector3().setFromSpherical(spherical));
    controls.target.copy(target);
    controls.update();
    controls.enableDamping = true;
    invalidate();
  }

  function setPicking(value) {
    picking = Boolean(value);
    canvas.style.cursor = picking ? "crosshair" : "grab";
    if (controls) controls.enabled = !picking && !fallback;
  }

  function setAnchor(value) {
    anchor = value || null;
    if (
      anchor?.camera &&
      controls &&
      validVector(anchor.camera.position) &&
      validVector(anchor.camera.target)
    ) {
      controls.enableDamping = false;
      controls.update();
      camera.position.fromArray(anchor.camera.position);
      controls.target.fromArray(anchor.camera.target);
      controls.update();
      controls.enableDamping = true;
    }
    if (!anchor) marker.hidden = true;
    invalidate();
  }

  function pick(clientX, clientY) {
    if (!picking || disposed) return;
    const result = { camera: getCamera(), method: "camera viewpoint", date };
    if (current && !fallback && camera) {
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left) / Math.max(1, rect.width);
      const target = previous && x < wipe ? previous : current;
      result.date = target.date;
      const raycaster = new THREE.Raycaster();
      camera.updateMatrixWorld();
      target.mesh.updateMatrixWorld(true);
      raycaster.setFromCamera(
        new THREE.Vector2(
          x * 2 - 1,
          -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
        ),
        camera,
      );
      try {
        const hits = raycaster.intersectObject(target.mesh, false);
        const hit = hits.find((entry) =>
          entry.point.toArray().every(Number.isFinite),
        );
        if (hit) {
          result.position = hit.point.toArray();
          result.method = "derived splat intersection";
        }
      } catch {
        // A saved viewpoint remains useful if a browser cannot raycast splats.
      }
    }
    anchor = result;
    invalidate(false);
    onPick(result);
  }

  function resize() {
    if (!renderer || disposed || hardFallback) return;
    const width = Math.max(1, canvas.clientWidth || container.clientWidth);
    const height = Math.max(1, canvas.clientHeight || container.clientHeight);
    const mobile =
      lowPower || width < 680 || matchMedia("(pointer: coarse)").matches;
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.6),
    );
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    invalidate();
  }

  async function captureStill() {
    const loadImage = (record) =>
      new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = () =>
          reject(new Error("The dated still could not be exported."));
        image.src =
          container.clientWidth < 680
            ? record.stillMobile || record.still
            : record.still;
      });
    const image = await loadImage(records.get(date));
    const output = document.createElement("canvas");
    output.width = image.naturalWidth;
    output.height = image.naturalHeight;
    const context = output.getContext("2d");
    context.drawImage(image, 0, 0);
    if (beforeDate) {
      const before = await loadImage(records.get(beforeDate));
      context.save();
      context.beginPath();
      context.rect(0, 0, output.width * wipe, output.height);
      context.clip();
      context.drawImage(before, 0, 0, output.width, output.height);
      context.restore();
    }
    return new Promise((resolve, reject) =>
      output.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Still export failed.")),
        "image/png",
      ),
    );
  }

  function capture() {
    if (disposed)
      return Promise.reject(new Error("The viewer has been closed."));
    if (fallback) return captureStill();
    if (
      !current ||
      current.date !== date ||
      (previous?.date || null) !== beforeDate ||
      pendingReady
    )
      return Promise.reject(
        new Error(
          "Wait for the selected survey to finish loading before exporting.",
        ),
      );
    return new Promise((resolve, reject) => {
      captures.push({ resolve, reject });
      captureRequested = true;
      invalidate(false);
    });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    serial++;
    cancelAnimationFrame(raf);
    observer?.disconnect();
    for (const remove of listeners) remove();
    controls?.dispose();
    marker.remove();
    for (const pending of captures.splice(0))
      pending.reject(
        new Error("The viewer was closed before export finished."),
      );
    releaseResources();
  }

  addListener(canvas, "webglcontextlost", (event) => {
    event.preventDefault();
    serial++;
    showFallback(
      "The browser released its WebGL context. The dated survey still remains available; reload to retry 3D.",
      true,
    );
  });
  addListener(document, "visibilitychange", () => {
    if (!document.hidden) invalidate(false);
  });
  addListener(canvas, "pointerdown", (event) => {
    if (event.isPrimary) pointerStart = { x: event.clientX, y: event.clientY };
  });
  addListener(canvas, "pointerup", (event) => {
    if (
      event.isPrimary &&
      pointerStart &&
      Math.hypot(
        event.clientX - pointerStart.x,
        event.clientY - pointerStart.y,
      ) < 8
    )
      pick(event.clientX, event.clientY);
    pointerStart = null;
  });
  addListener(canvas, "pointercancel", () => {
    pointerStart = null;
  });
  addListener(canvas, "keydown", (event) => {
    if (picking && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      pick(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return;
    }
    if (
      !controls ||
      fallback ||
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "+",
        "=",
        "-",
      ].includes(event.key)
    )
      return;
    event.preventDefault();
    notify({ status: "interaction", message: "Camera moved manually." });
    const spherical = new THREE.Spherical().setFromVector3(
      camera.position.clone().sub(controls.target),
    );
    if (event.key === "ArrowLeft") spherical.theta -= 0.1;
    if (event.key === "ArrowRight") spherical.theta += 0.1;
    if (event.key === "ArrowUp") spherical.phi -= 0.08;
    if (event.key === "ArrowDown") spherical.phi += 0.08;
    if (event.key === "+" || event.key === "=") spherical.radius *= 0.9;
    if (event.key === "-") spherical.radius *= 1.1;
    spherical.phi = clamp(spherical.phi, 0.1, Math.PI * 0.47);
    spherical.radius = clamp(spherical.radius, 20, 700);
    camera.position
      .copy(controls.target)
      .add(new THREE.Vector3().setFromSpherical(spherical));
    controls.update();
    invalidate();
  });

  const api = {
    select,
    setWipe,
    reset,
    setTour,
    setPicking,
    setAnchor,
    getCamera,
    resize,
    capture,
    dispose,
  };
  canvas.tabIndex = 0;
  canvas.style.touchAction = "none";
  canvas.setAttribute(
    "aria-label",
    "Interactive 3D site survey. Drag to orbit, pinch or scroll to zoom. Arrow keys orbit; plus and minus zoom. In note placement mode, Enter places an anchor at the centre.",
  );
  reflect();
  if (forceFallback) {
    showFallback("Still-image mode requested. Orbiting requires WebGL.");
    return api;
  }
  try {
    notify({
      status: "loading",
      message: "Preparing the 3D viewer",
      progress: 0,
    });
    const [threeModule, sparkModule, controlsModule] = await Promise.all([
      import("three"),
      import("@sparkjsdev/spark"),
      import("three/addons/controls/OrbitControls.js"),
    ]);
    THREE = threeModule;
    ({ SparkRenderer, SplatMesh } = sparkModule);
    const { OrbitControls } = controlsModule;
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: lowPower ? "low-power" : "default",
    });
    renderer.setClearColor("#e9e9e3");
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.autoClear = false;
    camera = new THREE.PerspectiveCamera(43, 1, 0.1, 3000);
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.11;
    controls.minDistance = 20;
    controls.maxDistance = 700;
    controls.maxPolarAngle = Math.PI * 0.47;
    const changed = () => invalidate();
    const started = () =>
      notify({ status: "interaction", message: "Camera moved manually." });
    controls.addEventListener("change", changed);
    controls.addEventListener("start", started);
    listeners.push(
      () => controls.removeEventListener("change", changed),
      () => controls.removeEventListener("start", started),
    );
    observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    reset();
    // Returning the controls immediately lets the surrounding timeline change
    // the requested epoch while an earlier request is still in flight.
    // The surrounding timeline selects its exact requested epoch after setup.
  } catch (error) {
    showFallback(
      error.message || "WebGL is unavailable. Showing the dated survey still.",
      true,
    );
  }
  return api;
}
