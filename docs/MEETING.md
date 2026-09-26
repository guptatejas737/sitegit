# Two-minute walkthrough

Live demo: https://sitecommit.vercel.app

1. Open the Vercel demo and allow the first survey to load. Start with November's
   concrete foundations. Drag gently to show that the scene is navigable in 3D.
2. Scrub back to September. The same camera now shows the earlier site preparation.
   Move to October to show the intervening groundworks.
3. Enable **Compare previous** and move the divider across the site. The two sides
   are independent dated reconstructions in a shared frame.

Suggested wording: “We built this reconstruction pipeline and version-history
viewer using public iVISION drone photographs. Each date was reconstructed and
trained separately. The product vision is to repeat this with a phone walkthrough
every two days, preserving each state as construction advances.”

Be clear that the source is drone photography, the example dates are weeks apart,
and training currently runs offline. This is not yet an automated phone-capture
service. Geometry at edges and unobserved surfaces is imperfect; do not use this
prototype to measure construction or locate buried services.

Keep the page open before the meeting so the three small assets can cache. If
WebGL is unavailable, the date controls switch real rendered survey stills. The
explicit `?fallback=1` URL is useful for rehearsing that path. `?record=0` opens
September first. A network connection is needed for a fresh first visit.
