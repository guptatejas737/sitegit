import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { datedSheetLayout, wrapSheetText } from "../src/history-sheet.js";

const readJSON = async (path) =>
  JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const catalog = await readJSON("../public/data/evidence/catalog.json");
const manifest = await readJSON("../public/data/surveys/manifest.json");
const montijo = await readJSON("../public/data/evidence/montijo.json");
const project = catalog.projects[0];
const frame = catalog.frames.find(
  (f) => f.date === "2024-11-27" && f.view === 4,
);
const beforeFrame = catalog.frames.find(
  (f) => f.date === "2024-09-27" && f.view === 3,
);
const measure = (text) => Array.from(text).length * 9;
const images = [
  { width: 1600, height: 1199 },
  { width: 1600, height: 1199 },
];
const selection = (patch = {}) => ({
  mode: "photos",
  compare: true,
  date: frame.date,
  beforeDate: beforeFrame.date,
  frame,
  beforeFrame,
  summary: {
    summary: "Review the visible work; hidden dimensions remain unknown.",
    author: "Test reviewer",
  },
  ...patch,
});
const allText = (layout) => layout.textBlocks.map((b) => b.text).join(" ");

test("dated PNG layout preserves all 10,000 summary characters and places the final disclaimer inside the canvas", () => {
  const end = "END OF REVIEWER SUMMARY";
  const summary = "x".repeat(10000 - end.length) + end;
  const layout = datedSheetLayout(
    selection({ summary: { summary, author: "Test reviewer" } }),
    project,
    images,
    measure,
  );
  const start =
    layout.textBlocks.findIndex((b) => b.text === "What changed") + 1;
  const stop = layout.textBlocks.findIndex((b) =>
    b.text.startsWith("REVIEWER-AUTHORED"),
  );
  assert.equal(
    layout.textBlocks
      .slice(start, stop)
      .map((b) => b.text)
      .join("")
      .replaceAll(" ", ""),
    summary.replaceAll(" ", ""),
  );
  assert(
    layout.textBlocks.some((b) => b.text.includes("END OF REVIEWER SUMMARY")),
  );
  assert(layout.textBlocks.every((b) => b.y > 0 && b.y < layout.height - 30));
  assert(
    layout.textBlocks.every((b) => b.x + measure(b.text) <= layout.width - 48),
  );
  assert.match(allText(layout), /DRAFT \/ HUMAN REVIEW REQUIRED/);
  assert.match(allText(layout), /billing approval or verified completion/);
  const short = datedSheetLayout(selection(), project, images, measure);
  assert(layout.height > short.height + 1000);
});

test("photo comparison sheet exports both source views with correct before/after dates and preserved aspect ratios", () => {
  const layout = datedSheetLayout(selection(), project, images, measure);
  assert.equal(layout.imageBlocks.length, 2);
  const [left, right] = layout.imageBlocks;
  assert.equal(left.index, 0);
  assert.equal(right.index, 1);
  assert(left.x + left.width < right.x);
  assert.equal(left.y, right.y);
  assert(
    Math.abs(left.width / left.height - images[0].width / images[0].height) <
      1e-10,
  );
  assert(
    allText(layout).includes(
      `LEFT / BEFORE ${beforeFrame.date} · View 3 · ${beforeFrame.id}`,
    ),
  );
  assert(
    allText(layout).includes(
      `RIGHT / AFTER ${frame.date} · View 4 · ${frame.id}`,
    ),
  );
  assert(allText(layout).includes(beforeFrame.sourceFile));
  assert(allText(layout).includes(frame.sourceFile));
  assert(allText(layout).includes(beforeFrame.originalSha256));
  assert(allText(layout).includes(frame.originalSha256));
  assert.match(
    allText(layout),
    /does not establish pixel alignment or measured change/,
  );
});

test("3D comparison sheet keeps one captured composite and cites only selected model assets and hashes", () => {
  const layout = datedSheetLayout(
    selection({
      mode: "3d",
      renderMode: "derived 3D view",
      surveys: manifest.records,
    }),
    project,
    [images[0]],
    measure,
  );
  assert.equal(layout.imageBlocks.length, 1);
  const text = allText(layout);
  for (const record of [manifest.records[0], manifest.records[2]]) {
    assert(text.includes(record.url));
    assert(text.includes(record.sha256));
    assert(text.includes(`DERIVED MODEL / ${record.date}`));
  }
  assert(!text.includes(manifest.records[1].sha256));
  assert(text.includes(project.sourceUrl));
  assert(text.includes(`License: ${project.license}`));
  assert.match(
    text,
    /supporting evidence, not the complete training-image set/,
  );
  assert.match(text, /REVIEWER-AUTHORED/);
});

test("single 3D view still cites the earlier model/photo supporting its change summary without claiming that image is displayed", () => {
  const layout = datedSheetLayout(
    selection({
      mode: "3d",
      compare: false,
      surveys: manifest.records,
      summary: {
        summary:
          "September shows graded ground; November shows visible foundation walls.",
        beforeDate: beforeFrame.date,
        afterDate: frame.date,
        source: "Editorial reading; not automated detection",
        evidenceIds: [beforeFrame.id, frame.id],
      },
    }),
    project,
    [images[0]],
    measure,
  );
  assert.equal(layout.imageBlocks.length, 1);
  const text = allText(layout);
  assert(text.includes(`RECORDED VISIT ${frame.date}`));
  assert(!text.includes(`BEFORE ${beforeFrame.date} / AFTER ${frame.date}`));
  assert(text.includes(`SUMMARY CONTEXT (NOT SHOWN ABOVE)`));
  assert(
    text.includes(
      `Summary context (not shown above) source photograph: ${beforeFrame.date}`,
    ),
  );
  assert(text.includes(beforeFrame.sourceFile));
  assert(text.includes(beforeFrame.originalSha256));
  assert(text.includes(manifest.records[0].sha256));
  assert(text.includes(manifest.records[2].sha256));
  assert(text.includes(beforeFrame.id));
  assert.match(text, /not shown in the image above/);
  assert.throws(
    () =>
      datedSheetLayout(
        selection({
          mode: "3d",
          compare: false,
          beforeFrame: null,
          summary: { summary: "Compare visits.", beforeDate: "2024-09-27" },
        }),
        project,
        [images[0]],
        measure,
      ),
    /earlier source image is missing/,
  );
});

test("sheet export rejects cross-project sources, mismatched dates and a missing comparison frame", () => {
  assert.throws(
    () =>
      datedSheetLayout(
        selection({ frame: montijo.frames[0] }),
        project,
        images,
        measure,
      ),
    /same project/,
  );
  assert.throws(
    () =>
      datedSheetLayout(
        selection({ beforeFrame: montijo.frames[0] }),
        project,
        images,
        measure,
      ),
    /same project/,
  );
  assert.throws(
    () =>
      datedSheetLayout(
        selection({ date: "2024-10-18" }),
        project,
        images,
        measure,
      ),
    /recorded visits/,
  );
  assert.throws(
    () =>
      datedSheetLayout(
        selection({ beforeFrame: null }),
        project,
        images,
        measure,
      ),
    /before source image/,
  );
  assert.throws(
    () => datedSheetLayout(selection(), project, [images[0]], measure),
    /laid out/,
  );
  assert.throws(
    () =>
      datedSheetLayout(
        selection({ summary: { summary: "x".repeat(10001) } }),
        project,
        images,
        measure,
      ),
    /10,000/,
  );
});

test("saved summary source views stay independently cited when the currently displayed views change", () => {
  const oldBefore = catalog.frames.find(
    (f) => f.date === beforeFrame.date && f.view === 1,
  );
  const oldAfter = catalog.frames.find(
    (f) => f.date === frame.date && f.view === 2,
  );
  const context = selection({
    summaryFrames: [oldBefore, oldAfter],
    summary: {
      summary: "Reviewer compared the original saved source views.",
      author: "Test reviewer",
      beforeDate: oldBefore.date,
      afterDate: oldAfter.date,
      evidenceIds: [oldBefore.id, oldAfter.id],
    },
  });
  const layout = datedSheetLayout(context, project, images, measure);
  const text = allText(layout);
  assert.equal(layout.imageBlocks.length, 2);
  assert(
    text.includes(
      `LEFT / BEFORE ${beforeFrame.date} · View 3 · ${beforeFrame.id}`,
    ),
  );
  assert(text.includes(`RIGHT / AFTER ${frame.date} · View 4 · ${frame.id}`));
  for (const source of [oldBefore, oldAfter, beforeFrame, frame]) {
    assert(text.includes(source.id));
    assert(text.includes(source.sourceFile));
    assert(text.includes(source.originalSha256));
  }
  assert(
    text.includes(
      `Summary context (not shown above) source photograph: ${oldBefore.date} · View 1`,
    ),
  );
  assert(
    text.includes(
      `Summary context (not shown above) source photograph: ${oldAfter.date} · View 2`,
    ),
  );
  const single = datedSheetLayout(
    { ...context, compare: false },
    project,
    [images[0]],
    measure,
  );
  assert.equal(single.imageBlocks.length, 1);
  assert(allText(single).includes(oldBefore.originalSha256));
  assert(allText(single).includes(oldAfter.originalSha256));
  assert.throws(
    () =>
      datedSheetLayout(
        { ...context, summaryFrames: [montijo.frames[0]] },
        project,
        images,
        measure,
      ),
    /same project/,
  );
});

test("missing model manifest stays explicit and editorial text is distinguished from reviewer text", () => {
  const layout = datedSheetLayout(
    selection({
      mode: "3d",
      summary: {
        summary: "Excavation visible.",
        source: "Editorial reading; not automated detection",
      },
    }),
    project,
    [images[0]],
    measure,
  );
  const text = allText(layout);
  assert.match(text, /Survey manifest\/hash not supplied/);
  assert.match(text, /DERIVED EDITORIAL READING/);
  assert.match(text, /not automated detection/);
  assert(!manifest.records.some((r) => text.includes(r.sha256)));
});

test("long source URLs and unspaced text wrap without lost characters or broken Unicode", () => {
  const url = `https://example.org/${"evidence".repeat(100)}`;
  const lines = wrapSheetText(url, measure, 90);
  assert.equal(lines.join(""), url);
  assert(lines.every((line) => measure(line) <= 90));
  const glyphs = "施工记录🏗".repeat(50);
  const unicodeLines = wrapSheetText(glyphs, measure, 90);
  assert.equal(unicodeLines.join(""), glyphs);
  assert(unicodeLines.every((line) => measure(line) <= 90));
});
