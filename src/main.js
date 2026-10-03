import "./style.css";
import { mountHistory } from "./history.js";
import {
  parseHistoryLink,
  parseModelAnchor,
  buildShareURL,
} from "./history-model.js";
import { datedViewSheet } from "./history-sheet.js";
import {
  EXAMPLE,
  GATE,
  uid,
  clone,
  escapeHTML as h,
  loadState,
  saveState,
  validateState,
  seedState,
  makeProject,
  validateActivity,
  validateObservation,
  quantityResult,
  generateDocument,
  importPlan,
  csv,
  PLAN_COLUMNS,
  number,
} from "./domain.js";
import { shell, button, input, badge } from "./views.js";
import {
  modalFrame,
  observationForm,
  activityForm,
  quantityForm,
  documentForm,
  drawingMarkForm,
} from "./forms.js";
import {
  fileStem,
  download,
  reportHTML,
  evidencePackage,
  quantityCSV,
  annotatedSheet,
  sampleDrawingData,
} from "./exports.js";
const app = document.getElementById("app"),
  modal = document.getElementById("modal");
let catalog,
  state,
  storageError = false;
let manifest,
  historyController,
  historyInitial = {};
const historyMemory = new Map();
const ui = {
  page: "history",
  compare: false,
  drawingRegion: false,
  activityFilter: "",
  locationFilter: "",
  hiddenOnly: false,
  docId: "",
  drawingId: "",
};
const project = () =>
  state.projects.find((p) => p.id === state.activeProjectId);
const frame = () =>
  catalog.frames.find((f) => f.id === project().selectedEvidenceId);
let toastTimer, docTimer;
function toast(message, error = false) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.className = error ? "show error" : "show";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ""), 7000);
}
function render() {
  historyController?.dispose();
  historyController = null;
  document.body.classList.toggle("history-page", ui.page === "history");
  app.innerHTML = shell(project(), state, ui, catalog);
  if (ui.page === "history") {
    const p = project();
    historyController = mountHistory(document.getElementById("site-history"), {
      project: p,
      catalog,
      manifest,
      initial:
        historyInitial.projectId === p.id
          ? historyInitial
          : historyMemory.get(p.id) || {},
      onRemember: (s) => historyMemory.set(p.id, s),
      onSave: persist,
      onError: toast,
      onEvidence: showEvidence,
      onPage: navigate,
      onEditNote: (id) => actions["edit-observation"](id),
      onNote: (anchor, f) => {
        p.selectedEvidenceId = f.id;
        open(
          observationForm(
            { evidenceId: f.id, modelAnchor: anchor, region: [0, 0, 1, 1] },
            p,
            catalog.frames,
          ),
        );
      },
      onShare: (url, hasNote) =>
        open(
          modalFrame(
            "Share this site view",
            `<p>The link restores this project, dates and camera.${hasNote ? " It also contains the selected reviewer note. Anyone with this link can read it." : " Your local notes and workspace are not included."}</p><label>Shareable review link<textarea id="share-url" rows="5" readonly>${h(url)}</textarea></label><div class="row">${button("Copy link", "copy-share")}<a class="button" href="${h(url)}" target="_blank">Open review link ↗</a></div><p class="small">No account or cloud storage is required. Shared notes are unverified reviewer text; a link does not confer approval.</p>`,
          ),
        ),
      onUpdate: (s) => {
        const period = [s.beforeDate, s.date].sort();
        const d = generateDocument(
          p,
          catalog.frames,
          "Progress report",
          period[0],
          period[1],
          p.activities.map((a) => a.id),
        );
        d.body =
          `# Buyer update · ${p.shortName || p.name}\n${period.join(" → ")}\n\n${s.summary.summary}\nSource: ${s.summary.author ? "Reviewer " + s.summary.author : s.summary.source}.\nBefore/after evidence: ${s.evidenceIds.join(", ")}.\nView: ${s.mode === "3d" ? "Independent Gaussian-splat reconstructions from actual captures; approximate registration." : "Real source photographs; viewpoints may differ."}\n\n` +
          d.body;
        const reportFrameCount = d.evidenceIds.length;
        d.evidenceIds = [...new Set([...d.evidenceIds, ...s.evidenceIds])];
        d.body = d.body.replace(
          `${reportFrameCount} evidence frame(s).`,
          `${d.evidenceIds.length} evidence frame(s), including the selected timeline sources.`,
        );
        d.body +=
          "\n\n## Selected timeline source frames\n\n" +
          s.evidenceIds
            .map((id) => {
              const f = catalog.frames.find((f) => f.id === id);
              return `[${f.id}] ${f.date} · view ${f.view}\nImage: ${f.url}\nOriginal filename: ${f.sourceFile}\nSource: ${f.sourceUrl} · ${f.license}\nOriginal SHA-256: ${f.originalSha256}`;
            })
            .join("\n\n");
        d.title = `Buyer update · ${s.date}`;
        d.history = {
          ...s,
          reviewUrl: buildShareURL(location.href, s),
          camera: s.camera || null,
          surveys:
            s.mode === "3d"
              ? manifest.records.filter((r) =>
                  [s.date, s.beforeDate].includes(r.date),
                )
              : [],
        };
        p.documents.push(d);
        ui.docId = d.id;
        persist();
        navigate("documents");
        toast("Buyer update generated. Review and edit it before sharing.");
      },
      onExport: async (blob, s) =>
        exportFile(
          "SiteCommit-dated-view.png",
          await datedViewSheet(
            blob,
            {
              ...s,
              summaryFrames: catalog.frames.filter(
                (f) =>
                  f.projectId === p.id &&
                  s.summary?.evidenceIds?.includes(f.id),
              ),
              surveys:
                s.mode === "3d"
                  ? manifest.records.filter((r) =>
                      [s.date, s.beforeDate].includes(r.date),
                    )
                  : [],
            },
            p,
          ),
          "image/png",
        ),
    });
    historyInitial = {};
  }
  bindRegion();
  if (storageError)
    document.getElementById("save-state").textContent =
      "Storage unavailable — export backup";
}
function persist() {
  try {
    state.savedAt = saveState(localStorage, state);
    storageError = false;
    document
      .getElementById("save-state")
      ?.replaceChildren(document.createTextNode("Saved locally"));
    return true;
  } catch (e) {
    storageError = true;
    toast(
      "Could not save to this browser. Your changes are still in memory; export a backup now. " +
        e.message,
      true,
    );
    return false;
  }
}
function open(html) {
  modal.innerHTML = html;
  if (!modal.open) modal.showModal();
  if (document.getElementById("quantity-form")) quantityPreview();
}
function close() {
  modal.close();
  ui.drawingRegion = false;
}
function upsert(list, row) {
  const i = list.findIndex((x) => x.id === row.id);
  if (i < 0) list.push(row);
  else list[i] = row;
}
function navigate(page) {
  saveDocumentEdits();
  ui.page = page;
  ui.drawingRegion = false;
  location.hash = page;
  render();
  document.getElementById("main").focus();
  window.scrollTo({ top: 0 });
}
function showEvidence(id) {
  const f = catalog.frames.find(
    (f) => f.id === id && f.projectId === project().id,
  );
  if (!f) throw Error("Evidence does not belong to this project.");
  project().selectedEvidenceId = id;
  ui.page = "evidence";
  ui.drawingId = "";
  persist();
  location.hash = "evidence";
  render();
  window.scrollTo({ top: 0 });
}
function formObject(form) {
  return Object.fromEntries(new FormData(form));
}
function quantityPreview() {
  const form = document.getElementById("quantity-form");
  if (!form) return;
  const q = formObject(form),
    r = quantityResult(q);
  document
    .querySelectorAll("[data-dimension]")
    .forEach(
      (el) =>
        (el.closest("label").hidden = !r.fields.includes(el.dataset.dimension)),
    );
  document.getElementById("quantity-preview").textContent =
    r.net === null
      ? `Quantity unknown. Needs: ${r.missing.join(", ")}. ${r.limit}`
      : `${r.formula} = ${r.net.toFixed(3)} ${r.unit}. Draft − entered bill: ${r.difference === null ? "unknown" : r.difference.toFixed(3) + " " + r.unit}. Input arithmetic only; independent validation required.`;
}
function saveDocumentEdits() {
  const el = document.getElementById("document-body");
  if (!el) return;
  const d = project().documents.find((d) => d.id === el.dataset.docId);
  if (d && d.body !== el.value) {
    d.body = el.value;
    d.updatedAt = new Date().toISOString();
    persist();
  }
  clearTimeout(docTimer);
}
function evidenceSheetArgs() {
  const p = project(),
    f = frame(),
    d =
      ui.page === "sketch"
        ? p.drawings.find((d) => d.id === ui.drawingId)
        : null;
  if (!f && !d) throw Error("No source image selected.");
  const marks = d
    ? d.marks
    : p.observations.filter((o) => o.evidenceId === f.id);
  return {
    imageUrl: d?.data || f.url,
    title: d?.name || "Evidence sheet",
    date: f?.date || "not provided",
    projectName: p.name,
    marks,
    disclosure:
      d?.origin === EXAMPLE || marks.some((m) => m.kind === "sample")
        ? EXAMPLE
        : "Reviewer-authored annotations · draft, not a dimensional survey",
    frame: d ? null : f,
  };
}
async function exportFile(name, content, type) {
  const blob = download(name, content, type);
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("qa")) {
    const response = await fetch("/__qa-export/" + name, {
      method: "POST",
      body: blob,
    });
    if (!response.ok)
      throw Error("Download started, but local QA copy failed.");
  }
  toast(`Downloaded ${name}`);
  return blob;
}
async function chooseFile(accept, handler) {
  const input = document.getElementById("file-input");
  input.accept = accept;
  input.value = "";
  input.onchange = async () => {
    try {
      const f = input.files[0];
      if (f) await handler(f);
    } catch (e) {
      toast(e.message, true);
    }
  };
  input.click();
}
function projectsModal() {
  open(
    modalFrame(
      "Projects",
      `<div class="project-cards">${state.projects
        .map((p) => {
          const pf = catalog.frames.filter((f) => f.projectId === p.id),
            last = pf.at(-1);
          return `<article class="panel padded">${last ? `<img class="project-cover" src="${h(last.url)}" alt="${h(p.name)}">` : ""}<h3>${h(p.name)}</h3><p>${h(p.description || "Independent project")}</p><p class="mono">LAST EVIDENCE ${last?.date || "NOT PROVIDED"} · ${p.observations.filter((o) => o.review === "reviewed").length} REVIEWED RECORDS</p>${button("Open project", "switch-project", p.id, "primary")}</article>`;
        })
        .join(
          "",
        )}</div><hr><div class="row">${button("Export workspace backup", "backup")}${button("Restore workspace backup", "restore")}</div><hr><form id="project-form"><h3>Create a separate project</h3>${input("name", "Project name", "", "text", "required")}${input("description", "Project context")}<button class="primary">Create project</button><p class="small">A new project starts without evidence. Public records are never reassigned to a different site.</p></form>`,
    ),
  );
}
function sourcesModal() {
  const p = project(),
    frames = catalog.frames.filter((f) => f.projectId === p.id);
  open(
    modalFrame(
      "Source, rights and limits",
      `<h3>${h(p.name)}</h3><p>${h(p.description)}</p><p>${h(p.credit || "Source not supplied")} · ${h(p.license || "Rights not supplied")}</p>${p.sourceUrl ? `<a href="${h(p.sourceUrl)}" target="_blank" rel="noopener">Original dataset ↗</a>` : ""}<p>${h(p.baseline || "Owner schedule not supplied")}</p><p>${EXAMPLE}: seeded schedules and sample annotations. No sample quantities, approvals, labor counts or billing records are represented as site-owner data.</p><p>Stages are manually reviewed. No automated classifier, calibrated image measurement or live CCTV is implemented. Resource values are entered, never inferred from people in images.</p><p class="small">${frames.length} bundled source images · ${new Set(frames.map((f) => f.date)).size} actual dates. Independently named projects retain separate evidence and plans.</p><a href="./data/evidence/catalog.json" target="_blank">iVISION provenance JSON</a> · <a href="./data/evidence/montijo.json" target="_blank">Montijo provenance JSON</a>`,
    ),
  );
}
const actions = {
  "copy-share": async () => {
    const el = document.getElementById("share-url");
    try {
      await navigator.clipboard.writeText(el.value);
      toast("Review link copied.");
    } catch {
      el.select();
      toast("Select and copy the review link.");
    }
  },
  "show-model-note": (id) => {
    const o = project().observations.find((o) => o.id === id);
    historyInitial = {
      projectId: project().id,
      mode: "3d",
      date: o.modelAnchor.date,
      camera: o.modelAnchor.camera,
      observationId: id,
    };
    navigate("history");
  },
  navigate: (id) => navigate(id),
  "close-modal": close,
  projects: projectsModal,
  sources: sourcesModal,
  "switch-project": (id) => {
    saveDocumentEdits();
    state.activeProjectId = id;
    Object.assign(ui, {
      page: "history",
      compare: false,
      activityFilter: "",
      locationFilter: "",
      hiddenOnly: false,
      docId: "",
      drawingId: "",
    });
    close();
    persist();
    render();
  },
  "show-evidence": showEvidence,
  date: (date) => {
    const f = catalog.frames.find(
      (f) => f.projectId === project().id && f.date === date,
    );
    if (f) showEvidence(f.id);
  },
  "toggle-compare": () => {
    ui.compare = !ui.compare;
    render();
  },
  "mark-region": () => {
    if (ui.compare) ui.compare = false;
    ui.drawingRegion = true;
    render();
    toast(
      "Drag an area on the image. Keyboard alternative: add an observation and enter region percentages.",
    );
  },
  "new-observation": () =>
    open(
      observationForm(
        { activityId: ui.activityFilter },
        project(),
        catalog.frames,
      ),
    ),
  "edit-observation": (id) =>
    open(
      observationForm(
        project().observations.find((o) => o.id === id),
        project(),
        catalog.frames,
      ),
    ),
  "new-activity": () => open(activityForm()),
  "edit-activity": (id) =>
    open(activityForm(project().activities.find((a) => a.id === id))),
  "activity-evidence": (id) => {
    ui.activityFilter = id;
    ui.locationFilter = "";
    ui.hiddenOnly = false;
    const o = project().observations.find((o) => o.activityId === id);
    if (o) project().selectedEvidenceId = o.evidenceId;
    navigate("evidence");
  },
  "new-quantity": () => open(quantityForm({}, project(), catalog.frames)),
  "edit-quantity": (id) =>
    open(
      quantityForm(
        project().quantities.find((q) => q.id === id),
        project(),
        catalog.frames,
      ),
    ),
  "new-document": (type) => open(documentForm(type, project(), catalog.frames)),
  "regenerate-doc": (id) => {
    saveDocumentEdits();
    const d = project().documents.find((d) => d.id === id);
    open(documentForm(d.type, project(), catalog.frames, d));
  },
  "select-doc": (id) => {
    saveDocumentEdits();
    ui.docId = id;
    render();
  },
  "save-doc": () => {
    saveDocumentEdits();
    if (persist()) toast("Draft edits saved locally.");
  },
  "export-md": (id) => {
    saveDocumentEdits();
    const d = project().documents.find((d) => d.id === id);
    return exportFile(
      fileStem(d.type) + ".md",
      `${GATE}\n${d.baselineDisclosure}\n\n${d.body}`,
      "text/markdown",
    );
  },
  "export-html": (id) => {
    saveDocumentEdits();
    const d = project().documents.find((d) => d.id === id);
    return exportFile(
      fileStem(d.type) + ".html",
      reportHTML(d, project(), catalog.frames),
      "text/html",
    );
  },
  "export-package": async (id) => {
    saveDocumentEdits();
    const d = project().documents.find((d) => d.id === id);
    toast("Collecting cited images and source records…");
    const sheets = [];
    for (const evidenceId of d.evidenceIds) {
      const f = catalog.frames.find((f) => f.id === evidenceId);
      const marks = d.snapshot.observations.filter(
        (o) => o.evidenceId === evidenceId,
      );
      if (marks.length)
        sheets.push({
          name: evidenceId + ".png",
          blob: await annotatedSheet({
            imageUrl: f.url,
            title: "Evidence sheet",
            date: f.date,
            projectName: project().name,
            marks,
            frame: f,
            disclosure: d.baselineDisclosure,
          }),
        });
    }
    const bytes = await evidencePackage(d, project(), catalog.frames, sheets);
    return exportFile(
      "SiteCommit-evidence-package.zip",
      bytes,
      "application/zip",
    );
  },
  "export-sheet": async () => {
    const args = evidenceSheetArgs();
    return exportFile(
      "SiteCommit-annotated-sheet.png",
      await annotatedSheet(args),
      "image/png",
    );
  },
  "export-plan": () =>
    exportFile(
      "SiteCommit-plan.csv",
      csv(project().activities, PLAN_COLUMNS),
      "text/csv",
    ),
  "export-quantities": () =>
    exportFile(
      "SiteCommit-quantity-drafts.csv",
      quantityCSV(project().quantities),
      "text/csv",
    ),
  "import-plan": () =>
    chooseFile(".csv,text/csv", async (f) => {
      if (f.size > 1e6) throw Error("CSV must be under 1 MB.");
      const rows = importPlan(await f.text(), project());
      rows.forEach((row) => upsert(project().activities, row));
      persist();
      render();
      toast(`Imported ${rows.length} rows; existing linked rows retained.`);
    }),
  backup: () => {
    saveDocumentEdits();
    return exportFile(
      "SiteCommit-workspace-backup.json",
      JSON.stringify(state, null, 2),
      "application/json",
    );
  },
  restore: () =>
    chooseFile(".json,application/json", async (f) => {
      if (f.size > 8e6) throw Error("Backup too large.");
      const candidate = validateState(JSON.parse(await f.text()), catalog);
      download(
        "SiteCommit-before-restore.json",
        JSON.stringify(state, null, 2),
        "application/json",
      );
      state = candidate;
      close();
      ui.page = "evidence";
      ui.docId = "";
      ui.drawingId = "";
      persist();
      render();
      toast("Backup restored. Previous workspace downloaded for recovery.");
    }),
  "example-sketch": () => {
    const p = project();
    let d = p.drawings.find((d) => d.origin === EXAMPLE);
    if (!d) {
      d = {
        id: uid("drawing"),
        name: "Example work-area sketch",
        origin: EXAMPLE,
        data: sampleDrawingData(),
        width: 1400,
        height: 900,
        marks: [],
      };
      p.drawings.push(d);
    }
    ui.drawingId = d.id;
    persist();
    render();
  },
  "attach-drawing": () =>
    chooseFile("image/png,image/jpeg,image/webp", async (f) => {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(f.type) ||
        f.size > 12e6
      )
        throw Error("Use a PNG, JPEG or WebP under 12 MB.");
      const url = URL.createObjectURL(f),
        im = new Image();
      im.src = url;
      try {
        await im.decode();
        const c = document.createElement("canvas");
        const ratio = Math.min(1, 1400 / im.width);
        c.width = Math.round(im.width * ratio);
        c.height = Math.round(im.height * ratio);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        const d = {
          id: uid("drawing"),
          name: f.name,
          origin: "Reviewer-attached drawing; source unverified",
          data: c.toDataURL("image/png"),
          width: c.width,
          height: c.height,
          marks: [],
        };
        project().drawings.push(d);
        ui.drawingId = d.id;
        persist();
        render();
        toast(
          "Drawing attached locally. Add sourced dimensions and evidence links.",
        );
      } finally {
        URL.revokeObjectURL(url);
      }
    }),
  "new-drawing-mark": () =>
    open(drawingMarkForm({}, project(), catalog.frames)),
  "edit-drawing-mark": (id) =>
    open(
      drawingMarkForm(
        project()
          .drawings.find((d) => d.id === ui.drawingId)
          .marks.find((m) => m.id === id),
        project(),
        catalog.frames,
      ),
    ),
  "retrieve-hidden": (id) => {
    const o = project().observations.find((o) => o.id === id),
      f = catalog.frames.find((f) => f.id === o.evidenceId),
      later = catalog.frames
        .filter((x) => x.projectId === project().id && x.date > f.date)
        .at(-1);
    project().beforeEvidenceId = f.id;
    project().selectedEvidenceId = later.id;
    ui.compare = true;
    ui.hiddenOnly = true;
    ui.locationFilter = o.location;
    navigate("evidence");
  },
};
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  try {
    const fn = actions[b.dataset.action];
    if (!fn) throw Error("Action unavailable.");
    await fn(b.dataset.id);
  } catch (error) {
    toast(error.message, true);
  }
});
document.addEventListener("submit", (e) => {
  if (!modal.contains(e.target)) return;
  e.preventDefault();
  const form = e.target,
    p = project(),
    data = formObject(form);
  try {
    if (form.getAttribute("id") === "observation-form") {
      data.id = data.id || uid("obs");
      data.modelAnchor = data.modelAnchor
        ? parseModelAnchor(data.modelAnchor, p, catalog, manifest)
        : null;
      data.region = ["x", "y", "w", "h"].map(
        (k) => Number(data["region" + k]) / 100,
      );
      data.hiddenWork = new FormData(form).has("hiddenWork");
      data.updatedAt = new Date().toISOString();
      validateObservation(data, p, catalog.frames);
      if (data.dimensionNote && !data.dimensionSource)
        throw Error("Add a source for the dimension label.");
      upsert(p.observations, data);
    } else if (form.getAttribute("id") === "activity-form") {
      data.id = data.id || uid("wp");
      validateActivity(data);
      for (const k of ["labor", "equipment", "material", "budget"])
        if (data[k] !== "" && number(data[k]) === null)
          throw Error("Costs must be non-negative numbers.");
      upsert(p.activities, data);
    } else if (form.getAttribute("id") === "quantity-form") {
      data.id = data.id || uid("q");
      if (
        !p.activities.some((a) => a.id === data.activityId) ||
        !catalog.frames.some(
          (f) => f.id === data.evidenceId && f.projectId === p.id,
        )
      )
        throw Error("Choose a work package and evidence from this project.");
      if (data.billQuantity !== "" && !data.billSource.trim())
        throw Error(
          "State whether the billing entry is illustrative or provide its real source.",
        );
      if (data.drawingId && !p.drawings.some((d) => d.id === data.drawingId))
        throw Error("Drawing is not in this project.");
      if (
        data.review === "inputs checked — not approved" &&
        (quantityResult(data).missing.length ||
          !data.reviewer.trim() ||
          !data.validation.trim())
      )
        throw Error(
          "Checking inputs requires complete arithmetic, a named reviewer and a validation basis.",
        );
      upsert(p.quantities, data);
    } else if (form.getAttribute("id") === "document-form") {
      const doc = generateDocument(
        p,
        catalog.frames,
        data.type,
        data.from,
        data.to,
        new FormData(form).getAll("activityIds"),
      );
      p.documents.push(doc);
      ui.docId = doc.id;
      ui.page = "documents";
      location.hash = "documents";
    } else if (form.getAttribute("id") === "drawing-mark-form") {
      const r = ["x", "y", "w", "h"].map(
        (k) => Number(data["region" + k]) / 100,
      );
      if (
        r[0] + r[2] > 1.001 ||
        r[1] + r[3] > 1.001 ||
        r.some((v) => v < 0) ||
        r[2] <= 0 ||
        r[3] <= 0
      )
        throw Error("Callout must stay inside the drawing.");
      if (data.dimensionNote && !data.dimensionSource)
        throw Error("Enter a source for that dimension.");
      if (
        !catalog.frames.some(
          (f) => f.id === data.evidenceId && f.projectId === p.id,
        )
      )
        throw Error("Choose source evidence.");
      data.id = data.id || uid("mark");
      data.region = r;
      data.review = "draft";
      upsert(p.drawings.find((d) => d.id === ui.drawingId).marks, data);
    } else if (form.getAttribute("id") === "project-form") {
      const id = uid("project"),
        p = makeProject(
          {
            id,
            name: data.name,
            shortName: data.name,
            description: data.description,
            sourceUrl: "",
            license: "",
            splatDates: [],
          },
          [],
        );
      p.activities = [];
      state.projects.push(p);
      state.activeProjectId = id;
      ui.page = "evidence";
    } else return;
    const saved = persist();
    close();
    if (ui.page === "history" && historyController) historyController.refresh();
    else render();
    if (saved) toast("Saved locally.");
  } catch (error) {
    document.getElementById("form-error").textContent = error.message;
  }
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.closest("#quantity-form")) quantityPreview();
  if (el.dataset.filter) {
    ui[el.dataset.filter] = el.type === "checkbox" ? el.checked : el.value;
    render();
  }
  if (el.id === "date-slider") {
    const dates = [
      ...new Set(
        catalog.frames
          .filter((f) => f.projectId === project().id)
          .map((f) => f.date),
      ),
    ].sort();
    actions.date(dates[+el.value]);
  }
  if (el.id === "before-select") {
    project().beforeEvidenceId = el.value;
    persist();
    render();
  }
  if (el.id === "drawing-select") {
    ui.drawingId = el.value;
    render();
  }
});
document.addEventListener("input", (e) => {
  if (e.target.closest("#quantity-form")) quantityPreview();
  if (e.target.id === "document-body") {
    document.getElementById("save-state").textContent = "Saving draft…";
    clearTimeout(docTimer);
    docTimer = setTimeout(saveDocumentEdits, 400);
  }
});
window.addEventListener("beforeunload", saveDocumentEdits);
window.addEventListener("hashchange", () => {
  const shared = parseHistoryLink(location.href, catalog, manifest);
  if (shared && location.hash.includes("?")) {
    historyInitial = shared;
    state.activeProjectId = shared.projectId;
    ui.page = "history";
    render();
    return;
  }
  const page = location.hash.slice(1);
  if (
    [
      "history",
      "evidence",
      "plan",
      "quantities",
      "sketch",
      "documents",
      "review",
    ].includes(page) &&
    page !== ui.page
  ) {
    saveDocumentEdits();
    ui.page = page;
    render();
  }
});
function bindRegion() {
  const surface = document.getElementById("image-surface");
  if (!surface) return;
  surface.classList.toggle("drawing", ui.drawingRegion);
  let start = null;
  const norm = (e) => {
    const b = surface.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)),
      Math.max(0, Math.min(1, (e.clientY - b.top) / b.height)),
    ];
  };
  surface.onpointerdown = (e) => {
    if (!ui.drawingRegion) return;
    e.preventDefault();
    start = norm(e);
    surface.setPointerCapture(e.pointerId);
  };
  surface.onpointermove = (e) => {
    if (!start) return;
    const end = norm(e),
      svg = document.getElementById("image-overlay"),
      rect = document.getElementById("pending-region");
    const [, , w, h] = svg.getAttribute("viewBox").split(" ").map(Number);
    rect.setAttribute("x", Math.min(start[0], end[0]) * w);
    rect.setAttribute("y", Math.min(start[1], end[1]) * h);
    rect.setAttribute("width", Math.abs(end[0] - start[0]) * w);
    rect.setAttribute("height", Math.abs(end[1] - start[1]) * h);
    rect.setAttribute("visibility", "visible");
  };
  surface.onpointerup = (e) => {
    if (!start) return;
    const end = norm(e),
      r = [
        Math.min(start[0], end[0]),
        Math.min(start[1], end[1]),
        Math.abs(end[0] - start[0]),
        Math.abs(end[1] - start[1]),
      ];
    start = null;
    if (r[2] < 0.01 || r[3] < 0.01) {
      toast("Mark an area at least 1% of the image width and height.");
      return;
    }
    ui.drawingRegion = false;
    if (ui.page === "sketch" && ui.drawingId)
      open(drawingMarkForm({}, project(), catalog.frames, r));
    else
      open(
        observationForm(
          { activityId: ui.activityFilter },
          project(),
          catalog.frames,
          r,
        ),
      );
  };
  surface.onpointercancel = () => {
    start = null;
  };
}
async function start() {
  const [a, b, c] = await Promise.all([
    fetch("./data/evidence/catalog.json"),
    fetch("./data/evidence/montijo.json"),
    fetch("./data/surveys/manifest.json"),
  ]);
  if (!a.ok || !b.ok || !c.ok)
    throw Error(
      "Evidence catalog unavailable. Run the evidence preparation scripts.",
    );
  catalog = await a.json();
  manifest = await c.json();
  const mt = await b.json();
  catalog.projects.push(mt.project);
  catalog.frames.push(...mt.frames);
  try {
    state = loadState(localStorage, catalog);
  } catch (e) {
    try {
      localStorage.setItem(
        "sitecommit.recovery.v3",
        localStorage.getItem("sitecommit.workspace.v3") || "",
      );
    } catch {}
    state = seedState(catalog);
    storageError = true;
    toast(
      "Saved workspace could not be read. Recovery copy retained as sitecommit.recovery.v3 where storage allows. Use Restore with a valid backup. " +
        e.message,
      true,
    );
  }
  const page = location.hash.slice(1);
  const shared = parseHistoryLink(location.href, catalog, manifest);
  if (shared) {
    historyInitial = shared;
    state.activeProjectId = shared.projectId;
    ui.page = "history";
  }
  if (
    [
      "history",
      "evidence",
      "plan",
      "quantities",
      "sketch",
      "documents",
      "review",
    ].includes(page)
  )
    ui.page = page;
  render();
}
start().catch((e) => {
  app.innerHTML = `<section class="empty"><h1>Workspace could not open</h1><p>${h(e.message)}</p><button onclick="location.reload()">Try again</button></section>`;
});
