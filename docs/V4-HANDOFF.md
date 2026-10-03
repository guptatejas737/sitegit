# SiteCommit v4 — history first, evidence attached

This release restores the 3D site history as the first screen of a fresh iVISION workspace. A visitor can orbit a dated reconstruction, compare visits, watch a short guided camera sequence and open the original photos. The existing evidence desk remains the place to review observations, plan dates, quantities and documents. Public deployment target: [sitecommit.vercel.app](https://sitecommit.vercel.app); source: [guptatejas737/sitegit](https://github.com/guptatejas737/sitegit).

**Release verification status: deployed and checked on the same public URL.** Application commit `73fe06d8021db29a6c28617affb085be839ba560` was pushed and deployed; final local tests and the production smoke checks below passed. This final documentation update records the results without changing the deployed application. Testing used desktop Chromium at desktop and 390px viewports, not a physical phone.

## What is restored and new

- **Embedded 3D history:** the verified Spark renderer loads the three independently trained iVISION epochs inside the main product. Orbit/zoom, reset, keyboard camera controls, date buttons, a keyboard-operable slider and previous/next are part of this screen. The old `survey.html` route and its assets remain a regression reference.
- **Photo history beside 3D:** twelve actual iVISION dates, four bundled source views each. Switching to photos retains the current date when available. Photos-only dates are explicitly marked. Returning to 3D from a date without a model explains which actual 3D visit opens; it never silently invents an epoch. Montijo opens its own photo history.
- **Compare:** select any two available model dates and orbit both with one shared camera, revealing them with a wipe divider. Photo comparison allows independent before/after dates and source views. Photo framing can differ; synchronized model cameras do not establish precise registration.
- **Walkthrough:** a nominal 72-second camera orbit steps through the three real visits with source-based editorial captions. It can pause and scrub. It is a guided aerial viewing path, not a recorded on-site walking route or synthetic construction morph. Loading pauses can extend elapsed time. A shared walkthrough link restores the selected position for the recipient to play.
- **Progress summary:** each comparison has a plainly attributed editorial description or a saved reviewer-authored note, with before/after source photos. No geometric completion percentage or automated material classification is calculated.
- **Notes connected to the model:** selecting a place stores an approximate splat intersection when picking succeeds, otherwise a camera viewpoint. The note retains the real survey date, source photo, work package, location, reviewer/stage/review state and optional hidden-work flag. Saved notes can return to that viewpoint. A picked 3D position is not projected into the source image as a claimed matching pixel; the photo region is edited separately.
- **Shareable review:** a view link encodes the public project, dates, photo views and camera. Ordinary links omit local notes. The separate share-note action explicitly embeds only the selected reviewer note and explains that anyone holding the link can read it. Recipients see it as unverified shared text. This is a portable review link, not authenticated collaboration, a cloud record or a signature.
- **Buyer update and evidence export:** a history action creates an editable progress-report draft using the selected period, summary, reviewer records and exact source image IDs. The existing document editor saves revisions locally and exports Markdown, HTML and an evidence ZIP. History-generated packages also retain a reopening link, saved camera/model context and verified dated model stills; SPZ files remain cited app assets rather than being copied into the ZIP. Dated-view PNG export captures the selected rendered view or honestly labeled fallback still and includes its dates, source and interpretation limits. The evidence ZIP and dated-view PNG are separate outputs.

The existing desk workflows are retained: source-image region observations; editable/importable/exportable plan; supported date variance; entered or drawing-derived quantity calculations; missing-input states; clutter deductions with stated numerical sources; bill comparison and a human review gate; drawing/image markup; six document types; before-covering retrieval; local backups/restoration; independently named projects. Their earlier exercise is documented in [v3 QA](WORKSPACE-QA.md). Relevant v4 regressions belong in the release record below.

## Real data and what it supports

**iVISION — Waterloo construction:** public [Fall 2024 source](https://www.kaggle.com/datasets/danielmao2019/ivision-fall2024), MIT license confirmed by its public publisher API. The bundled photo sample has 48 actual images, four per date, across 27 September–7 December 2024. The three reconstructed dates are **27 September, 18 October and 27 November 2024**, each with 60 registered source cameras. The current largest model has **286,500 Gaussians**. Source hashes, reconstruction reports and SPZ checksums are retained. These were genuine prior COLMAP → Brush training runs; v4 does not claim additional training or a production upload pipeline.

This remains the primary project because it combines verified independently hosted models with overlapping multi-view captures and a longer dated photo record. It supports visual progress context, attributable images and human review. It does not supply an owner schedule, bill of quantities, verified dimensions or contractual records. Other open reconstruction and progress-monitoring work informed the build; see [primary references and reuse decisions](V4-REFERENCES.md) and [data-selection details](DATA-SELECTION.md).

**Montijo — separate project:** the [Zenodo record](https://zenodo.org/records/21055820), credited to Rui Barros Garcia and Ruben Pereira Silva of Garcia, Garcia S.A., is CC BY 4.0. Earlier archive inspection verified 3,289 JPEGs across 98 filename dates, **3 September 2025–16 June 2026**; twelve representative dates are bundled. The descriptive date range on the publisher record is inconsistent with its filenames, and framing/orientation changes across recording periods. These fixed-position sequential photographs do not establish simultaneous overlapping views suitable for genuine per-date reconstruction. Montijo is therefore a clearly separate photo timeline, with no invented splat, exact pixel alignment or continuity with iVISION.

Original photographs are marked **real capture**; splats and their stills are **derived 3D**. The preparation/groundworks/foundations labels and initial change prose are editorial readings, not original milestone metadata. Saved stage and QA notes are reviewer entries. Publicly available imagery is not evidence of validated automatic detection or dimensional accuracy.

## Illustrative inputs and required validation

The example schedule and generated example sketch retain **“Illustrative example, created for this demo.”** Whenever a document uses those activities or seeded sample annotations, the disclosure remains in the generated text and relevant exports. Buyer updates that include the default plan are therefore partly illustrative even though the source captures are real. No seeded quantity becomes a contractual measurement by appearing next to a photo.

Unseen faces, wall thickness, scale, clutter, snow, occlusion and incomplete coverage can prevent a valid result. Model anchors are approximate context, not survey points. Reconstruction alignment is approximate. Entered dimensions have the source and review state supplied by the reviewer; a drawing reference is not camera measurement. Billing and measurement drafts still need independent field checks and a named human review process. The roughly 98–99% confidence requirement is a validation goal, never an achieved product claim.

Remaining product limits: local browser storage rather than a multi-user backend; editable author fields rather than verified identity/signature; URL-contained notes rather than access-controlled sharing; no automatic defect/stage classifier, physical change heatmap, live feed, PM-system integration, labour inference or calibrated measurement. Clearing site data can erase local records, so export a workspace backup. Captures and dates remain unevenly spaced; “weekly walkthrough” describes the intended use, not the real sample cadence.

Cold loading is still material on a slow connection. In the recorded local profile, the November SPZ alone transferred in about 22 seconds; renderer download and first-use shader preparation are separate costs. Showing a dated still during that wait does not mean the interactive model is ready. Warm date changes reuse loaded records, but no physical-handset frame-rate guarantee has been established.

## Run, verify and deploy the same project

Use Node 22+ from the repository directory:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4173/`. Use `?fallback=1` to exercise the dated-still fallback. The real app data is bundled; downloads, reconstruction tools, GPU training and Kaggle credentials are unnecessary to run this release. The optional reconstruction/reproduction process remains documented in [`pipeline/README.md`](../pipeline/README.md).

```sh
npm test
npm run verify
npm run build
```

The static output is `dist/`. `npm run preview` serves it on port 4173; stop the dev server before using the same port. The existing Vercel configuration builds with Vite and serves `dist`. Deploy an authorized release from the repository's existing `.vercel` link with:

```sh
vercel --prod
```

If starting from a fresh clone, link the **existing `sitecommit` Vercel project** first rather than creating a new project or alias. The production URL remains `https://sitecommit.vercel.app/`. For future releases, a successful deployment command is insufficient by itself: open that exact URL and exercise the initial 3D view, timeline, compare, walkthrough and real export. The current deployed commit and actual results are recorded below.

For a repeatable limited-network check of the built app:

```sh
python scripts/throttled-preview.py --root dist --port 4184 --kbps 1600 --latency-ms 150
```

Open `http://127.0.0.1:4184/` in a fresh tab at 390px width. This adds 150ms before each response and limits **each connection** to 1,600 decimal kilobits/s. Concurrent requests are independently capped, so aggregate throughput can be higher. External fonts are outside the local profile. The script disables HTTP caching, preserves binary bytes and emits per-transfer timings; it does **not** emulate CPU/GPU limits or physical-phone performance. Actual shader compilation, first model readiness and interaction results must be reported separately.

## File map

| Files | Purpose |
| --- | --- |
| `src/history.js`, `src/history.css` | Integrated history screen, timeline, photo views, comparison controls, walkthrough, notes, buyer update and sharing actions |
| `src/history-viewer.js` | Embedded Spark renderer, one-camera comparison, on-demand drawing, loading/error states, approximate model picking and rendered capture |
| `src/history-model.js` | Project/date validation, exact photo lookup, source-based summaries, bounded camera/anchor and share-link payloads, walkthrough time model |
| `src/history-sheet.js` | Dated-view PNG with attribution and interpretation limits |
| `src/main.js`, `src/views.js`, `src/forms.js` | Default history navigation and connections to retained evidence/document workflows |
| `src/domain.js` | Validation/persistence of model anchors and reviewer change notes; inclusion in generated documents |
| `src/exports.js` | Complete edited report text, safe reopening link, model context and verified dated stills in evidence packages |
| `tests/history.test.mjs`, `tests/history-records.test.mjs` | Date/project boundaries, share links, camera/anchor validation, walkthrough model, persistence and source-linked document regressions |
| `tests/history-sheet.test.mjs` | Dated-view export layout and source-linked comparison sheet regressions |
| `scripts/throttled-preview.py` | Local limited-network preview and transfer logging |
| `public/licenses/IVISION-MIT.txt` | Corrected dataset notice scope; no relicensing of imagery |
| `README.md`, `CHANGELOG.md`, `docs/V4-REFERENCES.md`, `docs/V4-HANDOFF.md` | Run/deployment guide, release record, primary-source decisions and known limits |

`src/survey.js`, `src/survey.css`, `survey.html`, the original SPZs, stills and per-date provenance are preserved. The original domain tests continue to support the evidence desk. The final git diff is the authority for any additional integration fixes made during QA.

## Release verification record

The following entries are from the v4 browser and export exercise. v3 screenshots are not used as proof of the restored v4 initial screen.

| Check | v4 outcome |
| --- | --- |
| Automated tests / exact count | Final local `npm test`: **49/49 passed** |
| Three SPZ assets, stills and sixty photo derivatives | Final `npm run verify` passed all three SPZ records and sixty photo derivatives |
| Production build / warnings | Final `npm run build` passed with the known large Spark chunk warning; `git diff --check` passed |
| Desktop: initial 3D, dates, orbit, compare, walkthrough | At 1440 × 1000, actual model rendering/orbit verified; September or October compared against November in the 3D wipe. Walkthrough played through 37 seconds, changing September → October and camera; pause and seeks to 35/72 seconds exercised |
| 390px and retained desk pages | At 390 × 844 and desktop width, all seven pages captured and visually reviewed. Photo comparison loaded 2 October view 2 against 7 December view 4. Phone walkthrough played through 45 seconds, advancing September → October; pause and seek to 30 seconds worked |
| Model note: source/date mapping, reload and return | Derived-intersection note attached to the 27 November source frame, saved, reloaded; generated report retained its anchor. The direct return-to-3D button reopened the saved date and camera |
| Buyer update: edit/save/reload | Manual comparison summary saved; buyer update generated, edited and retained after refresh. Selected before/after source IDs included. Exported HTML retained its full buyer-update heading, summary and notes |
| PNG outputs | Visually inspected the final actual rendered 3D-view PNG (2,088,594 bytes), including summary context, source and model hashes, and the two-photo comparison PNG (2,187,870 bytes). The photo sheet shows 2 October view 2 and 7 December view 1 with correct images, dates, source hashes and license information |
| Evidence ZIP / offline review | Downloaded roughly 6.44 MB ZIP, extracted and inspected all 17 entries: two verified September/November survey records in `model-context.json`; two dated model stills; three source photographs, all loaded offline; one annotation sheet; one drawing PNG plus JSON; plan/quantity records and observations including the model anchor. Rendered the extracted review document |
| Share view/note: reopened with no sender-local state | Opened the shared link on a separate localhost origin containing zero local notes. It restored the November model and source photo and displayed the embedded reviewer note as unverified. Ordinary local workspace records were not implied to be synchronized |
| Throttled fresh-tab load and interaction | At 390px, fresh tab reached an actual WebGL frame; keyboard orbit changed camera/render count; September/November comparison reached another rendered frame. November 4,358,946-byte SPZ transferred in 21.969s, September 3,541,224-byte SPZ in about 18s. The uncompressed Spark transfer in this pre-optimization profile took 13.235s. These are transfer timings, not total readiness/FPS or physical-phone results |
| Fallback and separate data | Forced fallback changed September → November with dated images loaded and comparison available. Montijo showed twelve photo dates, disabled 3D and no undefined image requests. Production fallback comparison and separate Montijo history were also inspected at 390px without horizontal page overflow |
| Original `survey.html` regression | Loaded the latest model with 286,500 Gaussians; Compare previous displayed October/November. Viewport screenshot `qa/v4/legacy-survey.png` visually reviewed |
| Console / loading / layout review | No application console errors observed in the slow-profile exercise. All seven page layouts reviewed at both widths; dated stills remained available while the interactive model loaded |
| Git commit and same-project production deployment | App commit `73fe06d8021db29a6c28617affb085be839ba560` pushed to `main` and `codex/3d-site-history`. Existing project deployment `dpl_9fd2YnvjQBgSh2pECbmYJo9QTBNs` reached READY at `https://sitecommit-gkh7mmeaq-pointwise-labs.vercel.app`, aliased to the same `https://sitecommit.vercel.app/` |
| Live initial 3D, timeline and compare | Fresh root-page load rendered the November model. Slider Home rendered September; End returned to November. September/November comparison rendered with divider at 51%. These checks observed actual WebGL frames rather than only fallback images |
| Live walkthrough and 390px shared view | Walkthrough played through 33 seconds, advanced September → October and changed camera; pause and seek to 35 seconds worked. Shared tour opened at 390px with model ready, 35/72-second clock and Play control, without horizontal overflow |
| Live photo comparison | At phone width, 2 October and 7 December source photographs both loaded for comparison with their actual dates. A final CSS-only follow-up moved the navigation hint clear of both date captions; rebuilt, redeployed and visually checked on the live URL |
| Live buyer update and evidence ZIP | Created a buyer update with ten source frames; downloaded the actual 6,927,546-byte Windows ZIP. Inspected 21 entries with clean CRCs: ten source photos, two dated model stills, model context with camera and the production reopening URL. Checked source count, selected-timeline register and human-review gate |
| Live console and screenshots | Zero observed application console errors. `qa/v4/live-desktop.png` and `qa/v4/live-mobile.png` visually reviewed; desktop compare/walkthrough proof was replaced with valid viewport captures |

The profile server's separate HTTP checks passed: a 204,800-byte test body retained exact bytes and took about 1.20s of server transfer time with the 1.6Mbps/150ms configuration; binary and JavaScript MIME, HEAD, byte ranges, no-store headers, traversal rejection and 404/416 responses were checked. The browser rendering check is recorded separately above.

Local screenshots and inspected PNG exports are retained under `qa/v4/`:

- History: `desktop-3d-compare.png`, `desktop-photo-compare.png`, `desktop-walkthrough.png`, `mobile-3d.png`, `mobile-3d-compare.png`, `mobile-photo-compare.png`, `mobile-walkthrough.png`.
- Retained desk: desktop/mobile pairs for `evidence`, `plan`, `quantities`, `sketch`, `documents` and `review`.
- Limits, data and original viewer: `desktop-fallback.png`, `mobile-fallback.png`, `desktop-montijo.png`, `mobile-montijo.png`, `mobile-throttled-ready.png`, `mobile-throttled-compare.png`, `legacy-survey.png`.
- Inspected outputs: `export-3d-view.png`, `export-photo-comparison.png`, `export-review.png`.
- Production: `live-desktop.png`, `live-mobile.png`, `live-mobile-photo.png`.

A full-page capture can clear the WebGL canvas while resizing it; actual 3D rendering was checked with viewport screenshots rather than treating a blank full-page canvas as proof. These local artifacts are ignored by git. The production captures above were taken after opening and exercising the live URL. None establishes physical-handset, GPU, survey or billing accuracy.
