import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import assert from "node:assert/strict";
const base = new URL("../public/", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("data/surveys/manifest.json", base), "utf8"),
);
assert.equal(manifest.records.length, 3);
assert.equal(new Set(manifest.records.map((x) => x.date)).size, 3);
assert.equal(
  new Set(manifest.records.map((x) => x.sha256)).size,
  3,
  "Every visit must have a distinct trained artifact",
);
for (const record of manifest.records) {
  assert(record.available);
  assert.equal(record.imageCount, 60);
  assert.match(record.url, /^\.\/data\/surveys\/2024-\d\d-\d\d\.spz$/);
  const bytes = await readFile(new URL(record.url, base));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), record.sha256);
  const header = bytes[0] === 31 ? gunzipSync(bytes) : bytes;
  assert.equal(header.readUInt32LE(0), 0x5053474e, "Valid Gaussian SPZ header");
  assert.equal(header.readUInt32LE(8), record.pointCount);
  assert(record.pointCount > 10000);
  assert.equal(bytes.length, record.bytes);
  assert(
    (await stat(new URL(record.still, base))).size > 10000,
    "Fallback still must be bundled",
  );
  assert(
    (await stat(new URL(record.stillMobile, base))).size > 10000,
    "Mobile fallback still must be bundled",
  );
  const report = JSON.parse(
    await readFile(new URL(`data/surveys/${record.date}.json`, base), "utf8"),
  );
  assert.equal(report.viewerAssetSha256, record.sha256);
  assert(report.trainingSteps > 0);
  assert.equal(report.gpsAlignment.registeredImages, 60);
  console.log(
    `${record.date}: ${record.pointCount.toLocaleString()} trained Gaussians, ${(bytes.length / 1e6).toFixed(2)} MB, distinct hash, still present`,
  );
}
console.log("All three independently hosted records verified.");
