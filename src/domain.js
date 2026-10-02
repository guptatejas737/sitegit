export const EXAMPLE = "Illustrative example, created for this demo";
export const GATE =
  "DRAFT — human review required. Not an approved bill or contractual measurement. The 98–99% confidence requirement is a validation goal, not demonstrated accuracy.";
export const STAGES = [
  "Not established",
  "Excavation",
  "Rebar",
  "Formwork / shuttering",
  "Concrete",
  "Masonry",
  "Services",
  "Plaster",
  "Paint",
  "External works",
];
export const uid = (prefix = "r") => `${prefix}-${crypto.randomUUID()}`;
export const clone = (x) => JSON.parse(JSON.stringify(x));
export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === value;
}
export function dateDifference(actual, target) {
  if (!validDate(actual) || !validDate(target)) return null;
  return Math.round(
    (Date.parse(actual + "T00:00:00Z") - Date.parse(target + "T00:00:00Z")) /
      86400000,
  );
}
export function number(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function percentComplete(observation) {
  if (observation.partialMethod === "entered scope") {
    const n = number(observation.done),
      d = number(observation.total);
    return n !== null && d > 0 && n <= d
      ? { value: (100 * n) / d, label: `Entered scope: ${n}/${d}` }
      : null;
  }
  if (observation.partialMethod === "human estimate") {
    const n = number(observation.estimate);
    return n !== null && n <= 100
      ? { value: n, label: "Human estimate; not image-measured" }
      : null;
  }
  return null;
}
export function activityStatus(activity, observations, frames) {
  const linked = observations.filter((o) => o.activityId === activity.id);
  const matched = linked
    .filter(
      (o) =>
        o.review === "reviewed" &&
        o.stage === activity.targetStage &&
        !["inference", "clutter"].includes(o.kind),
    )
    .map((o) => ({ o, f: frames.find((f) => f.id === o.evidenceId) }))
    .filter((x) => x.f)
    .sort((a, b) => a.f.date.localeCompare(b.f.date));
  const first = matched[0];
  if (!first)
    return {
      label: "Not enough evidence",
      days: null,
      date: null,
      note: "No reviewed observation establishing the target stage. Missing evidence is not proof of delay.",
      evidence: [],
    };
  const days = dateDifference(first.f.date, activity.end);
  return {
    label:
      days === null
        ? "Baseline missing"
        : days > 0
          ? `${days} days after target`
          : days < 0
            ? `${-days} days before target`
            : "On target date",
    days,
    date: first.f.date,
    note: `First reviewed evidence of ${activity.targetStage}. Actual completion date may be earlier than the capture. ${first.o.note}`,
    evidence: [first.o],
    sample: first.o.kind === "sample",
  };
}
export function quantityResult(q) {
  const types = {
    volume: { unit: "m³", fields: ["length", "width", "thickness"] },
    area: { unit: "m²", fields: ["length", "height"] },
    opening: { unit: "m²", fields: ["width", "height"] },
    length: { unit: "m", fields: ["length"] },
    count: { unit: "no.", fields: ["count"] },
  };
  const def = types[q.type] || types.volume;
  const missing = [];
  if (!q.source?.trim()) missing.push("dimension source / drawing reference");
  if (!q.evidenceId) missing.push("source evidence");
  if (!q.method || q.method === "unknown") missing.push("measurement method");
  const vals = def.fields.map((k) => {
    const v = number(q[k]);
    if (v === null || v <= 0) missing.push(k + " (> 0)");
    return v;
  });
  const deduction = number(q.deduction) ?? 0;
  if (
    q.deduction !== "" &&
    q.deduction !== undefined &&
    number(q.deduction) === null
  )
    missing.push("valid non-negative exclusion");
  if (
    q.type === "count" &&
    (!Number.isInteger(number(q.count)) || !Number.isInteger(deduction))
  )
    missing.push("whole-number count and exclusion");
  if (deduction > 0 && !q.deductionSource?.trim())
    missing.push("exclusion quantity source");
  const gross = vals.every((v) => v > 0)
    ? vals.reduce((a, b) => a * b, 1)
    : null;
  if (gross !== null && deduction > gross)
    missing.push("deduction exceeds gross scope");
  if (q.method === "drawing-derived dimensions" && !q.drawingId)
    missing.push("linked drawing");
  if (
    q.method === "site-verified dimensions" &&
    (!q.reviewer?.trim() || !q.validation?.trim())
  )
    missing.push("site verification basis and reviewer");
  const net = missing.length ? null : gross - deduction;
  const bill = number(q.billQuantity);
  const rate = number(q.rate);
  return {
    unit: def.unit,
    fields: def.fields,
    missing,
    gross,
    net,
    deduction,
    difference:
      net !== null && bill !== null && q.billSource?.trim() ? net - bill : null,
    amount:
      net !== null && rate !== null && q.currency?.trim() ? net * rate : null,
    formula: def.fields.join(" × ") + (deduction ? " − stated exclusion" : ""),
    limit:
      q.type === "volume"
        ? "Thickness and hidden faces are not established by a single image."
        : "Image regions are not calibrated dimensions. Entered dimensions need independent verification.",
  };
}
export function validateActivity(a) {
  if (!a.name?.trim() || !a.location?.trim())
    throw Error("Activity name and location are required.");
  if (!a.baselineSource?.trim())
    throw Error("State where the baseline came from.");
  if ((a.start && !validDate(a.start)) || (a.end && !validDate(a.end)))
    throw Error("Use valid calendar dates.");
  if (a.start && a.end && dateDifference(a.end, a.start) < 0)
    throw Error("Target finish cannot precede baseline start.");
  if (a.scope !== "" && number(a.scope) === null)
    throw Error("Scope must be a non-negative number or blank.");
  return a;
}
export function validateObservation(o, p, frames) {
  if (!o.note?.trim() || !o.author?.trim() || !o.location?.trim())
    throw Error("Note, author and location are required.");
  const f = frames.find((f) => f.id === o.evidenceId && f.projectId === p.id);
  if (!f) throw Error("Choose an image from this project.");
  if (
    o.beforeEvidenceId &&
    !frames.some((f) => f.id === o.beforeEvidenceId && f.projectId === p.id)
  )
    throw Error("Before image must belong to this project.");
  if (o.activityId && !p.activities.some((a) => a.id === o.activityId))
    throw Error("Work package does not belong to this project.");
  if (
    o.qaStatus === "confirmed by reviewer" &&
    (!o.verification?.trim() || o.review !== "reviewed")
  )
    throw Error(
      "A confirmed issue needs reviewed status and an explicit verification basis.",
    );
  if (o.partialMethod !== "not provided" && !percentComplete(o))
    throw Error("Provide a valid completion estimate or entered scope.");
  const r = o.region;
  if (
    !r ||
    r.some((v) => !Number.isFinite(v)) ||
    r[0] < 0 ||
    r[1] < 0 ||
    r[2] <= 0 ||
    r[3] <= 0 ||
    r[0] + r[2] > 1.001 ||
    r[1] + r[3] > 1.001
  )
    throw Error("Region must stay inside the image.");
  return o;
}
export function makeProject(meta, frames) {
  const pf = frames.filter((f) => f.projectId === meta.id);
  const days = [...new Set(pf.map((f) => f.date))].sort();
  const start = days[0] || "",
    end = days.at(-1) || "";
  const mid = days[Math.floor(days.length / 2)] || "";
  const activities = [
    ["Site preparation", "Sitewide", "Excavation", start, mid],
    ["Foundation / structural works", "Main structure", "Concrete", mid, end],
    ["Envelope and services review", "Main structure", "Services", mid, end],
  ].map(([name, location, targetStage, s, e], i) => ({
    id: meta.id + "-wp-" + (i + 1),
    name,
    location,
    targetStage,
    start: s,
    end: e,
    scope: "",
    unit: i === 1 ? "m³" : "m²",
    baselineSource: EXAMPLE,
    reference: "",
    labor: "",
    equipment: "",
    material: "",
    budget: "",
    currency: "INR",
    resourceSource: "Not provided",
  }));
  const last = pf.at(-1);
  const observations = last
    ? [
        {
          id: meta.id + "-sample",
          evidenceId: last.id,
          beforeEvidenceId: "",
          activityId: activities[1].id,
          location: "Main structure",
          stage: "Not established",
          kind: "sample",
          review: "not enough evidence",
          qaStatus: "potential issue",
          verification: "",
          hiddenWork: false,
          author: "SiteCommit example",
          note: "Review the visible work against the foundation package. Confirm stage and extent before recording completion; hidden dimensions are not supplied.",
          region: [0.25, 0.25, 0.45, 0.45],
          partialMethod: "not provided",
          done: "",
          total: "",
          estimate: "",
          dimensionNote: "",
          dimensionSource: "",
          createdAt: new Date().toISOString(),
        },
      ]
    : [];
  return {
    ...meta,
    activities,
    observations,
    quantities: [],
    documents: [],
    drawings: [],
    selectedEvidenceId:
      pf.find((f) => f.date === "2024-11-27")?.id || last?.id || "",
    beforeEvidenceId:
      pf.find((f) => f.date === "2024-10-18")?.id || pf[0]?.id || "",
    createdAt: new Date().toISOString(),
  };
}
export function seedState(catalog) {
  return {
    version: 3,
    activeProjectId: catalog.projects[0].id,
    projects: catalog.projects.map((p) => makeProject(p, catalog.frames)),
    savedAt: null,
  };
}
export function validateState(state, catalog) {
  if (
    state?.version !== 3 ||
    !Array.isArray(state.projects) ||
    !state.projects.length
  )
    throw Error("Unsupported workspace backup.");
  const ids = new Set();
  for (const p of state.projects) {
    if (!p.id || ids.has(p.id) || !p.name)
      throw Error("Invalid project identity.");
    ids.add(p.id);
    for (const k of [
      "activities",
      "observations",
      "quantities",
      "documents",
      "drawings",
    ])
      if (!Array.isArray(p[k])) throw Error("Incomplete project backup.");
    p.activities.forEach(validateActivity);
    p.observations.forEach((o) => validateObservation(o, p, catalog.frames));
    for (const q of p.quantities)
      if (
        !p.activities.some((a) => a.id === q.activityId) ||
        !catalog.frames.some(
          (f) => f.id === q.evidenceId && f.projectId === p.id,
        ) ||
        (q.drawingId && !p.drawings.some((d) => d.id === q.drawingId))
      )
        throw Error("Quantity has broken project/evidence links.");
    for (const d of p.drawings)
      if (!/^data:image\/(png|jpeg|webp);base64,/.test(d.data))
        throw Error("Only raster drawing data is accepted.");
    for (const d of p.documents)
      if (
        !Array.isArray(d.evidenceIds) ||
        d.evidenceIds.some(
          (id) =>
            !catalog.frames.some((f) => f.id === id && f.projectId === p.id),
        ) ||
        typeof d.body !== "string" ||
        !d.snapshot
      )
        throw Error("Document has broken source links.");
  }
  if (!ids.has(state.activeProjectId)) throw Error("Active project missing.");
  return state;
}
export function saveState(storage, state) {
  const copy = clone(state);
  copy.savedAt = new Date().toISOString();
  storage.setItem("sitecommit.workspace.v3", JSON.stringify(copy));
  return copy.savedAt;
}
export function loadState(storage, catalog) {
  const text = storage.getItem("sitecommit.workspace.v3");
  return text ? validateState(JSON.parse(text), catalog) : seedState(catalog);
}
export const PLAN_COLUMNS = [
  "id",
  "name",
  "location",
  "targetStage",
  "start",
  "end",
  "scope",
  "unit",
  "baselineSource",
  "reference",
  "labor",
  "equipment",
  "material",
  "budget",
  "currency",
  "resourceSource",
];
export function csv(rows, columns) {
  return [columns, ...rows.map((r) => columns.map((k) => r[k] ?? ""))]
    .map((row) =>
      row
        .map((v) => {
          let s = String(v);
          if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
          return '"' + s.replaceAll('"', '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
}
export function parseCSV(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("Unclosed CSV quote.");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift()?.map((x) => x.replace(/^\uFEFF/, ""));
  if (!headers?.length) throw Error("Empty CSV.");
  return rows.map((row) => {
    if (row.length !== headers.length)
      throw Error("CSV column count mismatch.");
    return Object.fromEntries(headers.map((h, i) => [h, row[i]]));
  });
}
export function importPlan(text, p) {
  const rows = parseCSV(text);
  if (!rows.length || rows.length > 500) throw Error("Import 1–500 plan rows.");
  const used = new Set();
  return rows.map((row) => {
    const a = Object.fromEntries(
      PLAN_COLUMNS.map((k) => [k, String(row[k] ?? "")]),
    );
    a.id = a.id || uid("wp");
    if (used.has(a.id)) throw Error("Duplicate activity ID.");
    used.add(a.id);
    if (
      p.activities.some((x) => x.id === a.id) === false &&
      p.observations.some((o) => o.activityId === a.id)
    )
      throw Error("Invalid activity mapping");
    return validateActivity(a);
  });
}
export function resources(a) {
  const vals = ["labor", "equipment", "material"].map((k) => number(a[k]));
  const total = vals.every((v) => v !== null)
      ? vals.reduce((x, y) => x + y, 0)
      : null,
    budget = number(a.budget);
  return {
    total,
    variance: total !== null && budget !== null ? total - budget : null,
  };
}
export const DOC_TYPES = [
  "Progress report",
  "Site diary",
  "M-book draft",
  "QA/QC report",
  "Hidden-work pack",
  "Progress evidence package",
];
export function generateDocument(p, frames, type, from, to, activityIds) {
  if (!validDate(from) || !validDate(to) || dateDifference(to, from) < 0)
    throw Error("Choose a valid reporting period.");
  const selected = p.activities.filter((a) => activityIds.includes(a.id));
  if (!selected.length) throw Error("Select at least one work package.");
  const scopedFrames = frames.filter(
    (f) => f.projectId === p.id && f.date >= from && f.date <= to,
  );
  const frameIds = new Set(scopedFrames.map((f) => f.id));
  let obs = p.observations.filter(
    (o) =>
      frameIds.has(o.evidenceId) &&
      (activityIds.includes(o.activityId) || !o.activityId),
  );
  if (type === "Hidden-work pack") obs = obs.filter((o) => o.hiddenWork);
  if (type === "QA/QC report")
    obs = obs.filter((o) => o.qaStatus !== "not applicable");
  const qs = p.quantities.filter(
    (q) => activityIds.includes(q.activityId) && frameIds.has(q.evidenceId),
  );
  const evidence = new Set(
    obs.flatMap((o) => [o.evidenceId, o.beforeEvidenceId].filter(Boolean)),
  );
  qs.forEach((q) => evidence.add(q.evidenceId));
  if (!evidence.size)
    scopedFrames.filter((f) => f.view === 1).forEach((f) => evidence.add(f.id));
  // A package status may cite an earlier observation outside the report period.
  // Keep that source in the exported register rather than leaving an orphan claim.
  for (const a of selected)
    for (const o of activityStatus(a, p.observations, frames).evidence)
      evidence.add(o.evidenceId);
  const usedFrames = frames.filter(
    (f) => evidence.has(f.id) && f.projectId === p.id,
  );
  const baseline =
    selected.some((a) => a.baselineSource === EXAMPLE) ||
    obs.some((o) => o.kind === "sample");
  const statusSummary = selected
    .map((a) => {
      const s = activityStatus(a, p.observations, frames);
      return `${a.name}: ${s.date ? `${a.targetStage} observed ${s.date}, ${s.label.toLowerCase()} ${s.evidence.map((o) => "[" + o.evidenceId + "]").join(" ")}` : "not enough reviewed evidence"}.`;
    })
    .join(" ");
  let lines = [
    `# ${type} — ${p.name}`,
    `Period: ${from} to ${to}`,
    GATE,
    baseline
      ? EXAMPLE
      : "Baseline sources are entered by the reviewer; independently verify.",
    `Source: ${p.sourceUrl || "User-provided project"} · ${p.license || "rights not provided"}`,
    `Client summary: ${obs.length} linked observation(s), ${qs.length} quantity draft(s), ${usedFrames.length} evidence frame(s). Status reflects reviewed visible stages, not certified completion.`,
    "\n## Work packages",
  ];
  lines.splice(6, 0, statusSummary);
  if (type === "Site diary")
    lines.splice(
      7,
      0,
      "Diary context: workforce, weather, deliveries, instructions and causes are not provided. Add only known site context.",
    );
  if (type === "QA/QC report")
    lines.splice(
      7,
      0,
      "QA/QC review: potential issues are visual observations, not confirmed defects. Verification basis and reviewer status are listed for each record.",
    );
  if (type === "Hidden-work pack")
    lines.splice(
      7,
      0,
      "Before-covering register: records below were flagged by a reviewer. No later concealment, concealed compliance or as-built dimensions are inferred. Retrieve by location in Remote review.",
    );
  for (const a of selected) {
    const s = activityStatus(a, p.observations, frames);
    lines.push(
      `### ${a.name} · ${a.location}`,
      `Baseline: ${a.start || "not provided"} → ${a.end || "not provided"} · source: ${a.baselineSource}`,
      `Planned scope: ${a.scope || "not provided"} ${a.unit} · target stage: ${a.targetStage}`,
      `First reviewed stage evidence (all dates): ${s.date || "not established"} · ${s.label}`,
      s.note,
      `Drawing / model reference: ${a.reference || "not provided"}`,
    );
    const r = resources(a);
    lines.push(
      `Entered cost context (${a.currency || "currency not provided"}): labor ${a.labor || "not provided"}, equipment ${a.equipment || "not provided"}, material ${a.material || "not provided"}, budget ${a.budget || "not provided"}. Source: ${a.resourceSource || "not provided"}. Sum: ${r.total ?? "unknown"}; difference from budget: ${r.variance ?? "unknown"}.`,
    );
  }
  lines.push("\n## Dated observations and changes");
  if (!obs.length)
    lines.push(
      "No matching observations. Reviewer context, visible stage and causes are not provided.",
    );
  for (const o of obs) {
    const f = frames.find((f) => f.id === o.evidenceId);
    const pc = percentComplete(o);
    lines.push(
      `### ${f.date} · ${o.location} · ${o.stage}`,
      `[${o.kind === "sample" ? EXAMPLE : o.kind}] ${o.note}`,
      `Evidence: [${o.evidenceId}]${o.beforeEvidenceId ? ` · Before: [${o.beforeEvidenceId}]` : ""} · region: ${o.region.map((v) => (v * 100).toFixed(1) + "%").join(", ")}`,
      `Author: ${o.author} · review: ${o.review} · QA/QC: ${o.qaStatus} · verification basis: ${o.verification || "not provided"}`,
      `Partial work: ${pc ? pc.value.toFixed(1) + "% — " + pc.label : "not provided"}`,
      `Before covering: ${o.hiddenWork ? "flagged by reviewer; not proof of later concealment" : "not flagged"}. Dimensions: ${o.dimensionNote || "not provided"} · source: ${o.dimensionSource || "not provided"}`,
    );
  }
  lines.push("\n## Measurement draft and billing comparison");
  if (!qs.length)
    lines.push(
      "No source-linked quantity lines for this selection. Dimensions, calibration and contractual quantities are not provided.",
    );
  for (const q of qs) {
    const r = quantityResult(q);
    lines.push(
      `### ${q.description}`,
      `Scope: ${q.scope || "not provided"} · unit ${r.unit} · quantity ${r.net ?? "unknown"}`,
      `Method: ${q.method} · ${r.formula} · source: ${q.source || "not provided"}`,
      `Inputs (metres unless count): ${r.fields.map((k) => k + "=" + (q[k] || "not provided")).join(", ")}. Excluded ${r.deduction} ${r.unit}: ${q.deductionSource || "none stated"}.`,
      `Evidence: [${q.evidenceId}] · drawing: ${q.drawingId || "not provided"} · exclusion observation: ${q.exclusionId || "none"}`,
      `Billing entry: ${q.billQuantity || "not provided"} ${r.unit}; source: ${q.billSource || "not provided"}; draft minus entry: ${r.difference ?? "unknown"}. Rate: ${q.rate || "not provided"} ${q.currency || "currency not provided"}; calculated amount: ${r.amount ?? "unknown"}.`,
      `Missing: ${r.missing.join(", ") || "no arithmetic inputs missing; independent dimensional validation still required"}. ${r.limit}`,
      `Review: ${q.review} · reviewer ${q.reviewer || "not provided"} · validation basis ${q.validation || "not provided"} · assumptions ${q.assumptions || "not provided"}. ${GATE}`,
    );
  }
  lines.push("\n## Evidence register");
  for (const f of usedFrames)
    lines.push(
      `[${f.id}] ${f.date} ${f.time} · ${f.sourceFile}\nImage: ${f.url}\nSource: ${f.sourceUrl} · ${f.license} · ${f.credit}\nOriginal SHA-256: ${f.originalSha256}\n${f.alignment}`,
    );
  lines.push(
    "\n## Gaps and reviewer context",
    "Labor counts, weather, causes, safety compliance and events not shown by these records: not provided. No automated stage classification or defect confirmation was performed. Image observations cannot establish hidden thickness, reinforcement compliance or calibrated dimensions.",
    "Reviewer summary / blockers: not provided. Edit this draft before circulation.",
  );
  return {
    id: uid("doc"),
    type,
    title: `${type} · ${to}`,
    from,
    to,
    activityIds: [...activityIds],
    evidenceIds: [...evidence],
    body: lines.join("\n\n"),
    baselineDisclosure: baseline ? EXAMPLE : "Reviewer-entered baseline",
    snapshot: {
      activities: clone(selected),
      observations: clone(obs),
      quantities: clone(qs),
      drawings: clone(
        p.drawings.filter(
          (d) =>
            qs.some((q) => q.drawingId === d.id) ||
            d.marks.some((m) => evidence.has(m.evidenceId)),
        ),
      ),
    },
    review: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
