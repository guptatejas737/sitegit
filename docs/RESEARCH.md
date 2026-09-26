# Dataset decision — 26 September 2026

## Selected: path 2, one public construction splat

[construction building, by kavehkarimadini](https://superspl.at/scene/8a8a7cab) explicitly displays **CC BY 4.0** on the public scene page and in its HTML license link. The working public SuperSplat viewer loads [this SOG manifest](https://d28zzqy0iyovbz.cloudfront.net/8a8a7cab/v1/meta.json) and five WebP data textures. These public rendering assets were successfully downloaded without authentication. The site's separate original-file download button asks for login; that endpoint was not used. The local copy uses only the publicly delivered rendering representation covered by the displayed CC BY license.

261,427 splats; 3,180,000 bytes for the manifest and five data textures. No training, CUDA environment, or external service is required to display it. No downsampling is needed at this count. Pinned PlayCanvas renders true oriented Gaussian splats, not a point-cloud substitute. Source geometry is preserved; the timeline shows deliberately artificial height masks over this one scene. A fixed camera makes changes obvious and instantaneous. The source is a public user upload; acquisition details and chronology are unspecified.

Three name candidates: **Sitegit**, **Buildlog**, **Siteback**. Sitegit was available in the user's GitHub namespace and directly communicates construction version history.

## Ranked research candidates

| Source | What exists | License / access | Why not selected |
| --- | --- | --- | --- |
| [ConSLAM](https://github.com/mac137/ConSLAM) / [Cambridge record](https://www.repository.cam.ac.uk/handle/1810/345700) | Periodic real construction visits, RGB/NIR, LiDAR, IMU, survey reference data | Repo says academic use only; this is not a blanket commercial data redistribution grant | Download and registration/SfM/training needed; academic-only terms are a poor fit for a publicly deployed startup demo |
| [ConPR](https://github.com/dongjae0107/ConPR) | Repeated active construction captures; camera images, LiDAR, IMU, ground truth | Dataset CC BY-NC-SA 4.0; code MIT | Raw sensor data, not browser-ready 3DGS; noncommercial data restriction |
| [Selected SuperSplat building](https://superspl.at/scene/8a8a7cab) | Small, already-trained public Gaussian splat of one construction building | CC BY 4.0; public renderer and manifest verified | Selected, with explicit simulated chronology |

## Additional leads checked

- [HILTI 2022](https://huggingface.co/datasets/Hilti-Research/hilti-slam-challenge-2022): approximately 350 GB of multimodal data, CC BY-NC-SA 3.0. A valuable robotics benchmark, not a ready-made construction progress splat sequence. Local `nvidia-smi` could not verify an accessible GPU, so GPU training was not assumed.
- [Splat Labs: three weeks of construction](https://www.splatlabs.ai/blog/dataset-construction-progress): the best conceptual match, with an actual public three-week splat viewer. The public article and datasets page inspected did not expose a standalone permissively licensed download. No right to rehost was assumed merely from the “Open Dataset” label. Its hosted viewer can be explored as a separate reference, but it is not our implementation or asset source.
- [LichtFeld showcase](https://lichtfeld.io/showcase/): construction-adjacent Nessundet Bridge renovation capture; a source credit was visible, but an explicit reuse grant for that bridge asset was not verified.
- Nerfstudio/Polycam workflows were checked against [official Nerfstudio documentation](https://docs.nerf.studio/quickstart/custom_dataset.html). These are processing paths rather than a verified, licensed construction time series ready for this meeting. Public visibility alone was not treated as an open license.

## Honest scope

Path 1 was ruled out for this implementation because no checked candidate combined ready-to-render repeated construction splats, verified public reuse rights, and low processing risk within the meeting deadline. This does **not** mean such a dataset cannot exist. Path 2 is viable, so no mesh/point-cloud fallback was used for the interactive 3D scene.

This demo proves the interaction and presentation: orbit a Gaussian splat, keep registration fixed, rewind through illustrative layers. It does not implement video upload, reconstruction, scan alignment, automated change detection, measurements, BIM comparison, or inspection evidence. The full three-stage workflow is a product vision, not a working capture pipeline.

## Replacing the demo data later

Keep one coordinate frame across dated captures. Replace the single asset and masks with a manifest of aligned per-date SOG assets; load the current scene first, prefetch the next, and release old GPU resources. Replace the week labels with actual capture dates only after verifying metadata. Capture new phase stills for the WebGL fallback. Preserve license attribution for every added capture.
