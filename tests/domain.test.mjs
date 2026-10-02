import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  EXAMPLE,
  GATE,
  validDate,
  dateDifference,
  quantityResult,
  percentComplete,
  activityStatus,
  validateActivity,
  validateObservation,
  seedState,
  saveState,
  loadState,
  validateState,
  clone,
  csv,
  parseCSV,
  importPlan,
  PLAN_COLUMNS,
  generateDocument,
  resources,
} from "../src/domain.js";
import { fileStem, reportHTML, evidencePackage } from "../src/exports.js";
import { unzipSync, strFromU8 } from "fflate";
const base = new URL("../public/", import.meta.url),
  c = JSON.parse(
    await readFile(new URL("data/evidence/catalog.json", base), "utf8"),
  ),
  mt = JSON.parse(
    await readFile(new URL("data/evidence/montijo.json", base), "utf8"),
  );
const catalog = {
  projects: [...c.projects, mt.project],
  frames: [...c.frames, ...mt.frames],
};
const project = () => seedState(catalog).projects[0];
const observation = (p, patch = {}) => ({
  ...p.observations[0],
  id: "test-observation",
  kind: "observation",
  evidenceId: "iv-2024-11-27-1",
  review: "reviewed",
  stage: "Concrete",
  qaStatus: "potential issue",
  author: "Test reviewer",
  note: "Concrete visible; hidden dimensions need verification.",
  ...patch,
});
test("calendar arithmetic rejects invalid dates and uses days across month/year boundaries", () => {
  assert(validDate("2024-02-29"));
  assert(!validDate("2025-02-29"));
  assert(!validDate("2025-99-99"));
  assert(!validDate(""));
  assert.equal(dateDifference("2025-01-01", "2024-12-30"), 2);
  assert.equal(dateDifference("2024-10-18", "2024-10-20"), -2);
  assert.equal(dateDifference("", "2024-10-20"), null);
});
test("schedule does not infer completion/delay from missing, inferred or unreviewed evidence", () => {
  const p = project(),
    a = { ...p.activities[1], end: "2024-11-20" };
  assert.equal(activityStatus(a, [], catalog.frames).days, null);
  assert.equal(
    activityStatus(
      a,
      [observation(p, { review: "unreviewed" })],
      catalog.frames,
    ).days,
    null,
  );
  assert.equal(
    activityStatus(a, [observation(p, { kind: "inference" })], catalog.frames)
      .days,
    null,
  );
  const s = activityStatus(a, [observation(p)], catalog.frames);
  assert.equal(s.days, 7);
  assert.equal(s.date, "2024-11-27");
  assert.match(s.note, /completion date may be earlier/);
});
test("baseline and observation validation reject unsupported dates, cross-site mappings and unsupported defect confirmation", () => {
  const p = project();
  assert.throws(() =>
    validateActivity({
      ...p.activities[0],
      start: "2024-12-01",
      end: "2024-10-01",
    }),
  );
  assert.throws(() =>
    validateActivity({ ...p.activities[0], baselineSource: "" }),
  );
  assert.throws(() =>
    validateObservation(
      observation(p, { evidenceId: mt.frames[0].id }),
      p,
      catalog.frames,
    ),
  );
  assert.throws(() =>
    validateObservation(
      observation(p, { qaStatus: "confirmed by reviewer", verification: "" }),
      p,
      catalog.frames,
    ),
  );
  assert.throws(() =>
    validateObservation(
      observation(p, { region: [0.8, 0.8, 0.5, 0.5] }),
      p,
      catalog.frames,
    ),
  );
  assert.doesNotThrow(() =>
    validateObservation(observation(p), p, catalog.frames),
  );
});
test("partial percentages require an explicit method, scope or human estimate", () => {
  assert.equal(percentComplete({}), null);
  assert.deepEqual(
    percentComplete({ partialMethod: "entered scope", done: "2", total: "8" }),
    { value: 25, label: "Entered scope: 2/8" },
  );
  assert.equal(
    percentComplete({ partialMethod: "entered scope", done: 10, total: 8 }),
    null,
  );
  assert.equal(
    percentComplete({ partialMethod: "human estimate", estimate: 120 }),
    null,
  );
  assert.match(
    percentComplete({ partialMethod: "human estimate", estimate: 50 }).label,
    /Human estimate/,
  );
});
const q = {
  type: "volume",
  length: "10",
  width: "2",
  thickness: ".2",
  method: "manually entered dimensions",
  source: "Reviewer entered for test; site verification pending",
  evidenceId: "iv-2024-11-27-1",
  deduction: ".5",
  deductionSource: "Stated temporary-material exclusion, manual test",
  billQuantity: "4",
  billSource: EXAMPLE,
  rate: "100",
  currency: "INR",
};
test("quantity formulas preserve dimensional units and expose missing thickness", () => {
  const r = quantityResult(q);
  assert.equal(r.unit, "m³");
  assert.equal(r.gross, 4);
  assert.equal(r.net, 3.5);
  assert.equal(r.difference, -0.5);
  assert.equal(r.amount, 350);
  assert.equal(quantityResult({ ...q, thickness: "" }).net, null);
  assert(
    quantityResult({ ...q, thickness: "" }).missing.includes("thickness (> 0)"),
  );
  assert.equal(
    quantityResult({ ...q, type: "area", length: 5, height: 3, deduction: 0 })
      .net,
    15,
  );
  assert.equal(
    quantityResult({ ...q, type: "opening", width: 2, height: 3, deduction: 0 })
      .unit,
    "m²",
  );
  assert.equal(
    quantityResult({ ...q, type: "length", length: 8, deduction: 0 }).unit,
    "m",
  );
  assert.equal(
    quantityResult({ ...q, type: "count", count: 7, deduction: 0 }).net,
    7,
  );
});
test("exclusions and dimension-source claims cannot fabricate calibrated scope", () => {
  assert.equal(quantityResult({ ...q, source: "" }).net, null);
  assert.equal(quantityResult({ ...q, deduction: 100 }).net, null);
  assert.equal(quantityResult({ ...q, deductionSource: "" }).net, null);
  assert.equal(quantityResult({ ...q, length: -3 }).net, null);
  assert.equal(quantityResult({ ...q, method: "unknown" }).net, null);
  assert.equal(
    quantityResult({
      ...q,
      method: "drawing-derived dimensions",
      drawingId: "",
    }).net,
    null,
  );
  assert.equal(
    quantityResult({
      ...q,
      method: "site-verified dimensions",
      reviewer: "",
      validation: "",
    }).net,
    null,
  );
  assert.equal(quantityResult({ ...q, billSource: "" }).difference, null);
});
test("resource sums only use fully entered costs in one stated context", () => {
  assert.deepEqual(
    resources({ labor: "20", equipment: "30", material: "50", budget: "90" }),
    { total: 100, variance: 10 },
  );
  assert.equal(
    resources({ labor: 20, equipment: "", material: 50 }).total,
    null,
  );
});
test("CSV survives commas, quotes, newlines and prevents formula injection", () => {
  const text = csv(
    [{ name: 'Wall, zone "A"\nlevel 1', source: '=HYPERLINK("evil")' }],
    ["name", "source"],
  );
  const rows = parseCSV(text);
  assert.equal(rows[0].name, 'Wall, zone "A"\nlevel 1');
  assert(rows[0].source.startsWith("'="));
  assert.throws(() => parseCSV('"unclosed'));
  const p = project();
  assert.equal(importPlan(csv(p.activities, PLAN_COLUMNS), p).length, 3);
  assert.throws(() => importPlan("name,location\nA,B", p));
});
test("save/reload retains observations, dimensions, drawn links and edited reports separately by project", () => {
  const state = seedState(catalog),
    p = state.projects[0];
  p.observations.push(observation(p, { hiddenWork: true }));
  p.quantities.push({ ...q, id: "q1", activityId: p.activities[1].id });
  p.drawings.push({
    id: "drawing1",
    name: "Test drawing",
    data: "data:image/png;base64,AAAA",
    marks: [{ evidenceId: p.selectedEvidenceId, region: [0.1, 0.1, 0.2, 0.2] }],
  });
  const d = generateDocument(
    p,
    catalog.frames,
    "Progress report",
    "2024-09-27",
    "2024-12-07",
    p.activities.map((a) => a.id),
  );
  d.body += "\nHuman edit retained.";
  p.documents.push(d);
  const map = new Map(),
    storage = { setItem: (k, v) => map.set(k, v), getItem: (k) => map.get(k) };
  saveState(storage, state);
  const loaded = loadState(storage, catalog);
  assert.equal(loaded.projects[0].observations.at(-1).hiddenWork, true);
  assert.match(loaded.projects[0].documents[0].body, /Human edit retained/);
  assert.equal(loaded.projects[1].quantities.length, 0);
  assert.throws(
    () =>
      saveState(
        {
          setItem: () => {
            throw Error("quota");
          },
        },
        state,
      ),
    /quota/,
  );
  assert.throws(() => validateState({ ...state, version: 9 }, catalog));
});
test("all generated output types retain disclosure, evidence and draft gate without invented measurements", () => {
  const p = project();
  p.observations.push(observation(p, { hiddenWork: true }));
  p.quantities.push({
    ...q,
    id: "q1",
    description: "Concrete test scope",
    activityId: p.activities[1].id,
    review: "draft",
    thickness: "",
  });
  for (const type of [
    "Progress report",
    "Site diary",
    "M-book draft",
    "QA/QC report",
    "Hidden-work pack",
    "Progress evidence package",
  ]) {
    const doc = generateDocument(
      p,
      catalog.frames,
      type,
      "2024-09-27",
      "2024-12-07",
      p.activities.map((a) => a.id),
    );
    assert(doc.body.includes(GATE));
    assert(doc.body.includes(EXAMPLE));
    assert(doc.body.includes("iv-2024-11-27-1"));
    assert(doc.body.includes("Original SHA-256"));
    assert(doc.body.includes("quantity unknown"));
    assert(!doc.body.includes("100% complete"));
    assert.equal(doc.review, "draft");
  }
  assert.throws(() =>
    generateDocument(
      p,
      catalog.frames,
      "Progress report",
      "2024-12-07",
      "2024-01-01",
      [],
    ),
  );
});
test("document status citations from outside reporting period are included, regeneration preserves edits", () => {
  const p = project();
  p.observations.push(observation(p));
  const d = generateDocument(
    p,
    catalog.frames,
    "Progress report",
    "2024-12-03",
    "2024-12-07",
    [p.activities[1].id],
  );
  assert(d.evidenceIds.includes("iv-2024-11-27-1"));
  d.body += "\nEdited draft";
  const second = generateDocument(
    p,
    catalog.frames,
    d.type,
    d.from,
    d.to,
    d.activityIds,
  );
  assert.notEqual(second.id, d.id);
  assert(d.body.endsWith("Edited draft"));
});
test("downloaded evidence ZIP contains exact source bytes, CSV, review HTML and provenance; HTML escapes reviewer text", async () => {
  const p = project();
  p.observations = [observation(p)];
  const doc = generateDocument(
    p,
    catalog.frames,
    "Progress report",
    "2024-11-27",
    "2024-11-27",
    [p.activities[1].id],
  );
  doc.body += "<script>alert(1)</script>";
  const originalFetch = globalThis.fetch;
  globalThis.location = { href: "http://localhost:4173/" };
  globalThis.fetch = async (url) =>
    new Response(await readFile(new URL(url, base)));
  try {
    const bytes = await evidencePackage(doc, p, catalog.frames);
    const zip = unzipSync(bytes);
    assert(zip["review.html"]);
    assert(zip["plan.csv"]);
    assert(zip["evidence/iv-2024-11-27-1.webp"]);
    const html = strFromU8(zip["review.html"]);
    assert(html.includes("&lt;script&gt;"));
    assert(!html.includes("<script>alert"));
    assert(html.includes("evidence/iv-2024-11-27-1.webp"));
    const source = JSON.parse(strFromU8(zip["evidence/provenance.json"]));
    assert.equal(source[0].projectId, "ivision");
    assert.deepEqual(
      Buffer.from(zip["evidence/iv-2024-11-27-1.webp"]),
      await readFile(
        new URL(
          catalog.frames.find((f) => f.id === "iv-2024-11-27-1").url,
          base,
        ),
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("clutter cannot establish stage status, counts stay whole and invalid deductions stay unknown", () => {
  const p = project();
  assert.equal(
    activityStatus(
      p.activities[1],
      [observation(p, { kind: "clutter" })],
      catalog.frames,
    ).date,
    null,
  );
  assert.equal(
    quantityResult({ ...q, type: "count", count: 1.5, deduction: 0 }).net,
    null,
  );
  assert.equal(quantityResult({ ...q, deduction: -1 }).net, null);
});
test("drawing snapshots are retained and cross-project document restore is rejected", () => {
  const state = seedState(catalog),
    p = state.projects[0];
  p.drawings.push({ id: "d1", data: "data:image/png;base64,AAAA", marks: [] });
  p.quantities.push({
    ...q,
    id: "q1",
    activityId: p.activities[1].id,
    drawingId: "d1",
  });
  const d = generateDocument(
    p,
    catalog.frames,
    "M-book draft",
    "2024-09-27",
    "2024-12-07",
    [p.activities[1].id],
  );
  p.drawings[0].data = "changed";
  assert.equal(d.snapshot.drawings[0].data, "data:image/png;base64,AAAA");
  p.drawings[0].data = d.snapshot.drawings[0].data;
  p.documents.push({ ...d, evidenceIds: [mt.frames[0].id] });
  assert.throws(() => validateState(state, catalog), /source links/);
});

test("document filenames are portable for QA/QC and unsafe punctuation", () => {
  assert.equal(fileStem("QA/QC report"), "QA-QC-report");
  assert.equal(fileStem("../a:b?"), "..-a-b");
});
