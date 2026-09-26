# Data decision — 27 September 2026

| Candidate | License / access | Decision |
|---|---|---|
| [iVISION Fall 2024](https://www.kaggle.com/datasets/danielmao2019/ivision-fall2024), [research project](https://danielmao2019.github.io/iVISION-2DCD-dataset.github.io/) | Kaggle publishes the dataset under MIT. Original dated drone photographs are downloadable. | **Selected.** A real construction time series that can be independently reconstructed and hosted. Downloaded and hash-verified 60 photographs from each of 27 Sep, 18 Oct and 27 Nov 2024. |
| [Splat Labs construction progress](https://www.splatlabs.ai/blog/dataset-construction-progress) | Real three-week Gaussian sequence, publicly viewable. [Embedding is documented](https://www.splatlabs.ai/docs/platform/embedding); no independent redistribution grant was established for the scan files. | Rejected for this demo because independently hosted scans are required. No iframe or vendor-hosted model is used. |
| [Koch, König & Kropp: interior construction image sequences](https://data.mendeley.com/datasets/rskgn5f8y8/2) | CC BY 4.0; downloadable demonstration video. | Downloaded and inspected. The supplied video includes presentation overlays and a split BIM display rather than clean source walkthrough frames, making it a poor reconstruction input. |

All selected source links were reached and the image downloads actually completed.
`pipeline/dataset-license-evidence.json` records the public Kaggle license response.
`pipeline/sources.json` lists the exact 180 source files, sizes and SHA-256 hashes.
The selected photographs show site preparation, advancing groundworks and later concrete foundations in a shared construction area. Capture extents differ; one fixed spatial window is applied to all three models to exclude unrelated coverage changes. The labels are observations from the
images, not official project milestone labels.

Other leads checked included ConSLAM, ConPR, Nothing Stands Still and MultiChange3D.
Their academic/noncommercial restrictions or access requirements made them less
suitable than the openly licensed iVISION source for this independently hosted
startup demonstration. The selected source satisfies the first preference: real
dated construction photographs processed into separate trained Gaussian records.

## Reconstruction and viewing

Each date was reconstructed independently with [COLMAP/pycolmap](https://github.com/colmap/colmap),
then trained with [Brush 0.3.0](https://github.com/ArthurBrussee/brush/releases/tag/v0.3.0).
The viewer uses [Spark](https://github.com/sparkjsdev/spark) and Three.js. These are
existing open-source engines; the custom work is their reproducible integration,
dated-data preparation, registration, provenance, web export and timeline viewer.
The trained artifacts are hosted with the app on Vercel.

GPS initialization alone left a vertical offset between dates. Visual registration
used 35 static correspondences for September→October and 74 for October→November,
with median fitting residuals about 0.25 m and 0.22 m. These are not surveying
accuracy claims. Reconstruction artifacts and capture coverage limit comparisons.

The initial one-model vertical-reveal demo was replaced. The current timeline
loads three separate trained assets. It does not animate a building into existence.

## URL choices

Sitegit, Sitefolio and Sitecommit were considered. `sitegit.vercel.app` was already
serving an unrelated site. The Vercel project is `pointwise-labs/sitecommit`.
