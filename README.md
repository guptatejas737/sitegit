# SiteCommit — progress intelligence and evidence workspace

Run with Node 22+: `npm ci`, then `npm run dev`; open **http://127.0.0.1:4173**. Checks: `npm test`, `npm run verify`, `npm run build`. The static production output is `dist/`. Production endpoint: [sitecommit.vercel.app](https://sitecommit.vercel.app). Source: [GitHub](https://github.com/guptatejas737/sitegit).

Open a real dated photo → mark an observation → link its work package, location and stage → review the transparent plan baseline → enter a quantity or drawing note → generate, edit and download a report or evidence ZIP. Saved records remain in this browser. Use **Projects → Export workspace backup / Restore** to move them; there is no cloud sync or shared approval service.

Data: 48 attributed iVISION photos across 12 actual dates (MIT), plus 12 independently named Montijo time-lapse dates (CC BY 4.0). [Selection, verified files and limits](docs/DATA-SELECTION.md). The existing three genuine iVISION Gaussian reconstructions remain at `survey.html`, with dated still fallback. All other dates are photos, not invented splats.

Plans and example sketches are labeled **Illustrative example, created for this demo**. Reports are editable drafts. Image regions do not establish metres, hidden thickness, contractual completion or billing accuracy. App code is MIT; image rights and transformations are in [evidence attribution](public/data/evidence/ATTRIBUTION.md) and [survey attribution](public/data/ATTRIBUTION.md).

- [Workspace handoff and file map](docs/WORKSPACE-HANDOFF.md)
- [Exercised workflows, tests and screenshots](docs/WORKSPACE-QA.md)
- [Internal product note and customer questions](docs/PRODUCT-NOTE.md)
- [Existing offline reconstruction pipeline](pipeline/README.md)

To reproduce the public photo sample (optional), install the Python dependencies in `pipeline/requirements.txt`, then run `python scripts/prepare-workspace-evidence.py` and `python scripts/sample-montijo.py`. The checked-in photos are ready to use; reconstruction and downloading are not required to run the workspace. To publish an authorized release to the linked Vercel project, run `vercel --prod` after the checks pass.
