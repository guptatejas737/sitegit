import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import {
  clone,
  seedState,
  validateObservation,
  validateHistoryChange,
  validateState,
  saveState,
  loadState,
  generateDocument,
} from "../src/domain.js";
import { evidencePackage, reportHTML } from "../src/exports.js";

const base = new URL("../public/", import.meta.url);
const ivision = JSON.parse(
  await readFile(new URL("data/evidence/catalog.json", base), "utf8"),
);
const montijo = JSON.parse(
  await readFile(new URL("data/evidence/montijo.json", base), "utf8"),
);
const manifest = JSON.parse(
  await readFile(new URL("data/surveys/manifest.json", base), "utf8"),
);
const catalog = {
  projects: [...ivision.projects, montijo.project],
  frames: [...ivision.frames, ...montijo.frames],
};
const camera = { position: [-41, 120, 41], target: [-55, 1, -50] };
const anchor = (patch = {}) => ({
  projectId: "ivision",
  date: "2024-11-27",
  position: [-55, 1, -50],
  camera: clone(camera),
  method: "derived splat intersection",
  ...patch,
});
const observation = (p, patch = {}) => ({
  ...p.observations[0],
  id: "history-test",
  evidenceId: "iv-2024-11-27-1",
  kind: "observation",
  review: "reviewed",
  author: "Test reviewer",
  note: "Visible foundation context; hidden thickness is unknown.",
  modelAnchor: anchor(),
  ...patch,
});
const change = (patch = {}) => ({
  beforeDate: "2024-09-27",
  afterDate: "2024-11-27",
  summary: "Reviewer sees concrete in the later frame; extent needs review.",
  author: "Test reviewer",
  kind: "reviewer",
  source: "Reviewer-authored comparison",
  evidenceIds: ["iv-2024-09-27-1", "iv-2024-11-27-1"],
  updatedAt: "2026-10-03T12:00:00.000Z",
  ...patch,
});
const project = () => seedState(catalog).projects[0];
const report = (p, type = "Progress report") =>
  generateDocument(
    p,
    catalog.frames,
    type,
    "2024-11-01",
    "2024-11-30",
    p.activities.map((a) => a.id),
  );

test("model notes require exact project, source-image date, verified epoch and supported method", () => {
  const p = project();
  assert.doesNotThrow(() =>
    validateObservation(observation(p), p, catalog.frames),
  );
  for (const a of [
    anchor({ projectId: "montijo" }),
    anchor({ date: "2024-10-18" }),
    anchor({ method: "survey-grade coordinate" }),
    anchor({ position: [NaN, 1, 2] }),
    anchor({ position: [1001, 1, 2] }),
    anchor({ position: null }),
    anchor({ camera: { position: [0, 0, 0], target: [0, 0, 0] } }),
  ])
    assert.throws(() =>
      validateObservation(
        observation(p, { modelAnchor: a }),
        p,
        catalog.frames,
      ),
    );
  assert.throws(
    () =>
      validateObservation(
        observation(p, {
          evidenceId: "iv-2024-10-09-1",
          modelAnchor: anchor({ date: "2024-10-09" }),
        }),
        p,
        catalog.frames,
      ),
    /verified 3D survey/,
  );
});

test("a camera-only saved view is usable without claiming a geometric point", () => {
  const p = project();
  const o = observation(p, {
    modelAnchor: anchor({ method: "camera viewpoint", position: null }),
  });
  assert.doesNotThrow(() => validateObservation(o, p, catalog.frames));
  p.observations = [o];
  const doc = report(p);
  assert.match(
    doc.body,
    /Saved camera viewpoint; no geometric position established/,
  );
  assert.match(doc.body, /not surveyed dimensions or contractual measurement/);
  assert.equal(doc.snapshot.observations[0].modelAnchor.position, null);
});

test("backup validation cannot invent model epochs by editing project splatDates", () => {
  const state = seedState(catalog),
    p = state.projects[0];
  p.splatDates.push("2024-10-09");
  p.observations = [
    observation(p, {
      evidenceId: "iv-2024-10-09-1",
      modelAnchor: anchor({ date: "2024-10-09" }),
    }),
  ];
  assert.throws(() => validateState(state, catalog), /verified 3D survey/);
});

test("reviewer comparisons must cite both selected dates at the same real project", () => {
  const p = project();
  assert.doesNotThrow(() => validateHistoryChange(change(), p, catalog.frames));
  for (const row of [
    change({ author: "" }),
    change({ kind: "AI detection" }),
    change({ source: "Automated finding" }),
    change({ afterDate: "2024-10-20" }),
    change({ evidenceIds: ["iv-2024-11-27-1"] }),
    change({ evidenceIds: ["iv-2024-09-27-1", montijo.frames[0].id] }),
    change({ activityId: "other-project-work" }),
  ])
    assert.throws(() => validateHistoryChange(row, p, catalog.frames));
  assert.doesNotThrow(() =>
    validateHistoryChange(
      change({
        beforeDate: "2024-11-27",
        evidenceIds: ["iv-2024-11-27-1", "iv-2024-11-27-1"],
      }),
      p,
      catalog.frames,
    ),
  );
});

test("saved anchors and reviewer comparisons survive persistence; corrupt comparisons are rejected", () => {
  const state = seedState(catalog),
    p = state.projects[0];
  p.observations = [observation(p)];
  p.historyChanges = [change()];
  const values = new Map();
  const storage = {
    setItem: (k, v) => values.set(k, v),
    getItem: (k) => values.get(k),
  };
  saveState(storage, state);
  const restored = loadState(storage, catalog);
  assert.deepEqual(restored.projects[0].observations[0].modelAnchor, anchor());
  assert.deepEqual(restored.projects[0].historyChanges, [change()]);
  restored.projects[0].historyChanges[0].evidenceIds = ["missing"];
  assert.throws(() => validateState(restored, catalog), /Comparison evidence/);
  const legacy = seedState(catalog);
  delete legacy.projects[0].historyChanges;
  assert.doesNotThrow(() => validateState(legacy, catalog));
});

test("progress reports cite before frames outside the period and freeze review context", () => {
  const p = project();
  p.observations = [observation(p)];
  p.historyChanges = [change()];
  const doc = report(p);
  assert(doc.evidenceIds.includes("iv-2024-09-27-1"));
  assert(doc.evidenceIds.includes("iv-2024-11-27-1"));
  assert.match(doc.body, /Reviewer comparisons between visits/);
  assert.match(
    doc.body,
    /Reviewer-authored comparison: Reviewer sees concrete/,
  );
  assert.match(doc.body, /not automated change detection/);
  assert.match(doc.body, /3D context: derived splat intersection/);
  assert.match(doc.body, /source image \[iv-2024-11-27-1\]/);
  p.observations[0].modelAnchor.position[0] = 999;
  p.historyChanges[0].summary = "Edited after generation";
  assert.equal(doc.snapshot.observations[0].modelAnchor.position[0], -55);
  assert.match(
    doc.snapshot.historyChanges[0].summary,
    /Reviewer sees concrete/,
  );
});

test("comparison period and selected activity filters do not leak unrelated notes", () => {
  const p = project();
  p.historyChanges = [
    change(),
    change({
      afterDate: "2024-10-18",
      evidenceIds: ["iv-2024-09-27-1", "iv-2024-10-18-1"],
      summary: "Outside the selected reporting period.",
    }),
    change({
      activityId: p.activities[2].id,
      summary: "Different selected work package.",
    }),
  ];
  const doc = generateDocument(
    p,
    catalog.frames,
    "Progress report",
    "2024-11-01",
    "2024-11-30",
    [p.activities[0].id],
  );
  assert.equal(doc.snapshot.historyChanges.length, 1);
  assert.doesNotMatch(
    doc.body,
    /Outside the selected reporting period|Different selected work package/,
  );
  assert.equal(report(p, "M-book draft").snapshot.historyChanges.length, 0);
});

test("evidence ZIP keeps exact source photos, anchor metadata and comparison snapshot", async () => {
  const p = project();
  p.observations = [observation(p)];
  p.historyChanges = [change()];
  const doc = report(p, "Progress evidence package");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) =>
    new Response(await readFile(new URL(url, base)));
  try {
    const files = unzipSync(await evidencePackage(doc, p, catalog.frames));
    const record = JSON.parse(strFromU8(files["document.json"]));
    const observations = JSON.parse(strFromU8(files["observations.json"]));
    const provenance = JSON.parse(strFromU8(files["evidence/provenance.json"]));
    assert.deepEqual(observations[0].modelAnchor, anchor());
    assert.deepEqual(record.snapshot.historyChanges, [change()]);
    assert.equal(provenance.length, 2);
    assert.deepEqual(
      files["evidence/iv-2024-09-27-1.webp"],
      new Uint8Array(
        await readFile(new URL("data/evidence/iv-2024-09-27-1.webp", base)),
      ),
    );
    assert.match(
      strFromU8(files["review.html"]),
      /Reviewer-authored comparison/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("HTML preserves every buyer-update and edited paragraph, including the first four blocks", () => {
  const p = project(),
    doc = report(p);
  doc.body =
    "# Buyer update edited by reviewer\n\nFirst changed-work finding <unverified>\n\nSecond context paragraph\n\nThird reviewer caveat\n\nFourth retained summary";
  doc.history = {
    reviewUrl:
      "https://sitecommit.vercel.app/#history?project=ivision&date=2024-11-27",
  };
  const html = reportHTML(doc, p, catalog.frames, { bundled: true });
  for (const text of [
    "Buyer update edited by reviewer",
    "First changed-work finding &lt;unverified&gt;",
    "Second context paragraph",
    "Third reviewer caveat",
    "Fourth retained summary",
  ])
    assert(html.includes(text), text);
  assert.match(html, /Reopen the dated SiteCommit review/);
  assert.match(
    html,
    /href="https:\/\/sitecommit\.vercel\.app\/#history\?project=ivision&amp;date=2024-11-27"/,
  );
  assert.match(html, /rel="noopener noreferrer"/);
});

test("unsafe or credential-bearing review URLs never become active HTML links", () => {
  const p = project(),
    doc = report(p);
  for (const reviewUrl of [
    "javascript:alert(1)",
    "data:text/html,bad",
    "file:///secret",
    "https://user:password@example.com",
    "//example.com",
    "not a URL",
  ]) {
    doc.history = { reviewUrl };
    const html = reportHTML(doc, p, catalog.frames, { bundled: true });
    assert.doesNotMatch(html, /Reopen the dated SiteCommit review/);
    assert(!html.includes(`href="${reviewUrl}"`));
  }
});

test("3D evidence ZIP retains verified survey hashes, saved camera, review link and exact dated still bytes", async () => {
  const p = project(),
    doc = report(p);
  doc.history = {
    projectId: p.id,
    mode: "3d",
    date: "2024-11-27",
    beforeDate: "2024-09-27",
    camera,
    surveys: [manifest.records[0], manifest.records[2]],
    reviewUrl:
      "https://sitecommit.vercel.app/#history?project=ivision&date=2024-11-27",
  };
  const originalFetch = globalThis.fetch,
    calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return new Response(await readFile(new URL(url, base)));
  };
  try {
    const files = unzipSync(await evidencePackage(doc, p, catalog.frames));
    const context = JSON.parse(strFromU8(files["model-context.json"]));
    assert.equal(context.surveys.length, 2);
    assert.equal(context.surveys[0].sha256, manifest.records[0].sha256);
    assert.equal(context.surveys[1].url, manifest.records[2].url);
    assert.deepEqual(context.camera, camera);
    assert.equal(context.reviewUrl, doc.history.reviewUrl);
    assert.match(context.limitation, /not surveyed measurements/);
    assert.deepEqual(
      files["model-stills/2024-09-27.webp"],
      new Uint8Array(await readFile(new URL(manifest.records[0].still, base))),
    );
    assert(!calls.some((url) => url.endsWith(".spz")));
    assert(files["model-stills/2024-11-27.webp"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ZIP model verification refuses edited hashes, arbitrary still URLs and cross-project model provenance", async () => {
  const p = project(),
    doc = report(p);
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    assert.equal(url, "./data/surveys/manifest.json");
    return new Response(JSON.stringify(manifest));
  };
  try {
    for (const patch of [
      { still: "https://untrusted.example/collect" },
      { still: "./data/surveys/../../private.webp" },
      { url: "https://untrusted.example/model.spz" },
      { sha256: "0".repeat(64) },
    ]) {
      doc.history = {
        projectId: p.id,
        mode: "3d",
        date: "2024-09-27",
        surveys: [{ ...manifest.records[0], ...patch }],
      };
      await assert.rejects(
        evidencePackage(doc, p, catalog.frames),
        /verified local manifest/,
      );
    }
    doc.history.projectId = "montijo";
    await assert.rejects(
      evidencePackage(doc, p, catalog.frames),
      /does not match this project/,
    );
    assert(calls.every((url) => url === "./data/surveys/manifest.json"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
