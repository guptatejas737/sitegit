# SiteCommit workspace handoff — 3 October 2026

## Run and scope

The existing `sitegit` project was upgraded on branch `codex/progress-workspace`. The initial handoff was local only. The user subsequently authorized GitHub publication and Vercel production deployment. Production endpoint: https://sitecommit.vercel.app; source: https://github.com/guptatejas737/sitegit.

Use Node 22+: `npm ci`, `npm run dev`, then http://127.0.0.1:4173. `npm run build` produces a static `dist/` with workspace and survey entry points. `npm test` runs the domain/export regression suite; `npm run verify` checks all published photo and splat assets. No API keys, account, AI service or GPU training is needed to use the workspace.

## Working loop exercised

1. Open iVISION on 27 November 2024. Compare with another actual date, inspect the source frame, and draw a rectangle or enter its percentage coordinates.
2. Save an observation with work package, location, stage, source/author, review state and optional before image. Reload and retrieve it. Inferences, sample annotations, clutter, potential issues and confirmed-by-reviewer issues are distinct. Confirmation requires a verification basis; it is not an automated defect finding.
3. Edit the illustrative work-plan target or import CSV. A reviewed concrete-stage observation on 27 November versus an entered 20 November target yields seven calendar days after target. Missing or unreviewed evidence stays unknown; this is stage-evidence timing, not certified completion or a claim of contractual delay.
4. Enter a quantity. A concrete line with missing thickness remains unknown. The exercised illustrative inputs 10 × 2 × 0.2 m minus a stated 0.5 m³ exclusion yield 3.5 m³. An illustrative 4 m³ billing entry yields a −0.5 m³ difference. A source-linked example opening 2 × 3 m yields 6 m². These are entered-input calculations, not site measurements.
5. Create an example drawing, add a linked callout and sourced dimension label, save it and export PNG. A reviewer-supplied raster drawing can also be attached. Clutter masks change the visual review scope; their numerical deductions must be separately entered and sourced.
6. Generate a progress report, site diary, M-book draft, QA/QC report, hidden-work pack or progress evidence package. Edit/save text, reload, and regenerate as a new draft. Download HTML/Markdown or an offline evidence ZIP. The ZIP holds exact cited WebPs, provenance, plan/quantity CSVs, observation JSON, annotated sheets and referenced drawings.
7. Retrieve a before-covering note beside a later capture in Remote review. Switch between independently named iVISION and Montijo projects; create an empty independent project; export and restore a workspace backup.

The browser exercise created clearly named test records in local browser storage. They are not seeded as factual source metadata in the code. A fresh browser starts with real photographs, an illustrative plan and one explicit sample annotation per project, with no assumed quantities.

## Data and examples

Primary source: [iVISION Fall 2024](https://www.kaggle.com/datasets/danielmao2019/ivision-fall2024), MIT. It provides 12 actual multi-view capture dates with many source photos per date. Forty-eight photos are bundled. The original three separately trained Gaussian surveys remain available and passed asset verification. The nine extra photo dates do not have invented reconstructions.

Montijo is a separate CC BY 4.0 project from [Zenodo 21055820](https://zenodo.org/records/21055820). The archive directory contains 3,289 photos over 98 filename dates from 3 September 2025 to 16 June 2026; twelve dates are sampled in this app. Its published description has inconsistent dates, so exact image filenames are retained as the date source. Framing changes between periods. Fixed-view time-lapse is suitable for visual progression, not genuine multi-view reconstruction, exact image alignment or hidden dimensions. See [the selection note](DATA-SELECTION.md).

**All six document types that include seeded plan rows disclose the illustrative baseline.** Seed notes and example sketches are also marked “Illustrative example, created for this demo”, including exported files. Any entered test quantities, billing values and costs retain their explicit illustrative source. No actual owner schedule, BOQ, contractual quantity, payment, weather, labor count or approved QA record is supplied by these samples.

## Files changed

| Files | Responsibility |
| --- | --- |
| `index.html`, `src/main.js`, `src/style.css` | Responsive workspace, persistent state, working actions, region drawing, local file exchange, error handling |
| `src/domain.js` | Date math, plan/observation validation, quantity units and gaps, CSV, saved snapshots, document generation |
| `src/views.js`, `src/forms.js` | Evidence, work plan, quantities, markup, documents, remote review, projects and source screens |
| `src/exports.js` | Safe HTML/Markdown filenames, PNG evidence sheets, source-bundled ZIP, quantity CSV |
| `survey.html`, `src/survey.js`, `src/survey.css` | Preserved original interactive Gaussian viewer, comparison and still fallback |
| `public/data/evidence/*` | 60 attributed image derivatives, two project catalogs and attribution |
| `pipeline/ivision-*.json`, `pipeline/montijo-*.json` | Original indexes, license verification and sample provenance |
| `scripts/prepare-workspace-evidence.py`, `scripts/sample-montijo.py`, `scripts/verify-evidence.mjs` | Reproducible sample selection and integrity checking |
| `tests/domain.test.mjs`, `package.json`, `package-lock.json`, `vite.config.js` | Regression suite, pinned ZIP library, dual-entry build and local QA-only export capture |
| `README.md`, `docs/DATA-SELECTION.md`, `docs/PRODUCT-NOTE.md`, `docs/WORKSPACE-QA.md`, this file | Run instructions, source decision, product context and observed validation |

## Limits that matter

- Local browser storage only. No shared authentication, server audit trail, cloud synchronization, secure reviewer identity or formal approval workflow. Backup JSON moves records; clearing browser storage removes unsaved-to-backup work. Large attachments can exhaust the browser quota; the UI reports save failure and offers export.
- Six document types are deterministic templates populated from real evidence and entered records. They are not AI-written findings. Manual edits do not silently rewrite source records; regeneration creates a separate snapshot.
- Photo comparison is side by side, with alignment limits disclosed. No automated change detection, stage classifier, pixel-to-metre calibration, geometric completion calculation, defect verification or new reconstruction was added.
- M-book records remain structured drafts. Measurement/billing use requires independent dimensional checks and human review. The requested 98–99% confidence level is a validation goal only. Hidden faces, thickness, calibration, coverage, capture intervals, occlusion and snow can leave conclusions unknown.
- Sketches support rectangular regions and sourced text dimensions on raster images; they are not CAD, polygon takeoff or a drawing revision system. PDF is available via printing downloaded HTML in a browser; direct exports are PNG, HTML, Markdown, CSV, JSON and ZIP.
- Public-source projects have an editable illustrative baseline. A newly created project intentionally has no borrowed images; adding a new evidence dataset requires a catalog/source adapter, not an upload simulation.
- Browser viewport QA is not a physical handset or native pinch certification. Production-scale performance, accessibility across assistive technologies and field measurement accuracy still need independent validation.
