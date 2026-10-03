/** Pure date, link and walkthrough model. No local records are published here. */
export const HISTORY_MODES = ["3d", "photos"];
export const TOUR_DURATION = 72;
export const ANCHOR_METHOD = "derived splat intersection";
export const ANCHOR_METHODS = [ANCHOR_METHOD, "camera viewpoint"];

const ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const finite = (n) => typeof n === "number" && Number.isFinite(n);
const round = (n) => Math.round(n * 10000) / 10000;
const dateIsValid = (s) =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(s)) &&
  new Date(s).toISOString().slice(0, 10) === s;
const listFrames = (catalog) =>
  Array.isArray(catalog?.frames) ? catalog.frames : [];
const projectMeta = (project, catalog) =>
  typeof project === "string"
    ? catalog?.projects?.find((p) => p.id === project)
    : project;

function validRecords(manifest) {
  return (manifest?.records || [])
    .filter(
      (r) =>
        dateIsValid(r.date) &&
        r.available === true &&
        typeof r.url === "string" &&
        /^\.\/data\/surveys\/[\w.-]+\.(spz|splat|ply)$/.test(r.url) &&
        Number.isInteger(r.pointCount) &&
        r.pointCount > 0 &&
        typeof r.sha256 === "string" &&
        /^[a-f0-9]{64}$/i.test(r.sha256),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** A source match prevents dates from one site becoming another site's history. */
function hasManifest(project, manifest) {
  return Boolean(
    project &&
      (manifest?.projectId
        ? manifest.projectId === project.id
        : project.sourceUrl && project.sourceUrl === manifest?.source),
  );
}

export function getHistoryDates(project, catalog, manifest, mode = "3d") {
  const p = projectMeta(project, catalog);
  if (!p || !HISTORY_MODES.includes(mode)) return [];
  if (mode === "photos")
    return [
      ...new Set(
        listFrames(catalog)
          .filter((f) => f.projectId === p.id && dateIsValid(f.date))
          .map((f) => f.date),
      ),
    ].sort();
  if (!hasManifest(p, manifest)) return [];
  // Each model also needs a real photo date in this project. A manifest alone
  // must not create a new capture date in the workspace.
  const photoDates = new Set(getHistoryDates(p, catalog, manifest, "photos"));
  return [
    ...new Set(
      validRecords(manifest)
        .filter((r) => photoDates.has(r.date))
        .map((r) => r.date),
    ),
  ];
}

/** Exact means exact: no closest-date or different-view substitution. */
export function photoForDate(project, catalog, date, view = 1) {
  const id = typeof project === "string" ? project : project?.id;
  if (!dateIsValid(date) || !Number.isInteger(view) || view < 1) return null;
  return (
    listFrames(catalog).find(
      (f) => f.projectId === id && f.date === date && f.view === view,
    ) || null
  );
}

export function defaultChange(beforeDate, afterDate, manifest) {
  const records = validRecords(manifest);
  const before = records.find((r) => r.date === beforeDate);
  const after = records.find((r) => r.date === afterDate);
  const stages = [before, after]
    .filter((r, i, a) => r && a.indexOf(r) === i)
    .map((r) => ({
      date: r.date,
      label: r.label,
      note: r.note || "Stage not reviewed.",
    }));
  let title = "Review what changed";
  let summary =
    "Compare the selected captures and add a reviewer note. A stage change has not been established for this pair.";
  if (before && after && beforeDate === afterDate) {
    title = "Same recorded visit";
    summary = `${after.note || "Stage not reviewed."} Both views show ${afterDate}; no date-to-date change is implied.`;
  } else if (before && after) {
    title =
      beforeDate < afterDate
        ? "Between these visits"
        : "Looking back at the site";
    summary = `${beforeDate}: ${before.note || "Stage not reviewed."} ${afterDate}: ${after.note || "Stage not reviewed."}`;
  }
  return {
    beforeDate: dateIsValid(beforeDate) ? beforeDate : null,
    afterDate: dateIsValid(afterDate) ? afterDate : null,
    title,
    summary,
    stages,
    kind: "derived",
    source: "Editorial reading of real captures; not automated detection",
    evidenceDates: stages.map((s) => s.date),
    limitations:
      "Capture coverage and registration differ. Visible surfaces do not establish quantities, hidden work or certified completion.",
  };
}

function vector(value, limit = 3000) {
  return Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => finite(n) && Math.abs(n) <= limit)
    ? value.map(round)
    : null;
}

/** Throws for unsafe/degenerate views. Values are in the viewer's local units. */
export function validateCamera(value) {
  const position = vector(value?.position);
  const target = vector(value?.target);
  if (!position || !target)
    throw Error("Camera needs finite, bounded position and target vectors.");
  const distance = Math.hypot(...position.map((n, i) => n - target[i]));
  // Match OrbitControls so a shared view is not silently clamped on restore.
  // A small epsilon accommodates four-decimal URL serialization at the limits.
  if (distance < 19.999 || distance > 700.001)
    throw Error("Camera distance is outside the supported viewing range.");
  return { position, target };
}

function validRegion(region) {
  if (
    !Array.isArray(region) ||
    region.length !== 4 ||
    !region.every(finite) ||
    region[0] < 0 ||
    region[1] < 0 ||
    region[2] <= 0 ||
    region[3] <= 0 ||
    region[0] + region[2] > 1 ||
    region[1] + region[3] > 1
  )
    throw Error("Shared region must stay inside the source image.");
  return region.map(round);
}

/** Approximate contextual pin, never a surveyed point or physical measurement. */
export function validateModelAnchor(value, project, catalog, manifest) {
  const p = projectMeta(project, catalog);
  if (!p || value?.projectId !== p.id)
    throw Error("Model anchor belongs to a different project.");
  if (!getHistoryDates(p, catalog, manifest, "3d").includes(value.date))
    throw Error("Model anchor date has no verified 3D survey.");
  const position =
    value.position == null && value.method === "camera viewpoint"
      ? null
      : vector(value.position, 1000);
  if (
    !position &&
    !(value.position == null && value.method === "camera viewpoint")
  )
    throw Error("Model anchor needs a finite, bounded position.");
  if (!ANCHOR_METHODS.includes(value.method))
    throw Error("Model anchor must declare the approximate picking method.");
  const camera = validateCamera(value.camera);
  return {
    projectId: p.id,
    date: value.date,
    position,
    camera,
    method: value.method,
    limitation:
      "Approximate viewer position, not a measured or surveyed coordinate.",
  };
}

export function serializeModelAnchor(value, project, catalog, manifest) {
  return JSON.stringify(validateModelAnchor(value, project, catalog, manifest));
}

export function parseModelAnchor(value, project, catalog, manifest) {
  if (typeof value !== "string" || value.length > 1600)
    throw Error("Invalid model anchor payload.");
  return validateModelAnchor(JSON.parse(value), project, catalog, manifest);
}

function text(value, limit, label, required = false) {
  if (value === undefined || value === null) value = "";
  if (
    typeof value !== "string" ||
    value.length > limit ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    throw Error(`${label} is too long or contains invalid characters.`);
  if (required && !value.trim()) throw Error(`${label} is required.`);
  return value.trim();
}

/** Only explicit, bounded fields can travel in a link; unknown fields are dropped. */
function cleanReview(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid shared review.");
  const review = {
    note: text(value.note, 1600, "Review note", true),
    location: text(value.location, 180, "Location"),
    author: text(value.author, 120, "Reviewer"),
    evidenceId: text(value.evidenceId, 100, "Source image", true),
    stage: text(value.stage, 80, "Stage") || "Not established",
    kind: ["sample", "observation", "inference", "clutter"].includes(value.kind)
      ? value.kind
      : "observation",
    source:
      value.kind === "sample"
        ? "Illustrative example, created for this demo"
        : "Explicitly shared user-entered note",
  };
  if (!ID.test(review.evidenceId)) throw Error("Invalid source image ID.");
  if (value.region) review.region = validRegion(value.region);
  if (value.modelAnchor) {
    const a = value.modelAnchor;
    const position =
      a.position == null && a.method === "camera viewpoint"
        ? null
        : vector(a.position, 1000);
    if (
      !ID.test(a.projectId || "") ||
      !dateIsValid(a.date) ||
      (!position && !(a.position == null && a.method === "camera viewpoint")) ||
      !ANCHOR_METHODS.includes(a.method)
    )
      throw Error("Invalid shared model anchor.");
    review.modelAnchor = {
      projectId: a.projectId,
      date: a.date,
      position,
      camera: validateCamera(a.camera),
      method: a.method,
    };
  }
  return review;
}

export function validateSharedReview(value, project, catalog, manifest) {
  const p = projectMeta(project, catalog);
  const review = cleanReview(value);
  const frame = listFrames(catalog).find(
    (f) => f.id === review.evidenceId && f.projectId === p?.id,
  );
  if (!frame) throw Error("Shared review source is not in this project.");
  if (review.modelAnchor) {
    review.modelAnchor = validateModelAnchor(
      review.modelAnchor,
      p,
      catalog,
      manifest,
    );
    if (review.modelAnchor.date !== frame.date)
      throw Error("Model anchor and source image dates differ.");
  }
  return review;
}

/** Builds an intentional public link. No existing query (tokens/QA state) survives. */
export function buildShareURL(base, options = {}) {
  const url = new URL(base);
  if (!["https:", "http:"].includes(url.protocol))
    throw Error("Sharing requires an HTTP(S) URL.");
  url.username = "";
  url.password = "";
  url.search = "";
  const p = new URLSearchParams();
  if (!ID.test(options.projectId || ""))
    throw Error("Choose a project to share.");
  p.set("project", options.projectId);
  const mode = options.mode || "3d";
  if (!HISTORY_MODES.includes(mode)) throw Error("Unknown history mode.");
  p.set("mode", mode);
  for (const [field, key] of [
    ["date", "date"],
    ["beforeDate", "before"],
  ]) {
    if (!options[field]) continue;
    if (!dateIsValid(options[field]))
      throw Error("Share dates must be valid calendar dates.");
    p.set(key, options[field]);
  }
  for (const field of ["view", "beforeView"]) {
    if (options[field] === undefined) continue;
    if (
      !Number.isInteger(options[field]) ||
      options[field] < 1 ||
      options[field] > 1000
    )
      throw Error("Photo view must be a positive view number.");
    p.set(field, String(options[field]));
  }
  if (options.compare === true) p.set("compare", "1");
  if (options.tour === true) p.set("tour", "1");
  if (options.tourPosition !== undefined) {
    if (!finite(options.tourPosition)) throw Error("Invalid tour position.");
    p.set("t", String(round(clamp(options.tourPosition, 0, TOUR_DURATION))));
  }
  if (options.camera)
    p.set("camera", JSON.stringify(validateCamera(options.camera)));
  if (options.observationId) {
    if (!ID.test(options.observationId)) throw Error("Invalid observation ID.");
    p.set("observation", options.observationId);
  }
  if (options.review) {
    const review = cleanReview(options.review);
    if (
      review.modelAnchor &&
      review.modelAnchor.projectId !== options.projectId
    )
      throw Error("Shared model anchor belongs to a different project.");
    p.set("review", JSON.stringify(review));
  }
  url.hash = `history?${p.toString()}`;
  if (url.href.length > 12000)
    throw Error("Shared review is too large for a link.");
  return url.href;
}

/** Invalid captures are never interpolated. Recoveries identify the ignored input. */
export function parseHistoryLink(input, catalog, manifest) {
  let url;
  try {
    url = new URL(input, "https://sitecommit.invalid/");
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.href.length > 16000)
    return null;
  const hash = url.hash.slice(1);
  if (hash && hash !== "history" && !hash.startsWith("history?")) return null;
  const params = new URLSearchParams(
    hash.startsWith("history?") ? hash.slice(8) : url.search,
  );
  if (!hash && !params.has("project") && !params.has("mode")) return null;
  const projectId = params.get("project") || catalog?.projects?.[0]?.id;
  const project = catalog?.projects?.find((p) => p.id === projectId);
  if (!project) return null;
  let mode = params.get("mode") || "3d";
  if (!HISTORY_MODES.includes(mode)) return null;
  const warnings = [];
  let dates = getHistoryDates(project, catalog, manifest, mode);
  if (mode === "3d" && !dates.length) {
    mode = "photos";
    dates = getHistoryDates(project, catalog, manifest, mode);
    warnings.push(
      "This project has no verified 3D epochs; showing its real photo dates.",
    );
  }
  const requestedDate = params.get("date");
  const date = dates.includes(requestedDate)
    ? requestedDate
    : dates.at(-1) || null;
  if (requestedDate && date !== requestedDate)
    warnings.push(
      "Requested date is unavailable in this view; showing the latest available capture.",
    );
  const requestedBefore = params.get("before");
  let beforeDate = dates.includes(requestedBefore) ? requestedBefore : null;
  if (requestedBefore && !beforeDate)
    warnings.push(
      "Comparison date is unavailable; the requested comparison was not opened.",
    );
  if (!beforeDate && !requestedBefore)
    beforeDate = dates[Math.max(0, dates.indexOf(date) - 1)] || null;
  const compare =
    params.get("compare") === "1" &&
    Boolean(date && beforeDate) &&
    !(requestedBefore && !dates.includes(requestedBefore));
  const selectView = (key, selectedDate) => {
    const requested = params.has(key) ? Number(params.get(key)) : 1;
    const frame = photoForDate(project, catalog, selectedDate, requested);
    if (frame) return frame.view;
    const first = listFrames(catalog)
      .filter((f) => f.projectId === projectId && f.date === selectedDate)
      .sort((a, b) => a.view - b.view)[0];
    if (params.has(key))
      warnings.push(
        `Requested ${key === "beforeView" ? "before " : ""}photo view is unavailable; showing the first available source view.`,
      );
    return first?.view || 1;
  };
  const view = selectView("view", date),
    beforeView = selectView("beforeView", beforeDate);
  let camera = null,
    review = null;
  if (params.has("camera")) {
    try {
      camera = validateCamera(JSON.parse(params.get("camera")));
    } catch {
      warnings.push("Invalid camera view was ignored.");
    }
  }
  if (params.has("review")) {
    try {
      review = validateSharedReview(
        JSON.parse(params.get("review")),
        project,
        catalog,
        manifest,
      );
    } catch {
      warnings.push(
        "Shared note has an invalid source or payload and was ignored.",
      );
    }
  }
  let tourPosition = Number(params.get("t") || 0);
  if (!Number.isFinite(tourPosition)) {
    tourPosition = 0;
    warnings.push("Invalid walkthrough position was reset.");
  }
  tourPosition = clamp(tourPosition, 0, TOUR_DURATION);
  const observationId = ID.test(params.get("observation") || "")
    ? params.get("observation")
    : null;
  return {
    projectId,
    mode,
    date,
    beforeDate,
    compare,
    view,
    beforeView,
    tour: params.get("tour") === "1" && mode === "3d" && dates.length > 0,
    tourPosition,
    camera,
    observationId,
    review,
    warnings,
  };
}

/** A camera orbit between exact visits, not invented intermediate reconstructions. */
export function tourAt(seconds, duration = TOUR_DURATION, manifest) {
  if (!finite(duration) || duration <= 0) duration = TOUR_DURATION;
  seconds = finite(seconds) ? clamp(seconds, 0, duration) : 0;
  const progress = seconds / duration;
  const records = validRecords(manifest);
  if (!records.length)
    return {
      seconds,
      duration,
      progress,
      date: null,
      beforeDate: null,
      caption: "No verified 3D visits available.",
      camera: null,
      segmentProgress: 0,
      finished: seconds >= duration,
    };
  const index = Math.min(
    records.length - 1,
    Math.floor(progress * records.length),
  );
  const segmentProgress =
    progress === 1 ? 1 : progress * records.length - index;
  const record = records[index];
  let camera = null;
  try {
    const start = validateCamera(manifest.camera);
    const offset = start.position.map((v, i) => v - start.target[i]);
    // Slow, bounded orbit from a single common frame; no claimed ground route.
    const angle = -0.18 + progress * 0.58;
    const zoom = 1 - 0.09 * Math.sin(Math.PI * progress);
    camera = validateCamera({
      position: [
        start.target[0] +
          (offset[0] * Math.cos(angle) - offset[2] * Math.sin(angle)) * zoom,
        start.target[1] + offset[1] * zoom,
        start.target[2] +
          (offset[0] * Math.sin(angle) + offset[2] * Math.cos(angle)) * zoom,
      ],
      target: start.target,
    });
  } catch {
    /* The caller may use its valid default camera. */
  }
  return {
    seconds,
    duration,
    progress,
    date: record.date,
    beforeDate: records[Math.max(0, index - 1)].date,
    caption: `${record.label || record.date} · ${record.note || "Review this recorded visit."}`,
    source: "Editorial caption from a real recorded visit",
    camera,
    segmentProgress,
    finished: seconds >= duration,
  };
}
