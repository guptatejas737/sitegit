import {
  escapeHTML as h,
  EXAMPLE,
  GATE,
  STAGES,
  DOC_TYPES,
  activityStatus,
  quantityResult,
  percentComplete,
  resources,
} from "./domain.js";
export const button = (label, action, id = "", cls = "") =>
  `<button type="button" class="${cls}" data-action="${action}" data-id="${h(id)}">${label}</button>`;
const option = (v, label, selected) =>
  `<option value="${h(v)}" ${String(v) === String(selected) ? "selected" : ""}>${h(label)}</option>`;
export const select = (name, label, items, value, attrs = "") =>
  `<label>${label}<select name="${name}" ${attrs}>${items.map((x) => option(Array.isArray(x) ? x[0] : x, Array.isArray(x) ? x[1] : x, value)).join("")}</select></label>`;
export const input = (name, label, value = "", type = "text", attrs = "") =>
  `<label>${label}<input name="${name}" type="${type}" value="${h(value)}" ${attrs}></label>`;
export const area = (name, label, value = "", attrs = "") =>
  `<label>${label}<textarea name="${name}" ${attrs}>${h(value)}</textarea></label>`;
export const badge = (text, kind = "") =>
  `<span class="badge ${kind}">${h(text)}</span>`;
const example = (p) =>
  p.activities.some((a) => a.baselineSource === EXAMPLE)
    ? `<p class="disclosure"><span class="example-dot"></span>${EXAMPLE} · Plan only. Photographs are real.</p>`
    : "";
export const frameOptions = (frames, p) =>
  frames
    .filter((f) => f.projectId === p.id)
    .map((f) => [f.id, `${f.date} · view ${f.view} · ${f.id}`]);
export const activityOptions = (p) => [
  ["", "Unmapped / off-sequence"],
  ...p.activities.map((a) => [a.id, `${a.name} · ${a.location}`]),
];
function sketch(p, ui, catalog) {
  const f = catalog.frames.find((f) => f.id === p.selectedEvidenceId),
    d = p.drawings.find((d) => d.id === ui.drawingId);
  const marks = d
    ? d.marks
    : p.observations.filter((o) => o.evidenceId === f?.id);
  const fake = d
    ? {
        id: d.id,
        url: d.data,
        width: d.width || 1400,
        height: d.height || 900,
        date: f?.date || "",
      }
    : f;
  return (
    heading(
      "PROJECT / SKETCH & MARKUP",
      "Sketch & markup",
      "Mark an area, link the work item, and enter dimensions with their source.",
      button("Attach drawing image", "attach-drawing") +
        button("Example sketch", "example-sketch") +
        button("Export annotated PNG", "export-sheet", "", "primary"),
    ) +
    `<div class="sketch-toolbar">${select("drawing", "Canvas", [["", "Selected source photograph"], ...p.drawings.map((d) => [d.id, d.name])], ui.drawingId, 'id="drawing-select"')}${d ? badge(d.origin || "Reviewer-attached drawing") : badge("Real source photograph")}${button("Add area callout", "mark-region")}</div>${d?.origin === EXAMPLE ? `<p class="disclosure">${EXAMPLE} · Not to scale. No original site drawing is implied.</p>` : ""}${fake ? `<section class="panel sketch-panel">${imageMarkup(fake, marks, true)}</section>` : '<p class="empty">Choose a dated source photograph first.</p>'}<p class="small">Drag a rectangle to add a callout, or use “Add callout with coordinates” for keyboard entry. Pixel regions never become metres automatically.</p>${button("Add callout with coordinates", d ? "new-drawing-mark" : "new-observation")}<div class="observation-grid">${d ? marks.map((m, i) => `<article class="panel padded"><h3>${i + 1}. ${h(m.label)}</h3><p>${h(m.dimensionNote || "Dimensions not provided")} · ${h(m.dimensionSource || "source not provided")}</p><p>Evidence: ${h(m.evidenceId)} · ${h(m.activityId)}</p>${button("Edit callout", "edit-drawing-mark", m.id)}</article>`).join("") : marks.map((o) => observationCard(o, p, catalog.frames)).join("")}</div>`
  );
}
function documents(p, ui, catalog) {
  const doc = p.documents.find((d) => d.id === ui.docId) || p.documents.at(-1);
  return (
    heading(
      "PROJECT / DOCUMENTS",
      "Documents",
      "Generate from saved evidence, edit the draft, and export a traceable snapshot.",
      button("Generate document", "new-document", "", "primary"),
    ) +
    `<div class="document-layout"><aside class="panel document-list"><h2>Saved drafts <span class="mono">${p.documents.length}</span></h2>${p.documents.map((d) => `<button data-action="select-doc" data-id="${d.id}" ${d.id === doc?.id ? 'aria-current="true"' : ""}><strong>${h(d.title)}</strong><span>${h(d.type)} · ${h(d.review)}</span><small>${h(d.updatedAt.slice(0, 16).replace("T", " "))}</small></button>`).join("") || '<p class="empty">Reports you generate will stay here after refresh.</p>'}<div class="document-types">${DOC_TYPES.map((t) => button(t, "new-document", t, "wide")).join("")}</div></aside>${
      doc
        ? `<section class="panel document-editor"><div class="panel-head"><div><h2>${h(doc.title)}</h2><span class="mono">SAVED SNAPSHOT · DRAFT</span></div>${button("Regenerate", "regenerate-doc", doc.id)}</div><p class="disclosure">${h(doc.baselineDisclosure)}</p><label class="doc-body-label">Editable document<textarea id="document-body" data-doc-id="${doc.id}" spellcheck="true">${h(doc.body)}</textarea></label><div class="document-actions row wrap">${button("Save edits", "save-doc", doc.id, "primary")}${button("Download HTML", "export-html", doc.id)}${button("Download Markdown", "export-md", doc.id)}${button("Evidence package (.zip)", "export-package", doc.id)}</div><details open class="source-details"><summary>Evidence cited by this snapshot · ${doc.evidenceIds.length}</summary><div class="evidence-links">${doc.evidenceIds
            .map((id) => {
              const f = catalog.frames.find((f) => f.id === id);
              return f
                ? `<button data-action="show-evidence" data-id="${id}"><img src="${h(f.url)}" alt=""><span>${h(f.date)}<small>${h(id)}</small></span></button>`
                : "";
            })
            .join(
              "",
            )}</div></details><p class="small">Regeneration creates a new draft; it preserves this edited version. HTML includes source frames and can be printed to PDF. ZIP includes an offline review page, images, plan, quantity CSV and provenance.</p></section>`
        : `<section class="panel empty"><p class="eyebrow">EVIDENCE → DOCUMENT</p><h2>Start with a progress report.</h2><p>Choose a period and work packages. The report cites your saved observations and keeps unknown quantities unknown.</p>${button("Create progress report", "new-document", "Progress report", "primary")}</section>`
    }</div>`
  );
}
function review(p, ui, catalog) {
  const obs = filteredObs(p, ui),
    locs = [...new Set(obs.map((o) => o.location))];
  return (
    heading(
      "PROJECT / REMOTE REVIEW",
      "Remote review",
      "Review by area or package. Before-covering notes remain retrievable alongside later captures.",
      button("Make QA/QC report", "new-document", "QA/QC report") +
        button(
          "Hidden-work pack",
          "new-document",
          "Hidden-work pack",
          "primary",
        ),
    ) +
    example(p) +
    filters(p, ui) +
    `<div class="review-summary">${p.activities
      .map((a) => {
        const s = activityStatus(a, p.observations, catalog.frames);
        return `<article class="panel padded"><p class="eyebrow">${h(a.location)}</p><h3>${h(a.name)}</h3>${badge(s.label)}<p>${h(s.note)}</p>${button("Open package evidence", "activity-evidence", a.id)}</article>`;
      })
      .join("")}</div>${
      locs
        .map(
          (loc) =>
            `<section class="section"><h2>${h(loc)}</h2><div class="observation-grid">${obs
              .filter((o) => o.location === loc)
              .map((o) => {
                const f = catalog.frames.find((f) => f.id === o.evidenceId),
                  later = catalog.frames
                    .filter(
                      (f) =>
                        f.projectId === p.id &&
                        f.date >
                          (catalog.frames.find((x) => x.id === o.evidenceId)
                            ?.date || ""),
                    )
                    .at(-1);
                return `<div>${f ? `<button class="review-photo" data-action="show-evidence" data-id="${f.id}"><img src="${h(f.url)}" alt="${h(f.date + " source evidence")}"></button>` : ""}${observationCard(o, p, catalog.frames)}${o.hiddenWork && later ? button("Retrieve beside later evidence · " + later.date, "retrieve-hidden", o.id, "wide") : ""}</div>`;
              })
              .join("")}</div></section>`,
        )
        .join("") || '<p class="empty">No observations in this selection.</p>'
    }`
  );
}
export function shell(p, state, ui, catalog) {
  const nav = [
    ["evidence", "Evidence & observations", "01"],
    ["plan", "Work plan", "02"],
    ["quantities", "Quantity review", "03"],
    ["sketch", "Sketch & markup", "04"],
    ["documents", "Documents", "05"],
    ["review", "Remote review", "06"],
  ];
  return `<aside class="sidebar"><a class="wordmark" href="#evidence">sitecommit<span class="brand-dot"></span></a><button class="project-switch" data-action="projects"><span class="mono">PROJECT</span><strong>${h(p.shortName || p.name)}</strong><span>Switch project ↗</span></button><nav aria-label="Workspace">${nav.map(([id, label, num]) => `<button data-action="navigate" data-id="${id}" ${ui.page === id ? 'aria-current="page"' : ""}><span class="nav-number">${num}</span>${label}${id === "documents" ? `<small>${p.documents.length}</small>` : ""}</button>`).join("")}</nav><div class="sidebar-bottom"><span class="local-dot"></span> Local workspace<p>Saved on this browser.<br>Export a backup to move devices.</p><div class="row">${button("Backup", "backup")}${button("Restore", "restore")}</div></div></aside><div class="workspace"><header class="topbar"><div class="breadcrumb">${button("Projects", "projects")}<span>/</span><span>${h(p.shortName || p.name)}</span></div><div class="row"><span class="saved" id="save-state">${state.savedAt ? "Saved locally" : "Ready to review"}</span>${button("Sources", "sources")}</div></header><main id="main" tabindex="-1">${ui.page === "evidence" ? evidence(p, ui, catalog) : ui.page === "plan" ? plan(p, ui, catalog) : ui.page === "quantities" ? quantities(p, ui, catalog) : ui.page === "sketch" ? sketch(p, ui, catalog) : ui.page === "documents" ? documents(p, ui, catalog) : review(p, ui, catalog)}</main><footer>SiteCommit · Evidence before conclusions. <span>Phone / 360 / LiDAR / drone records can feed this workflow.</span></footer></div>`;
}
const heading = (eyebrow, title, desc, actions = "") =>
  `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="subtle">${desc}</p></div><div class="row actions">${actions}</div></div>`;
function filters(p, ui) {
  return `<div class="filters">${select(
    "activityFilter",
    "Work package",
    activityOptions(p).map((x, i) => (i === 0 ? ["", "All work packages"] : x)),
    ui.activityFilter,
    'data-filter="activityFilter"',
  )}${input("locationFilter", "Area / element", ui.locationFilter || "", "search", 'placeholder="Filter locations" data-filter="locationFilter"')}<label class="check"><input type="checkbox" data-filter="hiddenOnly" ${ui.hiddenOnly ? "checked" : ""}>Before-covering records</label></div>`;
}
function filteredObs(p, ui) {
  return p.observations.filter(
    (o) =>
      (!ui.activityFilter || o.activityId === ui.activityFilter) &&
      (!ui.locationFilter ||
        o.location.toLowerCase().includes(ui.locationFilter.toLowerCase())) &&
      (!ui.hiddenOnly || o.hiddenWork),
  );
}
export function imageMarkup(f, marks = [], editable = false) {
  const w = 1000,
    height = (1000 * f.height) / f.width;
  return `<div class="image-surface ${editable ? "markable" : ""}" id="image-surface" data-frame-id="${h(f.id)}" style="aspect-ratio:${f.width}/${f.height}"><img src="${h(f.url)}" alt="${h(f.date + " construction site · " + f.id)}" draggable="false"><svg id="image-overlay" viewBox="0 0 ${w} ${height}" aria-label="Saved observation regions">${marks.map((m, i) => `<g><rect x="${m.region[0] * w}" y="${m.region[1] * height}" width="${m.region[2] * w}" height="${m.region[3] * height}" class="${m.kind === "clutter" ? "clutter-mask" : "region"}"/><text x="${m.region[0] * w + 8}" y="${m.region[1] * height + 24}">${i + 1}</text></g>`).join("")}<rect id="pending-region" class="region pending" visibility="hidden"/></svg></div>`;
}
function observationCard(o, p, frames) {
  const f = frames.find((f) => f.id === o.evidenceId),
    a = p.activities.find((a) => a.id === o.activityId),
    pc = percentComplete(o);
  return `<article class="observation-card"><div class="row spread"><span class="mono">${h(f?.date || "Unknown date")} · ${h(o.location)}</span>${badge(o.kind === "sample" ? "Sample annotation" : o.kind, o.kind === "sample" ? "sample" : "")}</div><h3>${h(o.stage)}${o.hiddenWork ? ' <span class="hidden-tag">BEFORE COVERING</span>' : ""}</h3><p>${h(o.note)}</p><div class="row wrap">${badge(o.review)}${o.qaStatus !== "not applicable" ? badge(o.qaStatus) : ""}${pc ? badge(pc.value.toFixed(1) + "% · " + pc.label) : ""}</div><p class="meta">${h(a?.name || "Unmapped / off-sequence")} · ${h(o.author)}${o.kind === "sample" ? " · " + EXAMPLE : ""}</p><div class="row">${button("View evidence", "show-evidence", o.evidenceId)}${button("Edit record", "edit-observation", o.id)}</div></article>`;
}
function evidence(p, ui, catalog) {
  const frames = catalog.frames.filter((f) => f.projectId === p.id),
    f = frames.find((f) => f.id === p.selectedEvidenceId) || frames.at(-1),
    before = frames.find((f) => f.id === p.beforeEvidenceId) || frames[0];
  if (!f)
    return heading(
      "PROJECT / EVIDENCE",
      "No dated evidence yet",
      "This project is separate from the public examples. Add verified source records in the catalog before reviewing it.",
      button("View projects", "projects"),
    );
  const dates = [...new Set(frames.map((f) => f.date))].sort(),
    di = dates.indexOf(f.date);
  const obs = filteredObs(p, ui),
    onFrame = obs.filter((o) => o.evidenceId === f.id);
  return (
    heading(
      "PROJECT / EVIDENCE",
      "Site evidence",
      "Connect a dated site record to a work package, location and review decision.",
      button("New observation", "new-observation", "", "primary"),
    ) +
    example(p) +
    `<div class="evidence-layout"><section class="panel evidence-panel"><div class="panel-head"><div><strong>${h(f.date)}</strong><span class="subtle"> / View ${f.view} · real source photo</span></div><div class="row">${button(ui.compare ? "Single view" : "Compare dates", "toggle-compare")}${p.splatDates?.length ? '<a class="button" href="./survey.html" target="_blank" rel="noopener">3D surveys ↗</a>' : ""}</div></div>${ui.compare ? `<div class="compare-controls">${select("before", "Before record", frameOptions(catalog.frames, p), before.id, 'id="before-select"')}<p>Independent viewpoints; no exact image or geometric alignment is implied.</p></div><div class="photo-compare"><figure><img src="${h(before.url)}" alt="Before ${h(before.date)}"><figcaption>${h(before.date)} · <a href="${h(before.url)}" target="_blank">Open source frame</a></figcaption></figure><figure><img src="${h(f.url)}" alt="After ${h(f.date)}"><figcaption>${h(f.date)} · <a href="${h(f.url)}" target="_blank">Open source frame</a></figcaption></figure></div>` : imageMarkup(f, onFrame, true)}<div class="image-toolbar"><div class="row">${button(ui.drawingRegion ? "Drag a region…" : "Mark a region", "mark-region", "", "quiet")}${button("Export evidence sheet", "export-sheet")}</div><span class="mono">${h(f.id)}</span></div><div class="timeline"><div class="row spread"><label for="date-slider">Capture history</label><span class="mono">${dates.length} ACTUAL DATES</span></div><input id="date-slider" type="range" min="0" max="${dates.length - 1}" step="1" value="${di}" aria-label="Capture date" aria-valuetext="${f.date}"><div class="date-chips">${dates.map((d) => `<button data-action="date" data-id="${d}" ${d === f.date ? 'aria-current="date"' : ""}>${d.slice(5)}</button>`).join("")}</div><div class="thumb-strip">${frames
      .filter((x) => x.date === f.date)
      .map(
        (x) =>
          `<button class="thumb" data-action="show-evidence" data-id="${x.id}" aria-label="View ${x.view} on ${x.date}" ${x.id === f.id ? 'aria-pressed="true"' : ""}><img src="${h(x.url)}" alt=""><span>View ${x.view}</span></button>`,
      )
      .join(
        "",
      )}</div></div><details class="source-details"><summary>Source & interpretation limits</summary><p>${h(f.alignment)}</p><a href="${h(f.url)}" target="_blank">Open this image</a> · <a href="${h(f.sourceUrl)}" target="_blank" rel="noopener">Original dataset</a><p>${h(f.sourceFile)}<br>${h(f.credit)} · ${h(f.license)}</p><p class="hash">Original SHA-256: ${h(f.originalSha256)}</p></details></section><aside class="review-rail"><div class="rail-heading"><p class="eyebrow">REVIEW DESK</p><h2>From evidence to decision</h2><p>Stages are tagged by a reviewer. Nothing is automatically classified.</p></div><ol class="workflow"><li><b>01</b><span>Mark the relevant work area.</span></li><li><b>02</b><span>Link a package, stage and location.</span></li><li><b>03</b><span>Review inputs, then make a draft.</span></li></ol><div class="rail-stat"><strong>${onFrame.length.toString().padStart(2, "0")}</strong><span>notes on this frame</span></div>${onFrame.map((o) => `<button class="rail-note" data-action="edit-observation" data-id="${o.id}"><span class="mono">${h(o.kind === "sample" ? "SAMPLE ANNOTATION" : o.review)}</span><strong>${h(o.stage)}</strong><span>${h(o.location)}</span></button>`).join("")}${button("Generate progress report", "new-document", "Progress report", "wide")}<p class="small">The example plan is editable. No project-owner schedule was supplied.</p></aside></div><section class="section"><div class="row spread"><h2>Observation register</h2><span class="mono">${p.observations.length} SAVED RECORDS</span></div>${filters(p, ui)}<div class="observation-grid">${obs.length ? obs.map((o) => observationCard(o, p, catalog.frames)).join("") : '<p class="empty">No matching records. Mark an image region to start a review.</p>'}</div></section>`
  );
}
function plan(p, ui, catalog) {
  return (
    heading(
      "PROJECT / PLAN",
      "Work plan",
      "Compare the first reviewed stage evidence with a stated target. Missing evidence stays unknown.",
      button("Import CSV", "import-plan") +
        button("Export CSV", "export-plan") +
        button("Add work package", "new-activity", "", "primary"),
    ) +
    example(p) +
    `<div class="table-wrap panel"><table><thead><tr><th>Work package / location</th><th>Baseline → target</th><th>Target stage / scope</th><th>Evidence vs target</th><th>Review</th></tr></thead><tbody>${p.activities
      .map((a) => {
        const s = activityStatus(a, p.observations, catalog.frames);
        return `<tr><td><strong>${h(a.name)}</strong><span>${h(a.location)}</span><small>${h(a.baselineSource)}</small></td><td>${h(a.start || "Not provided")}<span>→ ${h(a.end || "Not provided")}</span></td><td>${h(a.targetStage)}<span>${h(a.scope || "Scope unknown")} ${h(a.scope ? a.unit : "")}</span></td><td>${badge(s.label)}<span>${h(s.date || "No reviewed stage evidence")}</span>${s.sample ? "<small>Based on illustrative annotation</small>" : ""}</td><td><div class="row wrap">${button("Edit", "edit-activity", a.id)}${button("Evidence", "activity-evidence", a.id)}</div><details><summary>Why this status?</summary><p>${h(s.note)}</p><p>Baseline source: ${h(a.baselineSource)}</p><p>Entered resource costs: ${resources(a).total ?? "unknown"} ${h(a.currency || "currency not supplied")} · cost minus budget: ${resources(a).variance ?? "unknown"} · source: ${h(a.resourceSource || "not provided")}</p>${s.evidence.map((o) => button("Open cited image", "show-evidence", o.evidenceId)).join("")}</details></td></tr>`;
      })
      .join(
        "",
      )}</tbody></table></div><div class="split-notes"><section class="panel padded"><p class="eyebrow">WHAT THE DATES MEAN</p><h2>Observed is not completed.</h2><p>Variance is capture date minus target date, using calendar days. A reviewed concrete-stage image does not prove completion of every face, level or finish.</p></section><section class="panel padded"><p class="eyebrow">WORK OUTSIDE THE PLAN</p><h2>Review by place, too.</h2><p>Unmapped records remain visible in the observation register and remote review. No BIM is needed.</p>${button("Review by area", "navigate", "review")}</section></div>`
  );
}
function quantities(p, ui, catalog) {
  return (
    heading(
      "PROJECT / QUANTITY REVIEW",
      "Quantity review",
      "Entered dimensions support arithmetic. Photographs establish context, not measurement accuracy.",
      button("Export quantity CSV", "export-quantities") +
        button("New measurement draft", "new-quantity", "", "primary"),
    ) +
    example(p) +
    `<div class="gate"><strong>Human validation gate</strong><p>${GATE}</p></div><div class="quantity-list">${
      p.quantities.length
        ? p.quantities
            .map((q) => {
              const r = quantityResult(q),
                a = p.activities.find((a) => a.id === q.activityId);
              return `<article class="panel quantity-card"><div class="row spread"><div><p class="eyebrow">${h(a?.name || "Unmapped")} / ${h(q.review)}</p><h2>${h(q.description)}</h2></div><div class="quantity-value">${r.net === null ? "Unknown" : r.net.toFixed(3)}<small>${r.unit}</small></div></div><p>${h(q.scope || "Scope not provided")}</p><div class="quantity-meta"><div><span>METHOD / INPUT SOURCE</span><strong>${h(q.method)}</strong><p>${h(q.source || "Not provided")}</p></div><div><span>GROSS − EXCLUSION</span><strong>${r.gross === null ? "Unknown" : r.gross.toFixed(3)} − ${r.deduction} ${r.unit}</strong><p>${h(q.deductionSource || "No exclusion stated")}</p></div><div><span>ENTERED BILLING COMPARISON</span><strong>${q.billQuantity === "" ? "Not provided" : h(q.billQuantity)} ${r.unit}</strong><p>Draft − entry: ${r.difference === null ? "unknown" : r.difference.toFixed(3) + " " + r.unit} · ${h(q.billSource || "source not provided")}</p></div></div>${r.missing.length ? `<p class="missing">Needs input: ${h(r.missing.join(", "))}</p>` : `<p class="small">Arithmetic complete. ${h(r.limit)}</p>`}<div class="row wrap">${button("Edit / review inputs", "edit-quantity", q.id)}${button("Source evidence", "show-evidence", q.evidenceId)}${button("Make M-book draft", "new-document", "M-book draft")}</div></article>`;
            })
            .join("")
        : `<div class="empty panel"><h2>No quantity is assumed.</h2><p>Start a concrete, plaster, pipe, count or opening line. Unknown dimensions remain blank, and incomplete lines export as unknown.</p>${button("Create first quantity draft", "new-quantity", "", "primary")}</div>`
    }</div>`
  );
}
