/** A downloadable dated view. All captions/provenance are baked into the PNG. */
const WIDTH = 1600;
const MARGIN = 48;
const GAP = 24;
const CONTENT = WIDTH - MARGIN * 2;
const FONTS = {
  title: "600 32px Inter, Arial, sans-serif",
  heading: "600 23px Inter, Arial, sans-serif",
  body: "20px Inter, Arial, sans-serif",
  small: "17px Inter, Arial, sans-serif",
  mono: "16px 'IBM Plex Mono', monospace",
};
const asText = (value, missing = "Not provided") =>
  value === undefined || value === null || value === ""
    ? missing
    : String(value);

/** Wraps long filenames/URLs too; never clips or truncates the entered text. */
export function wrapSheetText(value, measure, maxWidth) {
  if (!Number.isFinite(maxWidth) || maxWidth <= 0)
    throw Error("Invalid sheet text width.");
  const words = asText(value).trim().split(/\s+/u);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) {
      lines.push(line);
      line = "";
    }
    for (const character of Array.from(word)) {
      if (line && measure(line + character) > maxWidth) {
        lines.push(line);
        line = "";
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["Not provided"];
}

function frameSource(frame, role) {
  return [
    `${role} source photograph: ${asText(frame?.date)} · View ${asText(frame?.view)} · ${asText(frame?.id)}`,
    `Original filename: ${asText(frame?.sourceFile)}`,
    `Source: ${asText(frame?.sourceUrl)} · License: ${asText(frame?.license)}`,
    `Credit: ${asText(frame?.credit)}`,
    `Original photo SHA-256: ${asText(frame?.originalSha256)}`,
    `Displayed photo derivative: ${asText(frame?.url)} · SHA-256: ${asText(frame?.sha256)}`,
  ];
}

/** Pure measurable layout. The browser supplies exact font widths and images. */
export function datedSheetLayout(s, p, images, measure) {
  if (!s?.frame || !s.date)
    throw Error("A dated source image is required for this export.");
  const summaryBefore = s.summary?.beforeDate;
  const summaryFrames = Array.isArray(s.summaryFrames) ? s.summaryFrames : [];
  if (summaryFrames.some((f) => !f || f.projectId !== p?.id))
    throw Error("Summary source images must belong to the same project.");
  const summaryBeforeFrame =
    summaryFrames.find((f) => f.date === summaryBefore) ||
    (s.beforeFrame?.date === summaryBefore || !summaryBefore
      ? s.beforeFrame
      : null);
  const needsSummaryContext =
    !s.compare &&
    Boolean(
      (summaryBefore && summaryBefore !== s.date) ||
        (s.beforeFrame?.date !== s.date &&
          s.summary?.evidenceIds?.includes(s.beforeFrame?.id)),
    );
  if (s.compare && !s.beforeFrame)
    throw Error("The comparison's before source image is missing.");
  if (needsSummaryContext && !summaryBeforeFrame)
    throw Error(
      "The change summary's earlier source image is missing from this export.",
    );
  if (
    s.frame.projectId !== p?.id ||
    s.frame.date !== s.date ||
    (s.compare &&
      (s.beforeFrame.projectId !== p?.id ||
        s.beforeFrame.date !== s.beforeDate)) ||
    (needsSummaryContext && summaryBeforeFrame.projectId !== p?.id)
  )
    throw Error(
      "Export dates and source images must belong to the same project and recorded visits.",
    );
  const summary = asText(s.summary?.summary);
  if (summary.length > 10000)
    throw Error("Keep the exported change summary within 10,000 characters.");
  if (
    !Array.isArray(images) ||
    images.length !== (s.mode === "photos" && s.compare ? 2 : 1) ||
    images.some(
      (im) =>
        !Number.isFinite(im.width) ||
        !Number.isFinite(im.height) ||
        im.width <= 0 ||
        im.height <= 0,
    )
  )
    throw Error("The dated view images could not be laid out.");
  const textBlocks = [],
    imageBlocks = [],
    rules = [];
  let y = MARGIN;
  const addText = (value, style = "body", gap = 9) => {
    const font = FONTS[style];
    const lineHeight =
      style === "title"
        ? 42
        : style === "heading"
          ? 33
          : style === "body"
            ? 29
            : 25;
    const lines = wrapSheetText(value, (str) => measure(str, font), CONTENT);
    for (const text of lines) {
      y += lineHeight;
      textBlocks.push({ text, x: MARGIN, y, font });
    }
    y += gap;
  };
  const rule = () => {
    y += 11;
    rules.push(y);
    y += 14;
  };
  addText("sitecommit / dated site record", "title", 9);
  addText(asText(p?.name), "heading", 4);
  addText(
    s.compare
      ? `BEFORE ${s.beforeDate} / AFTER ${s.date}`
      : `RECORDED VISIT ${s.date}`,
    "mono",
    7,
  );
  addText(
    s.mode === "3d"
      ? `REAL CAPTURES · ${s.renderMode === "dated reconstruction still" ? "DATED RECONSTRUCTION STILL" : "DERIVED 3D VIEW"}`
      : "REAL CAPTURES · SOURCE PHOTOGRAPHS",
    "mono",
    16,
  );

  const paneWidth = images.length === 2 ? (CONTENT - GAP) / 2 : CONTENT;
  const displayHeights = images.map((im) =>
    Math.min(1120, (paneWidth * im.height) / im.width),
  );
  const rowHeight = Math.max(...displayHeights);
  const imageTop = y;
  images.forEach((im, index) => {
    const height = displayHeights[index];
    const width = (height * im.width) / im.height;
    const cellX = MARGIN + index * (paneWidth + GAP);
    imageBlocks.push({
      index,
      x: cellX + (paneWidth - width) / 2,
      y: imageTop,
      width,
      height,
    });
  });
  y += rowHeight + 8;
  if (s.mode === "photos" && s.compare) {
    addText(
      `LEFT / BEFORE ${s.beforeFrame.date} · View ${s.beforeFrame.view} · ${s.beforeFrame.id}`,
      "mono",
      2,
    );
    addText(
      `RIGHT / AFTER ${s.frame.date} · View ${s.frame.view} · ${s.frame.id}`,
      "mono",
      7,
    );
    addText(
      "Independent source viewpoints. This side-by-side comparison does not establish pixel alignment or measured change.",
      "small",
    );
  } else if (s.mode === "3d") {
    addText(
      s.compare
        ? `One camera, two recorded surveys: left is ${s.beforeDate}; right is ${s.date}. Divider position and view are captured as shown.`
        : `Derived Gaussian-splat view of the ${s.date} recorded survey.`,
      "small",
    );
    addText(
      "Approximate registration and incomplete reconstruction surfaces can affect appearance. This view is not a geometric difference measurement.",
      "small",
    );
  } else {
    addText(
      `Source photograph ${s.frame.date} · View ${s.frame.view} · ${s.frame.id}`,
      "mono",
    );
  }
  rule();
  addText("What changed", "heading", 4);
  addText(summary, "body", 11);
  addText(
    s.summary?.author
      ? `REVIEWER-AUTHORED · ${s.summary.author}${s.summary.updatedAt ? ` · Saved ${s.summary.updatedAt}` : ""}`
      : `DERIVED EDITORIAL READING · ${asText(s.summary?.source, "Manual reading of dated captures; not automated detection")}`,
    "small",
  );
  if (s.summary?.kind === "sample")
    addText("Illustrative example, created for this demo", "small");
  if (s.summary?.evidenceIds?.length)
    addText(
      `Reviewer summary source IDs: ${s.summary.evidenceIds.join(" / ")}`,
      "mono",
    );
  if (needsSummaryContext)
    addText(
      `Summary context: ${summaryBeforeFrame.date} → ${s.date}. The earlier capture is cited below for the change summary; it is not shown in the image above.`,
      "small",
    );
  rule();
  addText("Source register", "heading", 4);
  addText(
    `Dataset: ${asText(p?.sourceUrl)} · License: ${asText(p?.license)}`,
    "small",
  );
  addText(`Attribution: ${asText(p?.credit)}`, "small");

  if (s.mode === "3d") {
    const selectedDates = [
      ...new Set([
        ...(s.compare ? [s.beforeDate] : []),
        ...(needsSummaryContext ? [summaryBeforeFrame.date] : []),
        ...summaryFrames
          .filter((f) => s.surveys?.some((r) => r.date === f.date))
          .map((f) => f.date),
        s.date,
      ]),
    ];
    for (const date of selectedDates) {
      const record = s.surveys?.find((r) => r.date === date);
      addText(
        `DERIVED MODEL / ${date}${needsSummaryContext && date !== s.date ? " · SUMMARY CONTEXT (NOT SHOWN ABOVE)" : ""}`,
        "mono",
        2,
      );
      if (record) {
        addText(
          `Survey asset: ${asText(record.url)} · SHA-256: ${asText(record.sha256)}`,
          "small",
          3,
        );
        addText(
          `Model source: ${asText(record.sourceUrl || s.surveySource || p?.sourceUrl)} · License: ${asText(record.license || s.surveyLicense || p?.license)}`,
          "small",
          3,
        );
        addText(
          `${asText(record.imageCount)} source photographs used in this reconstruction. The linked photo below is supporting evidence, not the complete training-image set.`,
          "small",
          8,
        );
      } else {
        addText(
          "Survey manifest/hash not supplied to this export. Verify the model asset provenance before circulating this draft.",
          "small",
          8,
        );
      }
    }
  }
  const sources = s.compare
    ? [
        [s.beforeFrame, "Before"],
        [s.frame, "After"],
      ]
    : [
        ...(needsSummaryContext
          ? [[summaryBeforeFrame, "Summary context (not shown above)"]]
          : []),
        [s.frame, "Selected"],
      ];
  for (const frame of summaryFrames)
    if (!sources.some(([source]) => source.id === frame.id))
      sources.push([frame, "Summary context (not shown above)"]);
  for (const [frame, role] of sources) {
    for (const line of frameSource(frame, role)) addText(line, "small", 3);
    y += 11;
  }
  rule();
  addText("DRAFT / HUMAN REVIEW REQUIRED", "mono", 4);
  addText(
    "Dated evidence context only. No measured dimensions, hidden-work compliance, contractual accuracy, billing approval or verified completion is implied.",
    "small",
    0,
  );
  const height = Math.ceil(y + MARGIN);
  if (height > 12000 || WIDTH * height > 19_000_000)
    throw Error(
      "This evidence sheet exceeds the browser-safe image size. Export the full text as a report, or shorten the reviewer summary.",
    );
  return { width: WIDTH, height, textBlocks, imageBlocks, rules };
}

export async function datedViewSheet(blob, s, p) {
  if (s.mode === "3d" && !blob)
    throw Error(
      "Wait for the actual 3D view or dated reconstruction still before exporting.",
    );
  const temporary = blob && s.mode === "3d" ? URL.createObjectURL(blob) : null;
  try {
    const sources = temporary
      ? [temporary]
      : s.compare
        ? [s.beforeFrame?.url, s.frame?.url]
        : [s.frame?.url];
    if (sources.some((url) => !url))
      throw Error("A source photograph is missing from this dated export.");
    const images = await Promise.all(
      sources.map(async (url) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.src = url;
        await image.decode();
        return image;
      }),
    );
    await document.fonts?.ready;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("This browser could not create an evidence image.");
    const layout = datedSheetLayout(
      s,
      p,
      images.map((im) => ({
        width: im.naturalWidth,
        height: im.naturalHeight,
      })),
      (str, font) => {
        ctx.font = font;
        return ctx.measureText(str).width;
      },
    );
    canvas.width = layout.width;
    canvas.height = layout.height;
    ctx.fillStyle = "#fafaf8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const block of layout.imageBlocks) {
      ctx.drawImage(
        images[block.index],
        block.x,
        block.y,
        block.width,
        block.height,
      );
      ctx.strokeStyle = "#d7d9d2";
      ctx.lineWidth = 1;
      ctx.strokeRect(block.x, block.y, block.width, block.height);
    }
    ctx.fillStyle = "#242824";
    for (const block of layout.textBlocks) {
      ctx.font = block.font;
      ctx.fillText(block.text, block.x, block.y);
    }
    ctx.strokeStyle = "#d7d9d2";
    for (const y of layout.rules) {
      ctx.beginPath();
      ctx.moveTo(MARGIN, y);
      ctx.lineTo(WIDTH - MARGIN, y);
      ctx.stroke();
    }
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(Error("Image export failed.")),
        "image/png",
      ),
    );
  } finally {
    if (temporary) URL.revokeObjectURL(temporary);
  }
}
