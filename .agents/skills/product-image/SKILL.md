---
name: product-image
description: Prepare consistent, truthful product photography for the Tak and Rat catalog, including crop, background, export, and optional image-model workflows.
---

# Product image pipeline

Use this skill for product photos and catalog image assets. The product is handmade leather goods and apparel; photos must represent the actual item, not an imagined variant.

## Inspect before processing

- Read product definitions in `src/constants.ts` and inspect references under `public/products/` or the configured catalog source before replacing images.
- Confirm which item, color, material, finish, and view each source image represents. Ask for missing product facts rather than inventing them.
- Keep source originals unchanged. Create output files separately, preserve a reversible mapping from source to output, and update catalog paths only after reviewing the result.

## Visual rules

- Keep the same product, construction, stitching, hardware, texture, proportions, and color. Do not let an image model add, remove, or alter product details.
- Choose crop and aspect ratio for the actual display components. The catalog card currently uses a 4:5 image area and `object-cover`; inspect `src/components/Store/ProductGrid.tsx` before imposing a new crop.
- Apply a consistent framing, exposure, background, and color treatment across a product set. Preserve detail in leather grain and fabric texture; avoid clipping highlights or crushing dark materials.
- Remove or replace a background only when the source supports a clean separation. Do not create misleading context, labels, logos, certifications, or claims.
- Keep useful views: a primary product view, details, and scale or in-use views where supplied. Do not duplicate near-identical frames to inflate a gallery.
- Export web-ready images at sufficient resolution for the UI. Preserve a high-quality source master and use descriptive, stable filenames.

## Model use

The requested image models are `gpt-image-2.5` and `gemini-3-pro-image`. Treat model names, availability, API routes, and pricing as unverified until checked against current provider documentation and the available credentials. Do not claim either provider is configured in this repository; `GEMINI_API_KEY` in `.env.example` is not proof that image generation is wired up.

When generating or editing with a model, use the supplied product photo as the source of truth. Make a small, controlled edit request, compare the output against the original, and reject changes to product identity or construction. Never upload private customer data or secrets.

## Verify delivery

- Open every final asset and check the full-resolution file, not just a thumbnail.
- Check dimensions, file type, file size, color, crop, sharpness, and transparent-edge artifacts where relevant.
- Confirm every catalog path resolves and renders with the expected crop on a narrow screen and a desktop layout.
- Run `npm run lint` and `npm run build` after changing code or product references. Report generated files and any model steps that could not be reproduced.
