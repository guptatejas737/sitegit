# Reconstruct the site history

This is an offline image-to-Gaussian pipeline and a static web viewer. It was run
on the public iVISION photographs to create the three files served by this demo.
It does not upload phone videos, train on Vercel, or provide a production backend.

## Reproduce

Use Python 3.12, Node 22+, and the official [Brush 0.3.0 release](https://github.com/ArthurBrussee/brush/releases/tag/v0.3.0).
The Windows release used here has SHA-256
`b68e3e9cf052d51bf3ee30776fa5a364de7f2ba13b58443128ff797bb7bcfcd6`.
Brush supports Intel/AMD/NVIDIA graphics through WebGPU-compatible backends; this
run used an Intel UHD GPU. CUDA was not used. Allow several GB of disk space and
substantial processing time; training speed depends on the GPU.

```sh
python -m venv .venv
# Activate .venv for your shell, then:
python -m pip install -r pipeline/requirements.txt
npm ci
python scripts/pipeline.py --brush /absolute/path/to/brush_app.exe
npm run build
npx vercel --prod
```

The fetcher needs no Kaggle credential for this public release. If Kaggle changes
access rules, download the files listed in `sources.json` into
`qa/raw/ivision/<week>/` and use `--skip-download`. Do not substitute unrelated
files: the normal download step checks every byte count and SHA-256.

## What each stage does

1. **Source selection:** 60 distributed camera photographs per date, 180 total.
   Exact Kaggle paths and original-image hashes are committed in `sources.json`.
2. **Camera reconstruction:** images resized to 1600px; CPU SIFT, exhaustive
   matching, independent incremental COLMAP reconstruction and bundle adjustment.
   Each date registered all 60 cameras. Geometry is never borrowed from another date.
3. **Preparation:** approximate common GPS frame, then calibrated image
   undistortion. Optional calibrated stereo seeds are computed with SGBM and
   left/right consistency; `config.json` records whether a published model uses it.
4. **Registration:** static SIFT 3D correspondences and robust similarity fitting.
   October aligns to September; November aligns through October. The transforms
   change the coordinate frame only. They do not morph construction between visits.
5. **Gaussian training:** Brush optimizes positions, scales, rotations, opacity
   and SH0 colour against the dated images. 55 images enter optimization; five
   views are held out from optimization. All images enter SfM, so this is not an
   independent reconstruction benchmark. Actual settings are in `config.json`.
6. **Web export:** apply the saved registration, remove outliers with the same
   fixed bounds for every date, encode SPLAT, then compress to SPZ with Spark.
   Each record has its own source/date metadata, trained-model hash and asset hash.

Intermediates and logs remain in ignored `qa/`. Published assets and provenance
are in `public/data/surveys/`. Completed reconstructions and checkpoints are reused
on reruns. To intentionally change training settings, use a new output directory
in `config.json`; do not reuse a previous checkpoint under different settings.

The viewer's `?capture=1` authoring mode adds a **Save survey still** button. Save
each date at the shared reset view as `public/data/surveys/YYYY-MM-DD.webp`.
In the local Vite server the button writes into that folder directly; at a phone
viewport it writes `YYYY-MM-DD-mobile.webp`. Wait for the saved confirmation before
switching dates or viewport. Production builds use a normal browser download.
`?fallback=1` exercises the still sequence without WebGL. The provided stills
are already bundled; re-export them if you replace the models or default camera.
GPU and robust matching can introduce small run-to-run numerical differences;
the committed checksums identify the actual artifacts in this release.

## Adding a new capture

The included importer is specific to DJI photos with calibrated focal length and
GPS XMP. A phone-video importer requires frame extraction, camera calibration and
registration anchors; those are not implemented by this demo. For a new survey,
add a distinct capture entry and exact source hashes, reconstruct and train it
independently, and publish a new dated artifact. The intended two-day capture
cadence is a product workflow; the demo preserves the dataset's actual dates.

These are short-budget aerial reconstructions. Edges, vegetation, low-texture
areas and unobserved vertical surfaces remain imperfect. They are suitable for
demonstrating recorded change, not dimensional verification or buried-service
location certification. Registration residuals are feature-fitting residuals,
not an accuracy guarantee.
