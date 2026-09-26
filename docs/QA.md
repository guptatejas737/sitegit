# Verification — 27 September 2026 (India time)

- Production build succeeds with pinned dependencies; npm audit reported zero vulnerabilities at install.
- Real WebGL 2 Gaussian splat rendering verified in the Codex Chromium browser, both development and production builds. No production console errors observed.
- Responsive layouts visually inspected at 1280×720, 390×844 and 320×740. No horizontal overflow. The phone-size canvas matches its container.
- Resizing from a phone viewport to desktop keeps the phase annotation attached to the building; its screen position updates after PlayCanvas refreshes the projection.
- Pointer drag changes orbit. Timeline buttons, native slider, Home/End and arrow-key stage navigation work. Camera position stays fixed through phase changes and playback. Playback completes at phase 3 and returns to the Play state.
- Three different 898×898 WebP fallback images were exported from the actual GPU-rendered scene, with different hashes. Combined size is 75,426 bytes. The forced fallback page selects the corresponding image and displays a still-sequence note.
- Source manifest and five compressed data textures total 3,180,000 bytes. Renderer bundle is about 622 KB gzip; app JavaScript and CSS are under 8 KB gzip combined. Assets are served locally from the deployed repository, not hotlinked.
- GitHub Pages build and deployment succeeded. The public root returned HTTP 200 with the correct title.

## Limits of testing

Phone **viewport** testing was performed in Chromium. No physical iPhone or Android device, Safari engine, or real multitouch device was available. Pinch zoom is implemented with two tracked Pointer Events; a real-device pinch test is still advisable before the meeting. Do not describe this as certified across every phone. Browser/driver-specific failures fall back to stills after WebGL unavailability, context loss, or a 25-second load timeout.

Vite reports expected browser externalization warnings for PlayCanvas's Node worker alternatives; browser worker paths were verified by successful production rendering. The dynamic renderer chunk triggers a size warning but is loaded separately, after the application frame, and it does not block the still fallback.
