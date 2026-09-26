# Validation — 27 September 2026

Production: https://sitecommit.vercel.app — Vercel deployment
`dpl_6obPSeA8Zgy2KZE6XJ7onuBojjeu`.
Anonymous requests returned HTTP 200 for the page, manifest, all three SPZ models
and all six stills. Downloaded production bytes matched the committed hashes.
The production URL was also checked in the browser at both viewport sizes:
actual Gaussian rendering, all dates, stable camera, comparison and the mobile
still fallback behaved as expected.

- Ran the complete pipeline entry point with the verified source-image cache and
  completed training checkpoints. Download verification, all three camera models,
  undistortion, stereo, cross-date registration, final export and SPZ compression
  completed successfully. Each published model underwent 6,000 Brush steps.
- Asset checks validate three actual SPZ headers/counts, distinct hashes, 60
  registered source cameras per date, training provenance, and six bundled stills.
- Browser checks used the Codex Chromium browser at 1280×800 and 390×844. Confirmed
  real WebGL rendering, different files for each date, unchanged camera coordinates
  when switching dates, direct drag orbit, wheel zoom, reset, keyboard timeline
  control, before/after comparison, divider movement and no horizontal overflow.
- The GPU renderer now stops updating while idle. A settled view recorded one
  frame; new camera/record changes trigger sorting and rendering as required.
- Forced fallback (`?fallback=1`) showed the correct portrait still on the phone
  viewport, kept the date slider functional and disabled the 3D controls.
- A physical handset and native multi-touch pinch were not available. Touch orbit
  and pinch are provided by Three.js OrbitControls; handset testing remains a
  practical pre-meeting check. Viewport testing is not a physical-device claim.
- Visible limitations: soft edges, low-texture areas, vegetation and incompletely
  observed surfaces. The fixed crop shows the common construction area; different
  capture extents must not be interpreted as construction changes.

The only observed rendering warning was a shader signed/unsigned conversion
warning from the Intel driver; no application or rendering errors were observed.
