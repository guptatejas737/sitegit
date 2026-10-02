# Workspace data selection — 3 October 2026

The product uses an expanded iVISION photo history as its primary project and a separate Montijo time-lapse project. The previous app had only three reconstructed dates. This selection adds twelve actual dates per project without fabricating further 3D epochs or combining sites.

| Candidate / primary source | Rights and verified coverage | Decision |
| --- | --- | --- |
| [iVISION Fall 2024](https://www.kaggle.com/datasets/danielmao2019/ivision-fall2024), [research project](https://danielmao2019.github.io/iVISION-2DCD-dataset.github.io/) | Public Kaggle metadata identifies MIT. Original file index has 12 dated JPEG capture groups, 93–367 photos per date. The existing three reconstructions each registered 60 cameras. Downloaded and inspected 48 actual photos: four per date. | Primary project: substantially more history than the previous three-date selection, genuine overlapping aerial surveys, reusable source rights and already verified reconstruction provenance. Only the original three dates have splats. |
| [Montijo, Zenodo 21055820](https://zenodo.org/records/21055820) | CC BY 4.0; actual 21,110,658,246-byte ZIP directory contains 3,289 JPEGs across 98 filename dates. Retrieved representative members with HTTP 206 ranges and decoded twelve samples. | Separate photo timeline: valuable structural/envelope/external-work history, but it is not a valid multi-view reconstruction dataset. |
| [No Wolf in the Meadow, TU Wien / ChronoFuseGS](https://researchdata.tuwien.at/records/bphp1-hbb20) | CC BY 4.0; publisher describes 8 recording days, 11 timesteps including same-day detail captures, 155–284 photos per timestep, and pretrained Gaussian models. Primary record, license and archive names were checked; full training archives were not downloaded. | Strong future temporal-3D candidate, but fewer distinct days and a flood-control landscape with seasonal/flooding changes. The expanded iVISION selection better serves the current building-work review loop. |

[Hilti–Trimble–Oxford 2026](https://huggingface.co/datasets/Hilti-Research/hilti-trimble-slam-challenge-2026) was also checked: construction-site sequences are useful, but the published CC BY-NC-SA 3.0 terms were a poorer fit for startup reuse. No access request was sent. This is a bounded selection, not a claim to have exhausted all construction datasets online.

## Actual dates and limitations

iVISION sample: 2024-09-27, 10-02, 10-09, 10-18, 10-30, 11-06, 11-13, 11-16, 11-22, 11-27, 12-03, 12-07. Raw JPEG counts per group: 114, 93, 157, 120, 317, 339, 340, 367, 340, 341, 339, 355. The four sample views are independently framed; neither pixel alignment nor full coverage is claimed. Early frames include substantial surrounding ground; December snow obscures some work. No owner plan, BOQ, drawings, billing records or validated dimensions were supplied.

Montijo archive filename dates span **2025-09-03 to 2026-06-16**. The record description contains an inconsistent date range (April 2025 to March 2025); folder names are not always capture dates. We use image filenames, retain exact archive paths, and expose that discrepancy in provenance. Twelve representative dates are bundled: 2025-09-03, 11-20, 12-01, 12-10; 2026-01-15, 03-20, 04-20, 04-30, 05-11, 05-20, 05-30, 06-16. These are a sample of the 98 dates, not 98 dates loaded into the app. The fixed-position time-lapse framing/orientation changes between recording periods. Sequential frames are not simultaneous overlapping viewpoints. Side-by-side comparison is therefore offered without exact registration, 3D reconstruction or pixel-derived quantities.

## Reproduction and attribution

- `public/data/evidence/catalog.json` and `montijo.json`: exact original file, filename date, original SHA-256, derivative SHA-256, dimensions, source, license and alignment limits for every displayed photo.
- `pipeline/ivision-license-2026-10-03.json`, `ivision-photo-index.json`, `montijo-source-record.json`, `montijo-provenance.json`: retained primary metadata and the reproducible selection inputs.
- `scripts/prepare-workspace-evidence.py` downloads the public iVISION sample; `scripts/sample-montijo.py` reads selected ZIP members with byte ranges. Both require Python/Pillow; iVISION additionally uses the existing `kagglesdk` dependency. Bundled assets are sufficient to run the app; downloading the datasets again is unnecessary.
- Derived images are resized WebP copies, not generated imagery. `npm run verify` checks their hashes, dimensions and filename dates. Source credit appears in the UI and exported evidence register. See `public/data/evidence/ATTRIBUTION.md`.

The existing `pipeline/README.md` documents the genuine three-date COLMAP → Brush → SPZ reconstruction. No additional training is claimed by this workspace upgrade.
