---
name: product-video
description: Plan and produce short, truthful product videos for the Tak and Rat shop, including an optional Grok Imagine Video workflow.
---

# Product video

Use for short product clips, motion concepts, and video assets for the Tak and Rat catalog. Keep the handmade item accurate and the result suitable for mobile storefront use.

## Define the deliverable

Before generating a clip, identify the product, approved source photos, target placement, aspect ratio, duration, and whether the clip is a product detail, demonstration, or atmosphere piece. Use real product facts from the catalog or owner; do not invent features, dimensions, durability, or material claims.

## Preserve product truth

- Use `grok-imagine-video-1.5` only after checking current model availability, API access, pricing, content limits, and output specs. This repository does not currently document a video-generation integration.
- Use a real product image as visual reference where the service supports it. Reject output that changes the shape, color, stitching, hardware, texture, or count of items.
- Keep camera movement restrained and product-led. Avoid adding hands, props, packaging, or scenes that imply an unverified use or included accessory.
- Do not synthesize text, logos, labels, or product details into the video. Add approved brand graphics in a deterministic editing step.
- Keep the unedited source and prompt or edit recipe. Save final exports in an agreed asset location, not over the source photo.

## Web delivery

- Prefer a short, silent, loopable clip with a useful poster frame. Confirm the target component supports video before adding video files to the catalog.
- Optimize dimensions, codec, bitrate, and file size for the actual browser support and deployment budget. Provide a still-image fallback and meaningful accessible text.
- Respect reduced-motion preferences and avoid autoplay with sound. Do not slow the catalog or checkout with large eager downloads.

## Verify

Play the exported file in a browser-sized viewport. Check the first and last frames, loop seam, visual fidelity, playback, poster, mobile loading, and fallback. Run `npm run lint` and `npm run build` when code or catalog references change. State clearly when the model call, edit, or export was not run.
