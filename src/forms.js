import { escapeHTML as h, EXAMPLE, GATE, STAGES, DOC_TYPES } from "./domain.js";
import {
  button,
  select,
  input,
  area,
  frameOptions,
  activityOptions,
} from "./views.js";
export function modalFrame(title, body, formName = "", submit = "Save record") {
  return `<div class="modal-head"><div><p class="eyebrow">SITECOMMIT / REVIEW</p><h2>${h(title)}</h2></div>${button("Close", "close-modal")}</div>${formName ? `<form id="${formName}">` : ""}<div class="modal-body">${body}<p class="form-error" id="form-error" role="alert"></p></div>${formName ? `<div class="modal-actions">${button("Cancel", "close-modal")}<button class="primary" type="submit">${submit}</button></div></form>` : ""}`;
}
export function observationForm(o, p, frames, region) {
  const r = region || o.region || [0.2, 0.2, 0.4, 0.4];
  return modalFrame(
    o.id ? "Edit observation" : "New site observation",
    `<input type="hidden" name="id" value="${h(o.id || "")}"><input type="hidden" name="modelAnchor" value="${h(o.modelAnchor ? JSON.stringify(o.modelAnchor) : "")}">${o.modelAnchor ? `<p class="disclosure">Saved 3D viewpoint · ${h(o.modelAnchor.date)} · ${h(o.modelAnchor.method)}. Source photo provides context; the point is not projected into this image. Keep its date unchanged, or create a separate observation.</p>` : ""}<div class="form-grid">${select("evidenceId", "Evidence image", frameOptions(frames, p), o.evidenceId || p.selectedEvidenceId)}${select("beforeEvidenceId", "Before image (optional)", [["", "Not linked"], ...frameOptions(frames, p)], o.beforeEvidenceId)}${select("activityId", "Work package", activityOptions(p), o.activityId)}${input("location", "Location / element", o.location || "", "text", "required")}${select("stage", "Visible stage", STAGES, o.stage || "Not established")}${select("kind", "Statement type", ["observation", "inference", "clutter", "sample"], o.kind || "observation")}${select("review", "Review state", ["unreviewed", "reviewed", "not enough evidence"], o.review || "unreviewed")}${input("author", "Reviewer / author", o.author || "", "text", "required")}${select("qaStatus", "QA/QC status", ["not applicable", "potential issue", "confirmed by reviewer", "resolved"], o.qaStatus || "not applicable")}${input("verification", "Verification basis (for confirmed issues)", o.verification || "")}</div>${area("note", "Observation / question / reviewer note", o.note || "", "required")}<label class="check"><input type="checkbox" name="hiddenWork" ${o.hiddenWork ? "checked" : ""}>Keep as a before-covering / hidden-work record</label><details open><summary>Image region · percent of frame</summary><div class="form-grid four">${["x", "y", "w", "h"].map((k, i) => input("region" + k, ["Left %", "Top %", "Width %", "Height %"][i], +(r[i] * 100).toFixed(2), "number", 'min="0" max="100" step="0.01" required')).join("")}</div></details><details><summary>Partial scope & dimension notes</summary><div class="form-grid">${select("partialMethod", "Partial-work basis", ["not provided", "entered scope", "human estimate"], o.partialMethod || "not provided")}${input("estimate", "Human estimate %", o.estimate ?? "", "number", 'min="0" max="100" step="0.1"')}${input("done", "Observed entered scope", o.done ?? "", "number", 'min="0" step="any"')}${input("total", "Total entered scope", o.total ?? "", "number", 'min="0" step="any"')}${input("dimensionNote", "Dimension label (only if known)", o.dimensionNote || "")}${input("dimensionSource", "Dimension source / drawing reference", o.dimensionSource || "")}</div><p class="small">Estimates are human entries. Regions and splats do not establish metric scale.</p></details>${o.kind === "sample" ? `<p class="disclosure">${EXAMPLE}</p>` : ""}`,
    "observation-form",
  );
}
export function activityForm(a = {}) {
  return modalFrame(
    a.id ? "Edit work package" : "Add work package",
    `<input type="hidden" name="id" value="${h(a.id || "")}"><div class="form-grid">${input("name", "Work package", a.name || "", "text", "required")}${input("location", "Location / floor / grid / element", a.location || "", "text", "required")}${input("start", "Baseline start", a.start || "", "date")}${input("end", "Target stage date", a.end || "", "date")}${select("targetStage", "Target stage", STAGES, a.targetStage || "Not established")}${input("scope", "Planned scope (blank = unknown)", a.scope ?? "", "number", 'min="0" step="any"')}${select("unit", "Scope unit", ["m³", "m²", "m", "no."], a.unit || "m³")}${input("baselineSource", "Baseline source", a.baselineSource || EXAMPLE, "text", "required")}</div>${input("reference", "Drawing / model reference or URL", a.reference || "")}<details><summary>Optional resource & cost context</summary><p class="small">Enter costs, not inferred workforce performance. Sum is shown only when all three costs are present.</p><div class="form-grid">${input("labor", "Entered labor cost", a.labor ?? "", "number", 'min="0" step="any"')}${input("equipment", "Entered equipment cost", a.equipment ?? "", "number", 'min="0" step="any"')}${input("material", "Entered material cost", a.material ?? "", "number", 'min="0" step="any"')}${input("budget", "Budget for same scope", a.budget ?? "", "number", 'min="0" step="any"')}${input("currency", "Currency", a.currency || "INR")}${input("resourceSource", "Cost source", a.resourceSource || "Not provided")}</div></details><p class="disclosure">Baseline source travels with every generated output. Leave the example label intact unless replacing it with a real source.</p>`,
    "activity-form",
  );
}
export function quantityForm(q, p, frames) {
  return modalFrame(
    q.id ? "Edit measurement draft" : "New measurement draft",
    `<input type="hidden" name="id" value="${h(q.id || "")}"><div class="form-grid">${input("description", "Item description", q.description || "", "text", "required")}${select(
      "type",
      "Quantity type",
      [
        ["volume", "Concrete / volume · m³"],
        ["area", "Plaster / surface area · m²"],
        ["length", "Pipe / running length · m"],
        ["opening", "Opening · m²"],
        ["count", "Count · no."],
      ],
      q.type || "volume",
    )}${select(
      "activityId",
      "Work package",
      p.activities.map((a) => [a.id, a.name]),
      q.activityId,
    )}${select("evidenceId", "Source image", frameOptions(frames, p), q.evidenceId || p.selectedEvidenceId)}${input("scope", "Scope / faces / elements included", q.scope || "", "text", "required")}${select("method", "Dimension method", ["unknown", "manually entered dimensions", "drawing-derived dimensions", "site-verified dimensions"], q.method || "unknown")}${input("source", "Dimension source / scale reference", q.source || "")}${select("drawingId", "Linked drawing", [["", "Not supplied"], ...p.drawings.map((d) => [d.id, d.name])], q.drawingId)}</div><div class="dimension-inputs form-grid four">${["length", "width", "height", "thickness", "count"].map((k) => input(k, k === "count" ? "Count" : k[0].toUpperCase() + k.slice(1) + " (m)", q[k] ?? "", "number", `min="0" step="any" data-dimension="${k}"`)).join("")}</div><p id="quantity-preview" class="calculation" aria-live="polite"></p><details open><summary>Clutter exclusion & billing comparison</summary><div class="form-grid">${select("exclusionId", "Excluded object / region", [["", "None linked"], ...p.observations.filter((o) => o.kind === "clutter").map((o) => [o.id, o.note.slice(0, 60)])], q.exclusionId)}${input("deduction", "Stated exclusion quantity (same unit)", q.deduction ?? "", "number", 'min="0" step="any"')}${input("deductionSource", "Exclusion quantity source", q.deductionSource || "")}${input("billQuantity", "Entered M-book / bill quantity", q.billQuantity ?? "", "number", 'min="0" step="any"')}${input("billSource", "Billing-entry source (example if seeded)", q.billSource || "")}${input("rate", "Entered rate / unit (optional)", q.rate ?? "", "number", 'min="0" step="any"')}${input("currency", "Currency", q.currency || "INR")}</div><p class="small">Masking clutter excludes it from visual scope only. A numeric deduction requires its own dimension source; pixels are not billable quantities.</p></details>${area("assumptions", "Assumptions / unknown faces / thickness", q.assumptions || "")}<div class="form-grid">${select("review", "Review gate", ["draft", "needs drawing", "needs site verification", "inputs checked — not approved"], q.review || "draft")}${input("reviewer", "Human reviewer", q.reviewer || "")}${input("validation", "Independent validation / check basis", q.validation || "")}</div><p class="gate small">${GATE}</p>`,
    "quantity-form",
    "Save quantity draft",
  );
}
export function documentForm(type, p, frames, old) {
  const days = frames
    .filter((f) => f.projectId === p.id)
    .map((f) => f.date)
    .sort();
  return modalFrame(
    old ? "Regenerate as a new draft" : "Generate a work product",
    `${select("type", "Document type", DOC_TYPES, type || "Progress report")}<div class="form-grid">${input("from", "Period from", old?.from || days[0] || "", "date", "required")}${input("to", "Period to", old?.to || days.at(-1) || "", "date", "required")}</div><fieldset><legend>Include work packages</legend>${p.activities.map((a) => `<label class="check"><input type="checkbox" name="activityIds" value="${h(a.id)}" ${!old || old.activityIds.includes(a.id) ? "checked" : ""}>${h(a.name)} · ${h(a.location)}</label>`).join("")}</fieldset><p class="small">Generated from saved records. Missing labor, weather, causes and dimensions remain “not provided”. Editing a draft does not change the original evidence.</p>`,
    "document-form",
    "Generate draft",
  );
}
export function drawingMarkForm(m, p, frames, region) {
  const r = region || m.region || [0.2, 0.2, 0.4, 0.4];
  return modalFrame(
    m.id ? "Edit drawing callout" : "New drawing callout",
    `<input type="hidden" name="id" value="${h(m.id || "")}">${input("label", "Callout / work area", m.label || "", "text", "required")}<div class="form-grid">${select("evidenceId", "Related site photograph", frameOptions(frames, p), m.evidenceId || p.selectedEvidenceId)}${select("activityId", "Work package", activityOptions(p), m.activityId)}${input("dimensionNote", "Known dimension / scale label", m.dimensionNote || "")}${input("dimensionSource", "Dimension source (drawing / manual / site)", m.dimensionSource || "")}</div><div class="form-grid four">${["x", "y", "w", "h"].map((k, i) => input("region" + k, ["Left %", "Top %", "Width %", "Height %"][i], +(r[i] * 100).toFixed(2), "number", 'min="0" max="100" step="0.01" required')).join("")}</div><p class="disclosure">Drawing callouts are reviewer-authored. A dimension on an illustrative sketch remains an illustrative or manually entered value.</p>`,
    "drawing-mark-form",
  );
}
