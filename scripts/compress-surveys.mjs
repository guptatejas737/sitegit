/** Compress local trained assets with Spark's SPZ encoder, retaining provenance. */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PackedSplats, writeSpz, defines } from "@sparkjsdev/spark";
import { Vector3, Quaternion, Color } from "three";
const root = new URL("../public/data/surveys/", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("manifest.json", root), "utf8"),
);
for (const record of manifest.records) {
  if (!record.available) continue;
  const raw = await readFile(new URL(`${record.date}.splat`, root));
  const data = new DataView(raw.buffer, raw.byteOffset, raw.byteLength),
    count = raw.length / 32;
  const splats = new PackedSplats({
    maxSplats: count,
    splatEncoding: defines.DEFAULT_SPLAT_ENCODING,
  });
  const center = new Vector3(),
    scale = new Vector3(),
    quaternion = new Quaternion(),
    color = new Color();
  for (let i = 0; i < count; i++) {
    const o = i * 32;
    center.set(
      data.getFloat32(o, true),
      data.getFloat32(o + 4, true),
      data.getFloat32(o + 8, true),
    );
    scale.set(
      data.getFloat32(o + 12, true),
      data.getFloat32(o + 16, true),
      data.getFloat32(o + 20, true),
    );
    quaternion
      .set(
        (data.getUint8(o + 29) - 128) / 128,
        (data.getUint8(o + 30) - 128) / 128,
        (data.getUint8(o + 31) - 128) / 128,
        (data.getUint8(o + 28) - 128) / 128,
      )
      .normalize();
    color.setRGB(
      data.getUint8(o + 24) / 255,
      data.getUint8(o + 25) / 255,
      data.getUint8(o + 26) / 255,
    );
    splats.pushSplat(
      center,
      scale,
      quaternion,
      data.getUint8(o + 27) / 255,
      color,
    );
  }
  const { fileBytes } = writeSpz(splats, 0, 12);
  await writeFile(new URL(`${record.date}.spz`, root), fileBytes);
  record.uncompressedSha256 = record.sha256;
  record.sha256 = createHash("sha256").update(fileBytes).digest("hex");
  record.bytes = fileBytes.length;
  record.url = `./data/surveys/${record.date}.spz`;
  const report = JSON.parse(
    await readFile(new URL(`${record.date}.json`, root), "utf8"),
  );
  report.viewerAssetSha256 = record.sha256;
  report.viewerAssetBytes = fileBytes.length;
  await writeFile(
    new URL(`${record.date}.json`, root),
    JSON.stringify(report, null, 2),
  );
  console.log(record.date, count, "Gaussians", fileBytes.length, "bytes");
  splats.dispose();
}
await writeFile(
  new URL("manifest.json", root),
  JSON.stringify(manifest, null, 2),
);
