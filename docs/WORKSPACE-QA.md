# Workspace validation — 3 October 2026

This records the local v3 workspace tests. `QA.md` describes the earlier deployed three-date viewer and is historical, not a deployment claim for this upgrade.

## Automated checks

- `npm test`: 15 tests passed. Calendar dates/day arithmetic; missing/inferred/unreviewed/clutter status; cross-site and unsupported QA confirmation rejection; entered-scope percentages; m³/m²/m/count formulas; missing thickness/drawing/source; exclusion bounds; whole counts; cost inputs; quoted/multiline CSV and formula escaping; save/reload and storage quota failure; all six document templates; source citations outside report periods; preserved edits; immutable drawing snapshots; cross-project document restore rejection; exact ZIP source bytes, escaping and portable QA/QC filenames.
- `npm run verify`: all three independent SPZ records, per-record hashes, registered camera counts and six stills passed; all 60 photo derivatives and 24 distinct project/date pairs passed source filename/hash checks.
- `npm run build`: both workspace and survey entries built. Workspace JS approximately 75 KB (27 KB gzip). The existing Spark viewer chunk exceeds Vite's warning threshold; it is loaded on the separate survey page, not the photo workspace.

## Actual browser exercise

Used Chromium through the in-app browser with viewport overrides of **1440 × 1000** and **390 × 844**, plus its default laptop viewport. Captured PNG sizes exclude browser scrollbars/chrome. No physical handset was available.

| Flow | Observed result |
| --- | --- |
| Real dated evidence | iVISION source photo visible immediately; keyboard timeline date changes; multiple actual views; Montijo separately opens and changes dates |
| Observation | Concrete note, exact source, before image, work package, location, review state and hidden-work flag saved; retained after reload; explicit illustrative 1/4 review-zone scope displayed 25.0% with its entered-scope method |
| Region markup / clutter | Pointer drag opened the form with a normalized region; saved clutter mask appeared on the source image; linked it to a separately sourced numerical exclusion |
| Plan math | Edited foundation target to 2024-11-20; reviewed 2024-11-27 evidence produced 7 days after target; missing stages remained unknown |
| CSV / costs | Downloaded CSV, edited and reimported three rows; entered cost sum 350 INR and +50 against a 300 budget displayed, with illustrative source |
| Quantity | Missing thickness yielded unknown; explicit 10 × 2 × 0.2 − 0.5 yielded 3.5 m³; comparison to illustrative bill 4 yielded −0.5; drawing-linked opening 2 × 3 yielded 6 m², still requiring site verification |
| Drawing | Created example sketch, added source-linked area/dimension callout, exported and visually inspected PNG; attached a raster drawing through the file chooser |
| Documents | Generated all six types; edited M-book text, saved/reloaded it; regenerated a report with changed date range as a separate draft; downloaded real HTML outputs for every type and Markdown for M-book/QA |
| ZIP / source drilldown | Inspected exported ZIP entries and document snapshot: 2 quantity lines, 1 referenced drawing, 3 cited source images, plan/quantity CSVs, annotations and provenance; rendered extracted review.html; clicked its citation anchor and verified a loaded 1600px source image |
| Hidden work | Retrieved November before-covering observation beside December capture; alignment warning remained visible |
| Portfolio / restore | Created an independent empty project; restored downloaded backup; switched to Montijo without mixing its records or quantities with iVISION |
| Mobile | Saved a labeled sample note on Montijo at phone width and verified it after reload; opened project backup controls; generated/exported a source-linked M-book package; inspected quantity layout |
| 3D regression | Real Gaussian rendering observed; September/October/November selected; Compare previous enabled and toggled; forced no-WebGL phone mode displayed dated still and disabled 3D controls; production-bundle fallback changed to September via keyboard |

Browser exercise found and fixed a native form ID/name collision and slash-containing QA/QC download filenames. Final local workspace inspection reported no application console errors. A Vite configuration reload briefly invalidated test tabs; a fresh local tab recovered and retained saved records. This was not a production outage.

The built static workspace was also opened on local preview port 4183 and its initial 1600px source image loaded. The production fallback route was exercised separately. Runtime dependency audit reported no known vulnerabilities.

## Saved visual proof and outputs

Ignored local QA artifacts are retained in `qa/`, not published as owner data:

- `workspace-desktop-evidence.png`: real image with saved observation and clutter regions.
- `workspace-desktop-compare.png`: before-covering retrieval beside later evidence.
- `workspace-desktop-sketch.png`: labeled example drawing and callout.
- `workspace-mobile-montijo.png`, `workspace-mobile-quantity.png`: phone-width source and quantity screens.
- `workspace-exported-report.png`: rendered downloaded report.
- `workspace-survey-regression.png`, `workspace-mobile-fallback.png`: preserved survey/fallback views.
- `browser-exports/`: all six HTML outputs, Markdown, quantity/plan CSVs, PNG sketch, JSON backup and source-bundled ZIP.
- `review-package/`: extracted offline package used for inspection.

These validate the implemented local loop, not dimensional accuracy, automated stage detection, contractual quantities, formal approvals, live feeds or customer outcomes. Source images and illustrative inputs remain distinguishable in saved outputs.
