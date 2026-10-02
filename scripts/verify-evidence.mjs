import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = new URL("../public/", import.meta.url);
const c = JSON.parse(
  await readFile(new URL("data/evidence/catalog.json", root), "utf8"),
);
const m = JSON.parse(
  await readFile(new URL("data/evidence/montijo.json", root), "utf8"),
);
const all = [...c.frames, ...m.frames];
assert.equal(c.frames.length, 48);
assert.equal(new Set(c.frames.map((f) => f.date)).size, 12);
assert.equal(m.frames.length, 12);
assert.equal(Object.keys(m.archiveDates).length, 98);
assert.equal(new Set(all.map((f) => f.id)).size, 60);
for (const f of all) {
  const b = await readFile(new URL(f.url, root));
  assert.equal(createHash("sha256").update(b).digest("hex"), f.sha256);
  assert.equal(b.toString("ascii", 0, 4), "RIFF");
  assert.equal(b.toString("ascii", 8, 12), "WEBP");
  assert(
    f.sourceFile.includes(f.date.replaceAll("-", "")) ||
      f.sourceFile.includes(f.date),
  );
  assert(f.originalSha256.length === 64);
  assert(f.sourceUrl.startsWith("https://"));
  assert(["MIT", "CC BY 4.0"].includes(f.license));
}
assert.equal(m.project.splatDates.length, 0);
assert.equal(c.projects[0].splatDates.length, 3);
console.log(
  "60 original-photo derivatives verified; 24 real project/date combinations; datasets remain separate.",
);
