import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  getHistoryDates,
  photoForDate,
  defaultChange,
  validateCamera,
  validateModelAnchor,
  serializeModelAnchor,
  parseModelAnchor,
  buildShareURL,
  parseHistoryLink,
  validateSharedReview,
  tourAt,
  TOUR_DURATION,
  ANCHOR_METHOD,
} from "../src/history-model.js";

const readJSON = async (path) =>
  JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const c = await readJSON("../public/data/evidence/catalog.json");
const mt = await readJSON("../public/data/evidence/montijo.json");
const manifest = await readJSON("../public/data/surveys/manifest.json");
const catalog = {
  projects: [...c.projects, mt.project],
  frames: [...c.frames, ...mt.frames],
};
const iv = catalog.projects.find((p) => p.id === "ivision");
const dates3d = ["2024-09-27", "2024-10-18", "2024-11-27"];
const camera = {
  position: manifest.camera.position,
  target: manifest.camera.target,
};
const anchor = () => ({
  projectId: "ivision",
  date: "2024-11-27",
  position: [-45, 0, -30],
  camera,
  method: ANCHOR_METHOD,
});
const review = () => ({
  note: "Revisit the visible foundation area; thickness remains unknown.",
  location: "Foundation zone A",
  author: "Reviewer",
  evidenceId: "iv-2024-11-27-1",
  stage: "Concrete",
  region: [0.2, 0.2, 0.4, 0.4],
  modelAnchor: anchor(),
});
const share = (patch = {}) =>
  buildShareURL("https://sitecommit.vercel.app/", {
    projectId: "ivision",
    mode: "3d",
    date: dates3d[2],
    beforeDate: dates3d[0],
    ...patch,
  });

test("3D history maps only three verified iVISION epochs; photo history retains all bundled dates", () => {
  assert.deepEqual(getHistoryDates(iv, catalog, manifest), dates3d);
  assert.deepEqual(getHistoryDates("ivision", catalog, manifest), dates3d);
  const photos = getHistoryDates(iv, catalog, manifest, "photos");
  assert.equal(photos.length, 12);
  assert(photos.includes("2024-10-02"));
  assert(!getHistoryDates(iv, catalog, manifest).includes("2024-10-02"));
  assert.deepEqual(getHistoryDates(mt.project, catalog, manifest), []);
  assert.equal(
    getHistoryDates(mt.project, catalog, manifest, "photos").length,
    12,
  );
  assert.deepEqual(getHistoryDates("unknown", catalog, manifest), []);
});

test("unavailable/broken survey entries and dates from another project cannot fabricate epochs", () => {
  const changed = structuredClone(manifest);
  changed.records[1].available = false;
  changed.records[2].sha256 = "not verified";
  changed.records.push({ ...changed.records[0], date: "2024-10-01" });
  assert.deepEqual(getHistoryDates(iv, catalog, changed), [dates3d[0]]);
  assert.deepEqual(
    getHistoryDates(
      { ...iv, sourceUrl: mt.project.sourceUrl },
      catalog,
      manifest,
    ),
    [],
  );
  const externalAsset = structuredClone(manifest);
  externalAsset.records[0].url = "https://example.org/unverified.spz";
  assert.deepEqual(
    getHistoryDates(iv, catalog, externalAsset),
    dates3d.slice(1),
  );
});

test("photo date/view selection never silently changes capture or view", () => {
  for (const date of getHistoryDates(iv, catalog, manifest, "photos")) {
    for (let view = 1; view <= 4; view++) {
      const frame = photoForDate(iv, catalog, date, view);
      assert.equal(frame.date, date);
      assert.equal(frame.view, view);
      assert.equal(frame.projectId, iv.id);
    }
  }
  assert.equal(photoForDate(iv, catalog, "2024-10-01"), null);
  assert.equal(photoForDate(iv, catalog, dates3d[0], 5), null);
  assert.equal(photoForDate(mt.project, catalog, dates3d[0]), null);
  assert.equal(photoForDate(iv, catalog, "2024-02-30"), null);
});

test("change captions cite exact manifest notes for arbitrary pairs and preserve unknowns", () => {
  for (const before of dates3d)
    for (const after of dates3d) {
      const change = defaultChange(before, after, manifest);
      assert.equal(change.beforeDate, before);
      assert.equal(change.afterDate, after);
      assert(
        change.summary.includes(
          manifest.records.find((r) => r.date === after).note,
        ),
      );
      assert.equal(change.kind, "derived");
      assert.match(change.source, /not automated/);
      assert(!/\d+%|\d+\s*m³/.test(change.summary));
    }
  const unknown = defaultChange("2024-10-02", "2024-12-07", manifest);
  assert.match(unknown.summary, /has not been established/);
  assert.deepEqual(unknown.evidenceDates, []);
  assert.match(
    defaultChange(dates3d[0], dates3d[0], manifest).summary,
    /no date-to-date change/,
  );
});

test("all nine 3D comparison pairs round-trip without being forced into adjacent dates", () => {
  for (const beforeDate of dates3d)
    for (const date of dates3d) {
      const link = parseHistoryLink(
        share({ date, beforeDate, compare: true }),
        catalog,
        manifest,
      );
      assert.equal(link.date, date);
      assert.equal(link.beforeDate, beforeDate);
      assert.equal(link.compare, true);
      assert.deepEqual(link.warnings, []);
    }
});

test("photo links preserve both selected source views and warn on unavailable views", () => {
  const exact = parseHistoryLink(
    share({
      mode: "photos",
      date: "2024-10-02",
      beforeDate: "2024-12-07",
      compare: true,
      view: 3,
      beforeView: 4,
    }),
    catalog,
    manifest,
  );
  assert.equal(exact.view, 3);
  assert.equal(exact.beforeView, 4);
  assert.deepEqual(exact.warnings, []);
  const missing = parseHistoryLink(
    share({ mode: "photos", view: 999, beforeView: 9 }),
    catalog,
    manifest,
  );
  assert.equal(missing.view, 1);
  assert.equal(missing.beforeView, 1);
  assert.equal(missing.warnings.length, 2);
  assert.throws(() => share({ view: 0 }));
  assert.throws(() => share({ beforeView: 1.5 }));
});

test("share round trip preserves an intentional bounded note and view without disclosing unrelated fields", () => {
  const url = share({
    compare: true,
    tour: true,
    tourPosition: 26.5,
    camera,
    observationId: "obs-123",
    review: {
      ...review(),
      privateEmail: "private@example.org",
      password: "secret",
    },
  });
  const link = parseHistoryLink(url, catalog, manifest);
  assert.deepEqual(link.camera, camera);
  assert.equal(link.tourPosition, 26.5);
  assert.equal(link.tour, true);
  assert.equal(link.observationId, "obs-123");
  assert.equal(link.review.note, review().note);
  assert.equal(link.review.evidenceId, review().evidenceId);
  assert.equal(link.review.source, "Explicitly shared user-entered note");
  assert(!url.includes("private%40"));
  assert(!url.includes("secret"));
  assert.equal(link.review.password, undefined);
  assert.equal(parseHistoryLink(share(), catalog, manifest).review, null);
  const sample = parseHistoryLink(
    share({ review: { ...review(), kind: "sample" } }),
    catalog,
    manifest,
  );
  assert.equal(sample.review.kind, "sample");
  assert.equal(
    sample.review.source,
    "Illustrative example, created for this demo",
  );
  const inference = parseHistoryLink(
    share({ review: { ...review(), kind: "inference" } }),
    catalog,
    manifest,
  );
  assert.equal(inference.review.kind, "inference");
});

test("share URL removes credentials/query tokens and rejects unsafe scheme, malformed dates and overlong input", () => {
  const url = buildShareURL(
    "https://user:password@sitecommit.vercel.app/?token=secret&qa=1#documents",
    {
      projectId: "ivision",
      date: dates3d[0],
    },
  );
  assert(!url.includes("password"));
  assert(!url.includes("secret"));
  assert.equal(new URL(url).search, "");
  assert.throws(() =>
    buildShareURL("javascript:alert(1)", { projectId: "ivision" }),
  );
  assert.throws(() => share({ date: "2024-02-30" }));
  assert.throws(() => share({ mode: "live-camera" }));
  assert.throws(() =>
    share({ review: { ...review(), note: "x".repeat(1601) } }),
  );
  assert.throws(() => share({ projectId: "../invalid" }));
  assert.throws(() =>
    share({ camera: { position: [Infinity, 0, 0], target: [0, 0, 0] } }),
  );
  assert.equal(
    parseHistoryLink("javascript:alert(1)", catalog, manifest),
    null,
  );
  assert.equal(
    parseHistoryLink(
      "https://sitecommit.vercel.app/#documents",
      catalog,
      manifest,
    ),
    null,
  );
});

test("link recovery uses actual captures and warns rather than implying unsupported reconstructions", () => {
  const unknown = parseHistoryLink(
    share({ date: "2024-10-02", beforeDate: "2024-12-07", compare: true }),
    catalog,
    manifest,
  );
  assert.equal(unknown.date, "2024-11-27");
  assert.equal(unknown.beforeDate, null);
  assert.equal(unknown.compare, false);
  assert.equal(unknown.warnings.length, 2);
  const photoLink = parseHistoryLink(
    share({
      mode: "photos",
      date: "2024-10-02",
      beforeDate: "2024-12-07",
      compare: true,
    }),
    catalog,
    manifest,
  );
  assert.equal(photoLink.date, "2024-10-02");
  assert.equal(photoLink.beforeDate, "2024-12-07");
  assert(photoLink.compare);
  assert.equal(
    parseHistoryLink(
      "https://sitecommit.vercel.app/#history?project=other",
      catalog,
      manifest,
    ),
    null,
  );
  const mtLink = parseHistoryLink(
    buildShareURL("https://sitecommit.vercel.app", {
      projectId: "montijo",
      mode: "3d",
      date: "2026-06-16",
      tour: true,
    }),
    catalog,
    manifest,
  );
  assert.equal(mtLink.mode, "photos");
  assert.equal(mtLink.date, "2026-06-16");
  assert.equal(mtLink.tour, false);
  assert.match(mtLink.warnings[0], /no verified 3D/);
});

test("cross-project source/anchor reviews are rejected, never transplanted into another site", () => {
  assert.throws(() =>
    validateSharedReview(
      { ...review(), evidenceId: mt.frames[0].id },
      iv,
      catalog,
      manifest,
    ),
  );
  assert.throws(() =>
    validateSharedReview(
      { ...review(), modelAnchor: { ...anchor(), date: dates3d[0] } },
      iv,
      catalog,
      manifest,
    ),
  );
  assert.throws(() => share({ projectId: "montijo", review: review() }));
  const link = new URL(share({ review: review() }));
  const params = new URLSearchParams(link.hash.slice(9));
  params.set("project", "montijo");
  link.hash = `history?${params}`;
  const parsed = parseHistoryLink(link.href, catalog, manifest);
  assert.equal(parsed.review, null);
  assert(parsed.warnings.some((w) => w.includes("invalid source")));
});

test("model anchor serialization retains explicit approximate method and rejects nonsurvey or unbounded coordinates", () => {
  const restored = parseModelAnchor(
    serializeModelAnchor(anchor(), iv, catalog, manifest),
    iv,
    catalog,
    manifest,
  );
  assert.deepEqual(restored.position, [-45, 0, -30]);
  assert.equal(restored.method, ANCHOR_METHOD);
  assert.match(restored.limitation, /not a measured/);
  const rayPin = validateModelAnchor(
    { ...anchor(), method: "derived splat intersection" },
    iv,
    catalog,
    manifest,
  );
  assert.equal(rayPin.method, "derived splat intersection");
  const viewPin = validateModelAnchor(
    { ...anchor(), position: undefined, method: "camera viewpoint" },
    iv,
    catalog,
    manifest,
  );
  assert.equal(viewPin.position, null);
  assert.equal(viewPin.method, "camera viewpoint");
  const viewReview = validateSharedReview(
    { ...review(), modelAnchor: viewPin },
    iv,
    catalog,
    manifest,
  );
  assert.equal(viewReview.modelAnchor.position, null);
  for (const patch of [
    { projectId: "montijo" },
    { date: "2024-10-02" },
    { position: [NaN, 0, 0] },
    { position: [1001, 0, 0] },
    { position: [0, 0] },
    { method: "survey-grade measurement" },
    { camera: { position: [0, 0, 0], target: [0, 0, 0] } },
  ])
    assert.throws(() =>
      validateModelAnchor({ ...anchor(), ...patch }, iv, catalog, manifest),
    );
  assert.throws(() =>
    parseModelAnchor("x".repeat(1601), iv, catalog, manifest),
  );
});

test("shared regions and cameras are bounded, and hostile plain text is never interpreted by link helpers", () => {
  for (const region of [
    [0, 0, 0, 1],
    [0.9, 0, 0.2, 1],
    [-1, 0, 1, 1],
    [0, 0, 1, Infinity],
  ])
    assert.throws(() =>
      validateSharedReview({ ...review(), region }, iv, catalog, manifest),
    );
  assert.throws(() =>
    validateCamera({ position: [3001, 0, 0], target: [0, 0, 0] }),
  );
  assert.throws(() =>
    validateCamera({ position: [2000, 0, 0], target: [0, 0, 0] }),
  );
  assert.throws(() =>
    validateCamera({ position: [19.9, 0, 0], target: [0, 0, 0] }),
  );
  assert.throws(() =>
    validateCamera({ position: [701, 0, 0], target: [0, 0, 0] }),
  );
  assert.deepEqual(
    validateCamera({ position: [20, 0, 0], target: [0, 0, 0] }).position,
    [20, 0, 0],
  );
  assert.deepEqual(
    validateCamera({ position: [700, 0, 0], target: [0, 0, 0] }).position,
    [700, 0, 0],
  );
  const note = '<script>alert("text only")</script>';
  const parsed = parseHistoryLink(
    share({ review: { ...review(), note } }),
    catalog,
    manifest,
  );
  assert.equal(parsed.review.note, note);
  assert(!share({ review: { ...review(), note } }).includes("<script>"));
});

test("walkthrough steps exact epochs on elapsed time, clamps scrubs, and supplies deterministic camera path", () => {
  assert.equal(tourAt(0, TOUR_DURATION, manifest).date, dates3d[0]);
  assert.equal(tourAt(23.99, TOUR_DURATION, manifest).date, dates3d[0]);
  assert.equal(tourAt(24, TOUR_DURATION, manifest).date, dates3d[1]);
  assert.equal(tourAt(48, TOUR_DURATION, manifest).date, dates3d[2]);
  assert.equal(tourAt(72, TOUR_DURATION, manifest).date, dates3d[2]);
  assert.equal(tourAt(-3, TOUR_DURATION, manifest).seconds, 0);
  assert.equal(tourAt(999, TOUR_DURATION, manifest).seconds, TOUR_DURATION);
  assert.equal(tourAt(NaN, TOUR_DURATION, manifest).progress, 0);
  assert.deepEqual(
    tourAt(33, TOUR_DURATION, manifest),
    tourAt(33, TOUR_DURATION, manifest),
  );
  assert.equal(tourAt(72, TOUR_DURATION, manifest).finished, true);
  assert.equal(tourAt(71, TOUR_DURATION, manifest).finished, false);
  assert.equal(tourAt(20, 60, manifest).date, dates3d[1]);
  for (let second = 0; second <= TOUR_DURATION; second++) {
    const frame = tourAt(second, TOUR_DURATION, manifest);
    assert(dates3d.includes(frame.date));
    assert(
      frame.caption.includes(
        manifest.records.find((r) => r.date === frame.date).note,
      ),
    );
    validateCamera(frame.camera);
    assert(frame.progress >= 0 && frame.progress <= 1);
    assert(frame.segmentProgress >= 0 && frame.segmentProgress <= 1);
  }
  assert.notDeepEqual(
    tourAt(0, 72, manifest).camera,
    tourAt(72, 72, manifest).camera,
  );
  assert.equal(tourAt(0, 72, { records: [] }).date, null);
});

test("invalid shared camera and elapsed position cannot poison the live viewer", () => {
  const parsed = parseHistoryLink(
    "https://sitecommit.vercel.app/#history?project=ivision&camera=%7B%22position%22%3A%5B0%2C0%2C0%5D%7D&t=NaN",
    catalog,
    manifest,
  );
  assert.equal(parsed.camera, null);
  assert.equal(parsed.tourPosition, 0);
  assert.equal(parsed.warnings.length, 2);
  assert.equal(
    parseHistoryLink(share({ tourPosition: 999 }), catalog, manifest)
      .tourPosition,
    72,
  );
});
