import "./history.css";
import { escapeHTML as h } from "./domain.js";
import {
  getHistoryDates,
  photoForDate,
  defaultChange,
  buildShareURL,
  tourAt,
  TOUR_DURATION,
} from "./history-model.js";
import { createHistoryViewer } from "./history-viewer.js";

const pretty = (d) =>
  d
    ? new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "No capture";
const btn = (label, action, extra = "") =>
  `<button type="button" data-history="${action}" ${extra}>${label}</button>`;

/** Owns the viewer subtree: scrubbing never replaces the WebGL canvas. */
export function mountHistory(
  root,
  {
    project: p,
    catalog,
    manifest,
    initial = {},
    onNote,
    onEditNote,
    onEvidence,
    onPage,
    onSave,
    onShare,
    onUpdate,
    onExport,
    onError,
    onRemember,
  },
) {
  const threeDates = getHistoryDates(p, catalog, manifest),
    photoDates = getHistoryDates(p, catalog, manifest, "photos");
  if (!photoDates.length) {
    root.innerHTML =
      "<h1>No dated captures yet</h1><p>This project is separate from the public examples.</p>";
    return { dispose() {} };
  }
  let mode = initial.mode || (threeDates.length ? "3d" : "photos"),
    date = initial.date || threeDates.at(-1) || photoDates.at(-1),
    beforeDate =
      initial.beforeDate || (mode === "3d" ? threeDates[0] : photoDates[0]);
  let compare = !!initial.compare,
    view = initial.view || 1,
    beforeView = initial.beforeView || 1,
    viewer,
    viewerPromise,
    disposed = false,
    status = "loading",
    picking = false,
    tour = false,
    playing = false,
    seconds = initial.tourPosition || 0,
    raf = 0,
    lastTime = 0,
    request = 0;
  const dates = () => (mode === "3d" ? threeDates : photoDates);
  if (!dates().includes(date)) date = dates().at(-1);
  if (!dates().includes(beforeDate)) beforeDate = dates()[0];
  const frame = (d) =>
    photoForDate(p, catalog, d, view) ||
    catalog.frames.find((f) => f.projectId === p.id && f.date === d);
  const beforeFrame = () =>
    photoForDate(p, catalog, beforeDate, beforeView) ||
    catalog.frames.find((f) => f.projectId === p.id && f.date === beforeDate);
  const record = (d) => manifest.records.find((r) => r.date === d);
  const summary = () =>
    p.historyChanges?.find(
      (c) => c.beforeDate === beforeDate && c.afterDate === date,
    ) ||
    defaultChange(
      beforeDate,
      date,
      threeDates.length ? manifest : { records: [] },
    );
  const snapshot = () => ({
    projectId: p.id,
    mode,
    date,
    beforeDate,
    view,
    beforeView,
    compare,
    tour,
    tourPosition: seconds,
    camera: viewer?.getCamera() || initial.camera,
  });
  root.innerHTML = `<div class="history-heading"><div><p class="eyebrow">DATED SITE RECORD / ${h(p.shortName || p.name)}</p><h1>See the site change.</h1></div><div class="history-tabs" aria-label="History view">${btn("3D history", "mode-3d", threeDates.length ? "" : "disabled")}${btn("Photo history", "mode-photos")}</div></div>
  <section class="history-record" aria-label="Site history"><div class="history-bar"><div><strong id="history-date"></strong><span id="history-kind" class="mono"></span></div><div class="row">${btn("Compare dates", "compare")}${btn("Reset view", "reset")}</div></div>
  <div class="history-stage" id="history-stage"><div id="history-stills" class="history-stills"></div><canvas id="history-canvas" tabindex="0" aria-label="3D site model. Drag to orbit, pinch or scroll to zoom. Arrow keys rotate, plus and minus zoom."></canvas><div id="history-photos" class="history-photos" hidden></div><div id="history-loading" class="history-loading" role="status"></div><div class="history-corner"><span id="history-instruction">Drag to explore · pinch to zoom</span></div><div id="history-divider" hidden></div><div id="history-compare-labels" class="history-compare-labels" hidden></div></div>
  <div id="history-compare-controls" class="history-compare-controls" hidden></div>
  <div class="history-timeline"><div class="row spread"><div class="row">${btn("←", "previous", 'aria-label="Previous capture"')}<span class="mono" id="history-count"></span>${btn("→", "next", 'aria-label="Next capture"')}</div><button type="button" data-history="tour" id="history-tour-button">▶ Watch 72-second walkthrough</button></div><input id="history-slider" aria-label="Site history date" type="range" min="0" step="1"><div id="history-dates" class="history-dates"></div></div>
  <div id="history-tour" class="history-tour" hidden><div class="row spread"><strong id="history-caption"></strong><span id="history-clock" class="mono"></span></div><div class="row">${btn("Pause", "play", 'id="history-play"')}<input type="range" id="history-tour-slider" aria-label="Walkthrough position" min="0" max="72" step="0.1" value="0">${btn("Close walkthrough", "stop-tour")}</div></div>
  <div id="history-views" class="history-views"></div></section>
  <div class="history-actionbar"><div class="row wrap">${btn("Pin a site note", "pin", 'class="primary"')}${btn("Open source evidence", "evidence")}${btn("Share this view", "share")}</div><div class="row wrap">${btn("Create buyer update", "update")}${btn("Export dated view", "export")}</div></div>
  <section class="history-bottom"><div class="history-change"><div class="row spread"><p class="eyebrow">WHAT CHANGED</p>${btn("Edit summary", "edit-change")}</div><h2 id="history-change-title"></h2><p id="history-change-text"></p><p id="history-change-source" class="small"></p><div id="history-change-images" class="history-change-images"></div><form id="history-change-form" hidden><label>Reviewer change summary<textarea name="summary" required maxlength="10000" rows="4"></textarea></label><label>Reviewer / author<input name="author" required maxlength="180"></label><div class="row"><button class="primary">Save summary</button>${btn("Cancel", "cancel-change")}</div><p class="small">A manual reading of these two dated captures. No measurement or completion percentage is inferred.</p></form></div><div class="history-notes"><div class="row spread"><p class="eyebrow">EVIDENCE AT THIS DATE</p>${btn("Review desk ↗", "desk")}</div><div id="history-notes"></div><div id="history-shared"></div></div></section>
  <details class="source-details"><summary>Real captures, reconstruction and coverage</summary><p>${h(p.description)} ${photoDates.length} actual dates and ${catalog.frames.filter((f) => f.projectId === p.id).length} source photographs are bundled; this is an attributed sample, not every original image.</p><p>${threeDates.length ? "Three independent Gaussian-splat reconstructions derived from 60 source photographs per epoch. Reconstruction edges can be incomplete; relative registration is not a certified survey. Stages are editorial readings or reviewer entries, never automated detection." : "Fixed-camera photographs only. No 3D reconstruction is claimed for this project."}</p><p>${h(p.credit)} · ${h(p.license)}</p><a href="${h(p.sourceUrl)}" target="_blank" rel="noopener">Original dataset ↗</a>${threeDates.length ? ' · <a href="./data/ATTRIBUTION.md" target="_blank">Training & attribution</a> · <a href="./survey.html">Original survey viewer</a>' : ""}<p>Viewer: Spark (MIT) and Three.js (MIT). Plans and sample annotations remain illustrative. Hidden dimensions, quantities and compliance require independent verification.</p></details>`;
  const $ = (s) => root.querySelector(s),
    canvas = $("#history-canvas"),
    stage = $("#history-stage");
  function remember() {
    const f = frame(date);
    if (f) p.selectedEvidenceId = f.id;
    if (beforeFrame()) p.beforeEvidenceId = beforeFrame().id;
    onRemember?.(snapshot());
  }
  function updateSummary() {
    const s = summary();
    $("#history-change-title").textContent =
      s.title || `${pretty(beforeDate)} → ${pretty(date)}`;
    $("#history-change-text").textContent = s.summary;
    $("#history-change-source").textContent = s.author
      ? `Reviewer-authored · ${s.author} · ${s.updatedAt?.slice(0, 10) || ""}`
      : s.source;
    $("#history-change-images").innerHTML = (
      s.evidenceIds
        ? s.evidenceIds.map((id) => catalog.frames.find((f) => f.id === id))
        : [beforeFrame(), frame(date)]
    )
      .filter(Boolean)
      .map(
        (f) =>
          `<a href="${h(f.url)}" target="_blank"><img src="${h(f.url)}" alt="Source frame ${h(f.date)}" loading="lazy"><span>${h(f.date)} · source photo ↗</span></a>`,
      )
      .join("");
    const notes = p.observations.filter(
      (o) =>
        catalog.frames.find((f) => f.id === o.evidenceId)?.date === date ||
        (o.hiddenWork &&
          catalog.frames.find((f) => f.id === o.evidenceId)?.date < date),
    );
    $("#history-notes").innerHTML = notes.length
      ? notes
          .map(
            (o) =>
              `<article><span class="mono">${h(o.hiddenWork ? "BEFORE COVERING · " : o.kind === "sample" ? "SAMPLE ANNOTATION · " : "")}${h(catalog.frames.find((f) => f.id === o.evidenceId)?.date)}</span><h3>${h(o.location)} / ${h(o.stage)}</h3><p>${h(o.note)}</p><p class="small">${h(o.author)} · ${h(o.review)}</p><div class="row wrap">${o.modelAnchor ? btn("Return to saved viewpoint", "anchor", `data-id="${h(o.id)}"`) : ""}${btn("Edit note", "edit-note", `data-id="${h(o.id)}"`)}${btn("Source image", "note-image", `data-id="${h(o.evidenceId)}"`)}${btn("Share note", "share-note", `data-id="${h(o.id)}"`)}</div></article>`,
          )
          .join("")
      : '<p class="subtle">No reviewer notes at this date. Pin a place in the model, or mark a region in its source photograph.</p>';
  }
  function display() {
    const list = dates(),
      f = frame(date),
      b = beforeFrame();
    if (root.dataset.date !== date || root.dataset.beforeDate !== beforeDate)
      $("#history-change-form").hidden = true;
    root.dataset.mode = mode;
    root.dataset.date = date;
    root.dataset.beforeDate = beforeDate;
    $("#history-date").textContent = pretty(date);
    $("#history-kind").textContent =
      mode === "3d"
        ? "REAL CAPTURE · DERIVED 3D"
        : "REAL CAPTURE · SOURCE PHOTOGRAPH";
    root
      .querySelectorAll(".history-tabs button")
      .forEach((el) =>
        el.setAttribute(
          "aria-pressed",
          String(el.dataset.history === "mode-" + mode),
        ),
      );
    $('[data-history="compare"]').setAttribute("aria-pressed", String(compare));
    $('[data-history="reset"]').hidden = mode !== "3d";
    $('[data-history="pin"]').textContent =
      mode === "3d"
        ? picking
          ? "Cancel pin"
          : "Pin a site note"
        : "Add date-linked note";
    $("#history-instruction").textContent =
      mode === "photos"
        ? "Swipe to change date · choose another view below"
        : picking
          ? "Click a place to attach a source-linked note"
          : status === "ready"
            ? "Drag to explore · pinch to zoom"
            : "Dated still · use the timeline below";
    canvas.hidden = mode !== "3d";
    $("#history-stills").hidden = mode !== "3d";
    $("#history-loading").hidden = mode !== "3d" || status === "ready";
    $("#history-photos").hidden = mode !== "photos";
    $("#history-photos").innerHTML =
      mode === "photos"
        ? (compare
            ? `<figure><img src="${h(b.url)}" alt="Before capture ${h(b.date)} view ${b.view}"><figcaption>${h(b.date)} · View ${b.view}</figcaption></figure>`
            : "") +
          `<figure><img src="${h(f.url)}" alt="Capture ${h(f.date)} view ${f.view}"><figcaption>${h(f.date)} · View ${f.view}</figcaption></figure>`
        : "";
    $("#history-stills").innerHTML =
      mode === "3d"
        ? (compare
            ? `<img class="still-before" style="clip-path:inset(0 50% 0 0)" src="${h(record(beforeDate)?.stillMobile && innerWidth < 600 ? record(beforeDate).stillMobile : record(beforeDate)?.still)}" alt="Dated reconstruction still ${h(beforeDate)}">`
            : "") +
          `<img class="still-after" src="${h(innerWidth < 600 ? record(date)?.stillMobile || record(date)?.still : record(date)?.still)}" alt="Dated reconstruction still ${h(date)}">`
        : "";
    $("#history-stills").style.visibility =
      status === "ready" ? "hidden" : "visible";
    $("#history-divider").hidden = !compare || mode !== "3d";
    $("#history-divider").style.left = "50%";
    $("#history-compare-labels").hidden = !compare || mode !== "3d";
    $("#history-compare-labels").innerHTML =
      `<span>${h(beforeDate)}</span><span>${h(date)}</span>`;
    const options = (selected) =>
      list
        .map(
          (d) =>
            `<option value="${d}" ${d === selected ? "selected" : ""}>${pretty(d)}</option>`,
        )
        .join("");
    $("#history-compare-controls").hidden = !compare;
    $("#history-compare-controls").innerHTML = compare
      ? `<label>Before date<select id="history-before">${options(beforeDate)}</select></label><label>After date<select id="history-after">${options(date)}</select></label>${
          mode === "3d"
            ? '<label class="wipe-label">Compare divider<input id="history-wipe" type="range" min="0" max="100" value="50" aria-label="3D comparison divider"></label>'
            : `<label>Before photo view<select id="history-before-view">${catalog.frames
                .filter((x) => x.projectId === p.id && x.date === beforeDate)
                .map(
                  (x) =>
                    `<option value="${x.view}" ${x.view === beforeView ? "selected" : ""}>View ${x.view}</option>`,
                )
                .join("")}</select></label>`
        }<p class="small">${mode === "3d" ? "One synchronized camera; registration is approximate. Swipe the divider." : "Viewpoints can differ. Side-by-side review does not imply pixel alignment."}</p>`
      : "";
    $("#history-slider").max = list.length - 1;
    $("#history-slider").value = list.indexOf(date);
    $("#history-slider").setAttribute("aria-valuetext", pretty(date));
    $("#history-count").textContent =
      `${list.length} RECORDED ${mode === "3d" ? "3D VISITS" : "PHOTO DATES"}`;
    $("#history-dates").innerHTML = list
      .map((d) =>
        btn(
          `<span>${pretty(d).replace(" 2024", "").replace(" 2025", "").replace(" 2026", "")}</span>${mode === "3d" ? `<small>${h({ "2024-09-27": "Preparation", "2024-10-18": "Groundworks", "2024-11-27": "Foundations" }[d] || "Recorded visit")}</small>` : ""}`,
          "date",
          `data-date="${d}" ${d === date ? 'aria-current="date"' : ""}`,
        ),
      )
      .join("");
    $('[data-history="previous"]').disabled = list.indexOf(date) === 0;
    $('[data-history="next"]').disabled =
      list.indexOf(date) === list.length - 1;
    $("#history-tour-button").hidden = !threeDates.length;
    $("#history-views").innerHTML =
      `<span class="mono">${mode === "3d" ? "SOURCE PHOTOS / SAME DATE" : "PHOTO VIEWS"}</span><div>${catalog.frames
        .filter((x) => x.projectId === p.id && x.date === date)
        .map((x) =>
          btn(
            `<img src="${h(x.url)}" alt=""><span>View ${x.view}</span>`,
            "view",
            `data-view="${x.view}" aria-label="Photo view ${x.view} on ${x.date}" ${mode === "photos" && x.view === view ? 'aria-pressed="true"' : ""}`,
          ),
        )
        .join(
          "",
        )}</div><p>${threeDates.includes(date) ? "3D reconstruction available on this date." : "Photo capture only · no 3D model on this date."}</p>`;
    updateSummary();
    remember();
  }
  async function selectScene() {
    const token = ++request,
      selectedDate = date,
      selectedBefore = compare ? beforeDate : null;
    display();
    if (mode !== "3d") return;
    try {
      viewerPromise ||= createHistoryViewer({
        canvas,
        container: stage,
        manifest,
        forceFallback: new URLSearchParams(location.search).has("fallback"),
        onState(s) {
          if (disposed) return;
          if (s.status === "interaction") {
            pause();
            return;
          }
          status = s.status;
          $("#history-loading").textContent =
            s.message || "Opening recorded 3D visit…";
          $("#history-loading").hidden = mode !== "3d" || status === "ready";
          $("#history-stills").style.visibility =
            status === "ready" ? "hidden" : "visible";
          canvas.style.visibility = status === "ready" ? "visible" : "hidden";
          root.dataset.renderStatus = status;
          if (mode === "3d" && !picking)
            $("#history-instruction").textContent =
              status === "ready"
                ? "Drag to explore · pinch to zoom"
                : "Dated still · use the timeline below";
        },
        onPick(anchor) {
          picking = false;
          viewer.setPicking(false);
          const pickedDate = anchor.date || date;
          onNote(
            { ...anchor, projectId: p.id, date: pickedDate },
            frame(pickedDate),
          );
          display();
        },
      });
      viewer = await viewerPromise;
      if (disposed) {
        viewer.dispose();
        return;
      }
      if (token !== request) return;
      await viewer.select(selectedDate, selectedBefore);
      if (initial.camera) {
        viewer.setAnchor({
          camera: initial.camera,
          method: "camera viewpoint",
        });
        initial.camera = null;
      }
      if (initial.observationId) {
        const o = p.observations.find((o) => o.id === initial.observationId);
        if (o?.modelAnchor) viewer.setAnchor(o.modelAnchor);
        initial.observationId = null;
      }
      viewer.resize();
    } catch (e) {
      onError(e.message);
    }
  }
  function pause() {
    playing = false;
    lastTime = 0;
    $("#history-play").textContent = "Play";
  }
  function tourDisplay() {
    const t = tourAt(seconds, TOUR_DURATION, manifest);
    $("#history-caption").textContent = t.caption;
    $("#history-clock").textContent = `${Math.floor(seconds)} / 72s`;
    $("#history-tour-slider").value = seconds;
    $("#history-play").textContent = playing ? "Pause" : "Play";
  }
  async function seek(value) {
    seconds = Math.max(0, Math.min(72, value));
    const t = tourAt(seconds, TOUR_DURATION, manifest);
    if (date !== t.date || mode !== "3d") {
      date = t.date;
      mode = "3d";
      compare = false;
      await selectScene();
    }
    viewer?.setTour(t.progress);
    tourDisplay();
    remember();
  }
  function tick(now) {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if (!playing) return;
    if (status === "loading") {
      lastTime = 0;
      return;
    }
    const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.15) : 0;
    lastTime = now;
    seconds = Math.min(72, seconds + delta);
    const t = tourAt(seconds, TOUR_DURATION, manifest);
    if (t.date !== date) {
      date = t.date;
      selectScene();
      lastTime = 0;
    }
    viewer?.setTour(t.progress);
    tourDisplay();
    if (seconds >= 72) {
      pause();
      remember();
    }
  }
  async function startTour() {
    pause();
    tour = true;
    compare = false;
    mode = "3d";
    $("#history-tour").hidden = false;
    if (seconds >= 72) seconds = 0;
    date = tourAt(seconds, TOUR_DURATION, manifest).date;
    await selectScene();
    await seek(seconds);
    playing = true;
    tourDisplay();
  }
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-history]");
    if (!b) return;
    try {
      const action = b.dataset.history;
      root.dataset.lastAction = action;
      if (action === "play") {
        if (playing) pause();
        else {
          if (seconds >= 72) await seek(0);
          playing = true;
          tourDisplay();
        }
        return;
      }
      if (action === "tour") {
        await startTour();
        return;
      }
      if (action === "stop-tour") {
        pause();
        tour = false;
        $("#history-tour").hidden = true;
        remember();
        return;
      }
      if (
        [
          "date",
          "previous",
          "next",
          "mode-3d",
          "mode-photos",
          "compare",
          "view",
          "reset",
          "pin",
          "anchor",
        ].includes(action)
      )
        pause();
      if (
        [
          "date",
          "previous",
          "next",
          "mode-3d",
          "mode-photos",
          "compare",
          "view",
          "anchor",
        ].includes(action)
      ) {
        tour = false;
        $("#history-tour").hidden = true;
      }
      if (action === "mode-3d") {
        mode = "3d";
        if (!threeDates.includes(date)) {
          date = threeDates.at(-1);
          onError(
            "This photo date has no 3D reconstruction. Opened the latest recorded 3D visit, " +
              pretty(date) +
              ".",
          );
        }
        if (!threeDates.includes(beforeDate)) beforeDate = threeDates[0];
        await selectScene();
      } else if (action === "mode-photos") {
        mode = "photos";
        display();
      } else if (
        action === "date" ||
        action === "previous" ||
        action === "next"
      ) {
        date =
          action === "date"
            ? b.dataset.date
            : dates()[dates().indexOf(date) + (action === "next" ? 1 : -1)];
        await selectScene();
      } else if (action === "compare") {
        compare = !compare;
        viewer?.setWipe(0.5);
        await selectScene();
      } else if (action === "reset") viewer?.reset();
      else if (action === "view") {
        view = +b.dataset.view;
        mode = "photos";
        display();
      } else if (action === "pin") {
        if (mode === "3d" && status === "ready") {
          picking = !picking;
          viewer?.setPicking(picking);
          display();
        } else onNote(null, frame(date));
      } else if (action === "evidence") onEvidence(frame(date).id);
      else if (action === "note-image") onEvidence(b.dataset.id);
      else if (action === "desk") onPage("evidence");
      else if (action === "edit-note") onEditNote(b.dataset.id);
      else if (action === "anchor") {
        const o = p.observations.find((o) => o.id === b.dataset.id);
        mode = "3d";
        date = o.modelAnchor.date;
        compare = false;
        await selectScene();
        viewer.setAnchor(o.modelAnchor);
      } else if (action === "share" || action === "share-note") {
        pause();
        const o =
          action === "share-note"
            ? p.observations.find((o) => o.id === b.dataset.id)
            : null;
        const source = o
          ? catalog.frames.find((f) => f.id === o.evidenceId)
          : null;
        const selected = o
          ? {
              ...snapshot(),
              date: source.date,
              view: source.view,
              mode: o.modelAnchor ? "3d" : "photos",
              compare: false,
              tour: false,
              camera: o.modelAnchor?.camera,
            }
          : snapshot();
        onShare(
          buildShareURL(location.href, {
            ...selected,
            review: o || undefined,
            observationId: o?.id,
          }),
          !!o,
        );
      } else if (action === "edit-change") {
        $("#history-change-form").hidden = false;
        $("#history-change-form textarea").value = summary().summary;
        $("#history-change-form input").value = summary().author || "";
        $("#history-change-form textarea").focus();
      } else if (action === "cancel-change")
        $("#history-change-form").hidden = true;
      else if (action === "update") {
        pause();
        onUpdate({
          ...snapshot(),
          summary: summary(),
          evidenceIds: [beforeFrame()?.id, frame(date)?.id].filter(Boolean),
        });
      } else if (action === "export") {
        pause();
        if (mode === "3d" && !viewer)
          throw Error("The 3D view is still opening. Export once it is ready.");
        const blob = mode === "3d" ? await viewer.capture() : null;
        await onExport(blob, {
          ...snapshot(),
          summary: summary(),
          frame: frame(date),
          beforeFrame: beforeFrame(),
          renderMode:
            status === "ready"
              ? "derived 3D view"
              : "dated reconstruction still",
        });
      }
    } catch (e) {
      onError(e.message);
    }
  });
  root.addEventListener("input", (e) => {
    const el = e.target;
    if (el.id === "history-slider") {
      pause();
      tour = false;
      $("#history-tour").hidden = true;
      date = dates()[+el.value];
      selectScene();
    }
    if (el.id === "history-wipe") {
      $("#history-divider").style.left = el.value + "%";
      viewer?.setWipe(+el.value / 100);
      const im = $(".still-before");
      if (im) im.style.clipPath = `inset(0 ${100 - Number(el.value)}% 0 0)`;
    }
    if (el.id === "history-tour-slider") {
      pause();
      seek(+el.value);
    }
  });
  root.addEventListener("change", (e) => {
    if (e.target.id === "history-before") {
      pause();
      beforeDate = e.target.value;
      selectScene();
    }
    if (e.target.id === "history-after") {
      pause();
      date = e.target.value;
      selectScene();
    }
    if (e.target.id === "history-before-view") {
      beforeView = +e.target.value;
      display();
    }
  });
  $("#history-change-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (!data.summary.trim() || !data.author.trim()) return;
    const row = {
      beforeDate,
      afterDate: date,
      summary: data.summary.trim(),
      author: data.author.trim(),
      title: `${pretty(beforeDate)} → ${pretty(date)}`,
      kind: "reviewer",
      source: "Reviewer-authored comparison",
      evidenceIds: [beforeFrame().id, frame(date).id],
      updatedAt: new Date().toISOString(),
    };
    p.historyChanges ||= [];
    p.historyChanges = p.historyChanges.filter(
      (c) => c.beforeDate !== beforeDate || c.afterDate !== date,
    );
    p.historyChanges.push(row);
    onSave();
    e.target.hidden = true;
    updateSummary();
  });
  let touchStart;
  $("#history-photos").addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 1)
        touchStart = [e.touches[0].clientX, e.touches[0].clientY];
    },
    { passive: true },
  );
  $("#history-photos").addEventListener(
    "touchend",
    (e) => {
      if (!touchStart) return;
      const dx = e.changedTouches[0].clientX - touchStart[0],
        dy = e.changedTouches[0].clientY - touchStart[1];
      touchStart = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        const i = dates().indexOf(date) + (dx < 0 ? 1 : -1);
        if (dates()[i]) {
          date = dates()[i];
          selectScene();
        }
      }
    },
    { passive: true },
  );
  if (initial.review) {
    const r = initial.review;
    $("#history-shared").innerHTML =
      `<article class="shared-note"><span class="mono">SHARED ${h(r.kind || "REVIEWER")} NOTE · UNVERIFIED</span><h3>${h(r.location)} / ${h(r.stage || "Stage not established")}</h3><p>${h(r.note)}</p><p class="small">${h(r.author)} · ${h(r.evidenceId)} · ${h(r.source)} · Shared in this URL; not an approval.</p>${btn("Open shared source image", "note-image", `data-id="${h(r.evidenceId)}"`)}</article>`;
    if (r.modelAnchor) initial.camera = r.modelAnchor.camera;
  }
  if (initial.warnings?.length) onError(initial.warnings.join(" "));
  selectScene().then(() => {
    if (initial.tour) {
      tour = true;
      $("#history-tour").hidden = false;
      seek(seconds);
    }
  });
  raf = requestAnimationFrame(tick);
  return {
    snapshot,
    refresh: display,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      onRemember?.(snapshot());
      viewer?.dispose();
    },
  };
}
