import { zipSync, strToU8 } from "fflate";
import {
  escapeHTML as h,
  EXAMPLE,
  GATE,
  csv,
  quantityResult,
} from "./domain.js";
export const fileStem = (name) =>
  String(name)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "SiteCommit-draft";
export function download(name, content, type = "text/plain") {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return blob;
}
export function renderReportText(body, evidenceIds = []) {
  const inline = (text) =>
    h(text).replace(/\[([^\]]+)\]/g, (match, id) =>
      evidenceIds.includes(id) ? `<a href="#${h(id)}">[${h(id)}]</a>` : match,
    );
  return body
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((block) => {
      const heading = block.trim().match(/^(#{1,3}) (.*)$/s);
      if (heading)
        return `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`;
      return `<p>${inline(block).replaceAll("\n", "<br>")}</p>`;
    })
    .join("\n");
}
function safeReviewURL(value) {
  if (typeof value !== "string" || value.length > 12000) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function reportHTML(doc, p, frames, { bundled = false } = {}) {
  const evidence = frames.filter(
    (f) => doc.evidenceIds.includes(f.id) && f.projectId === p.id,
  );
  const reviewURL = safeReviewURL(doc.history?.reviewUrl);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(doc.title)}</title><style>body{max-width:1000px;margin:40px auto;padding:0 24px;font:15px/1.6 Arial;color:#242824;background:#fafaf8}h1{font-size:30px}header{border-bottom:2px solid #ff5a1f}p{overflow-wrap:anywhere}h2{margin-top:36px;border-bottom:1px solid #ccc;padding-bottom:8px}h3{margin-top:26px}figure:target{outline:3px solid #ff5a1f;outline-offset:8px}figure{margin:30px 0;break-inside:avoid}img{max-width:100%;height:auto}a{color:#343c32}aside{padding:16px;background:#eee}small{overflow-wrap:anywhere}@media print{body{margin:0}a{color:inherit}}</style><header><p>SITECOMMIT / REMOTE REVIEW</p><h1>${h(doc.title)}</h1><p>${h(p.name)} · ${h(doc.from)} — ${h(doc.to)}</p></header><aside><strong>${h(GATE)}</strong><p>${h(doc.baselineDisclosure)}</p><p>Saved draft snapshot: ${h(doc.updatedAt)}. Edited text is reviewer-authored; evidence below is the retained source register.</p></aside><article>${renderReportText(
    doc.body,
    doc.evidenceIds,
  )}</article>${reviewURL ? `<p><a href="${h(reviewURL)}" target="_blank" rel="noopener noreferrer">Reopen the dated SiteCommit review</a></p>` : ""}${bundled && doc.history ? `<p><a href="model-context.json">Saved view and source provenance</a>. ${doc.history.surveys?.length ? "Dated reconstruction stills are in the model-stills folder; SPZ files remain cited assets." : "This photo review contains no reconstructed model assets."}</p>` : ""}<h2>Source evidence</h2>${evidence.map((f) => `<figure id="${h(f.id)}"><a href="${h(bundled ? "evidence/" + f.id + ".webp" : new URL(f.url, location.href).href)}"><img src="${h(bundled ? "evidence/" + f.id + ".webp" : new URL(f.url, location.href).href)}" alt="${h(f.id + " · " + f.date)}"></a><figcaption><strong>${h(f.id + " · " + f.date)}</strong><br>${h(f.sourceFile)}<br><a href="${h(f.sourceUrl)}">Dataset source</a> · ${h(f.license)} · ${h(f.credit)}<br><small>Original SHA-256: ${h(f.originalSha256)}<br>${h(f.alignment)}</small></figcaption></figure>`).join("")}<p>Prepared in SiteCommit. No signature, approval or independently validated measurement is implied.</p></html>`;
}
export function quantityCSV(qs) {
  return csv(
    qs.map((q) => ({
      ...q,
      quantity: quantityResult(q).net ?? "unknown",
      unit: quantityResult(q).unit,
      missing: quantityResult(q).missing.join("; "),
      gate: GATE,
    })),
    [
      "id",
      "description",
      "scope",
      "quantity",
      "unit",
      "method",
      "source",
      "evidenceId",
      "drawingId",
      "length",
      "width",
      "height",
      "thickness",
      "deduction",
      "deductionSource",
      "billQuantity",
      "billSource",
      "review",
      "reviewer",
      "validation",
      "missing",
      "gate",
    ],
  );
}
export async function evidencePackage(doc, p, frames, sketches = []) {
  const chosen = frames.filter(
    (f) => doc.evidenceIds.includes(f.id) && f.projectId === p.id,
  );
  const files = {
    "review.html": strToU8(reportHTML(doc, p, frames, { bundled: true })),
    "draft.md": strToU8(doc.body),
    "document.json": strToU8(JSON.stringify(doc, null, 2)),
    "plan.csv": strToU8(
      csv(doc.snapshot.activities, [
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
      ]),
    ),
    "quantities.csv": strToU8(quantityCSV(doc.snapshot.quantities)),
    "observations.json": strToU8(
      JSON.stringify(doc.snapshot.observations, null, 2),
    ),
    "evidence/provenance.json": strToU8(JSON.stringify(chosen, null, 2)),
    "READ-ME.txt": strToU8(
      `Open review.html for remote review. All files are a saved draft snapshot.\n${GATE}\n${doc.baselineDisclosure}\nOriginal site imagery is credited in evidence/provenance.json. Schedules, notes and quantities are reviewer input or explicitly illustrative. No owner BOQ is supplied.`,
    ),
  };
  if (doc.history) {
    const saved = doc.history;
    if (saved.projectId !== p.id || !Array.isArray(saved.surveys))
      throw Error("Saved model context does not match this project.");
    const surveys = [];
    if (saved.surveys.length) {
      // Only this fixed, shipped manifest is read. Backup-provided source URLs
      // must never become arbitrary network requests during package export.
      const response = await fetch("./data/surveys/manifest.json");
      if (!response.ok)
        throw Error("Could not verify the survey manifest. Nothing exported.");
      const manifest = await response.json();
      if (manifest.source !== p.sourceUrl)
        throw Error("Survey manifest belongs to a different source project.");
      for (const snapshot of saved.surveys) {
        const record = manifest.records?.find(
          (r) =>
            r.date === snapshot.date &&
            r.available === true &&
            [saved.date, saved.beforeDate].includes(r.date) &&
            r.sha256 === snapshot.sha256 &&
            /^[a-f0-9]{64}$/i.test(r.sha256) &&
            r.url === snapshot.url &&
            r.url === `./data/surveys/${r.date}.spz` &&
            r.still === snapshot.still &&
            r.still === `./data/surveys/${r.date}.webp` &&
            /^\d{4}-\d{2}-\d{2}$/.test(r.date),
        );
        if (!record)
          throw Error(
            "A saved survey does not match the verified local manifest. Nothing exported.",
          );
        if (!surveys.some((r) => r.date === record.date))
          surveys.push({
            ...record,
            bundledStill: `model-stills/${record.date}.webp`,
          });
      }
      await Promise.all(
        surveys.map(async (record) => {
          const response = await fetch(record.still);
          if (!response.ok)
            throw Error(
              `Could not bundle the ${record.date} survey still. Nothing exported.`,
            );
          files[record.bundledStill] = new Uint8Array(
            await response.arrayBuffer(),
          );
        }),
      );
    }
    files["model-context.json"] = strToU8(
      JSON.stringify(
        {
          projectId: p.id,
          mode: saved.mode,
          date: saved.date,
          beforeDate: saved.beforeDate || null,
          camera: saved.camera || null,
          reviewUrl: safeReviewURL(saved.reviewUrl),
          source: p.sourceUrl,
          license: p.license,
          surveys,
          limitation:
            "Derived reconstructions and saved viewer coordinates are approximate context, not surveyed measurements. Dated stills are bundled; SPZ assets are cited by URL and SHA-256, not included. The interactive review link requires an internet connection.",
        },
        null,
        2,
      ),
    );
  }
  await Promise.all(
    chosen.map(async (f) => {
      const res = await fetch(f.url);
      if (!res.ok) throw Error(`Could not bundle ${f.id}. Nothing exported.`);
      files["evidence/" + f.id + ".webp"] = new Uint8Array(
        await res.arrayBuffer(),
      );
    }),
  );
  for (const s of sketches)
    files["sketches/" + s.name] = new Uint8Array(await s.blob.arrayBuffer());
  for (const d of doc.snapshot.drawings ||
    p.drawings.filter((d) =>
      doc.snapshot.quantities.some((q) => q.drawingId === d.id),
    )) {
    if (d?.data) {
      const res = await fetch(d.data);
      files["drawings/" + d.id + ".png"] = new Uint8Array(
        await res.arrayBuffer(),
      );
      files["drawings/" + d.id + ".json"] = strToU8(
        JSON.stringify({ ...d, data: undefined }, null, 2),
      );
    }
  }
  return zipSync(files, { level: 0 });
}
export function sampleDrawingData() {
  const c = document.createElement("canvas");
  c.width = 1400;
  c.height = 900;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fafaf8";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "#454d43";
  ctx.lineWidth = 12;
  ctx.strokeRect(140, 170, 1080, 550);
  ctx.beginPath();
  ctx.moveTo(680, 170);
  ctx.lineTo(680, 530);
  ctx.moveTo(680, 630);
  ctx.lineTo(680, 720);
  ctx.moveTo(140, 430);
  ctx.lineTo(440, 430);
  ctx.moveTo(530, 430);
  ctx.lineTo(680, 430);
  ctx.stroke();
  ctx.fillStyle = "#454d43";
  ctx.font = "28px Arial";
  ctx.fillText("EXAMPLE WORK-AREA SKETCH / NOT TO SCALE", 140, 82);
  ctx.font = "22px Arial";
  ctx.fillText(EXAMPLE, 140, 120);
  ctx.fillText("Zone A", 320, 320);
  ctx.fillText("Zone B", 860, 420);
  ctx.fillText(
    "Dimensions and site relationship must be entered by a reviewer.",
    140,
    800,
  );
  return c.toDataURL("image/png");
}
export async function annotatedSheet({
  imageUrl,
  title,
  date,
  projectName,
  marks,
  disclosure,
  frame,
  activity,
}) {
  const img = new Image();
  img.src = imageUrl;
  await img.decode();
  const w = 1600,
    iw = 1480,
    ih = Math.round((iw * img.height) / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  const ctx = canvas.getContext("2d");
  function wrapped(text, font = "19px Arial") {
    ctx.font = font;
    const lines = [];
    let line = "";
    for (const word of String(text).split(/\s+/)) {
      const next = line ? line + " " + word : word;
      if (ctx.measureText(next).width > iw && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }
  const header = wrapped(`SITECOMMIT / ${title}`, "bold 30px Arial");
  const disclosures = wrapped(
    disclosure ||
      "Reviewer-authored annotations; dimensions only as explicitly entered.",
    "17px Arial",
  );
  const top = 80 + header.length * 36 + disclosures.length * 24;
  const notes = marks.map((m, i) => [
    ...wrapped(`${i + 1}. ${m.label || m.note || "Region"}`),
    ...wrapped(
      `Dimensions: ${m.dimensionNote || "not provided"} · source: ${m.dimensionSource || "not provided"} · ${m.kind || "reviewer note"}`,
    ),
    ...wrapped(
      `Evidence ${m.evidenceId || frame?.id || "not provided"} · work item ${m.activityId || activity || "not provided"} · ${m.review || "draft"}`,
    ),
  ]);
  const footer = wrapped(
    frame
      ? `${frame.sourceUrl} · ${frame.license} · ${frame.credit}`
      : "Drawing reference supplied by reviewer; original site drawing not implied.",
  ).concat(wrapped(GATE));
  canvas.height =
    top +
    ih +
    60 +
    notes.reduce((n, l) => n + l.length * 27 + 22, 0) +
    footer.length * 25 +
    50;
  ctx.fillStyle = "#fafaf8";
  ctx.fillRect(0, 0, w, canvas.height);
  ctx.fillStyle = "#232722";
  ctx.font = "bold 30px Arial";
  header.forEach((line, i) => ctx.fillText(line, 60, 45 + i * 36));
  ctx.font = "20px Arial";
  ctx.fillText(projectName + " · " + date, 60, 62 + header.length * 36);
  ctx.font = "17px Arial";
  disclosures.forEach((line, i) =>
    ctx.fillText(line, 60, 88 + header.length * 36 + i * 24),
  );
  ctx.drawImage(img, 60, top, iw, ih);
  marks.forEach((m, i) => {
    const [x, y, rw, rh] = m.region;
    ctx.fillStyle =
      m.kind === "clutter" ? "rgba(35,39,34,.5)" : "rgba(255,90,31,.08)";
    ctx.strokeStyle = m.kind === "clutter" ? "#242824" : "#ff5a1f";
    ctx.lineWidth = 3;
    ctx.fillRect(60 + x * iw, top + y * ih, rw * iw, rh * ih);
    ctx.strokeRect(60 + x * iw, top + y * ih, rw * iw, rh * ih);
    ctx.fillStyle = "#fff";
    ctx.fillRect(60 + x * iw, top + y * ih, 32, 28);
    ctx.fillStyle = "#232722";
    ctx.font = "bold 20px Arial";
    ctx.fillText(String(i + 1), 68 + x * iw, top + 22 + y * ih);
  });
  let y = top + ih + 38;
  ctx.font = "19px Arial";
  ctx.fillStyle = "#232722";
  for (const lines of notes) {
    for (const line of lines) {
      ctx.fillText(line, 60, y);
      y += 27;
    }
    y += 22;
  }
  ctx.font = "16px Arial";
  ctx.fillStyle = "#454d43";
  for (const line of footer) {
    ctx.fillText(line, 60, y);
    y += 25;
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error("PNG export failed"))),
      "image/png",
    ),
  );
}
