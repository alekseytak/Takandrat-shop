---
name: catalog-ops
description: Maintain accurate Tak and Rat product records, catalog photography references, availability, and truthful product copy across local data and Supabase.
---

# Catalog operations

Use when editing product information, merchandising, categories, availability, or product copy. The shop currently has fallback products in `src/constants.ts` and reads live products through `src/hooks/useProductFetch.ts`; check which source controls the requested environment.

## Preserve product truth

- Verify the product in the authoritative source before editing. Do not assume the fallback catalog and Supabase catalog are identical.
- Keep product ID, display name, price, currency, category, description, image paths, and availability consistent across all consumers.
- Do not invent prices, inventory, sizes, materials, dimensions, production timelines, shipping promises, or certifications. Ask for missing facts.
- Use stable product identifiers, not array positions or display names, for updates and image references.
- Keep image order intentional. Ensure local `/products/...` paths exist and live storage paths resolve before publishing references.
- Do not silently remove a product or mark it unavailable in only one source. Identify the expected source of truth and update every required source.
- Keep copy in the brand's direct Russian voice. Do not claim that a handmade item is mass-produced or imply accessories are included unless the catalog confirms it.

## Verify

Compare the changed record with the product UI and cart behavior. Check image links, category filters, size selection, price formatting, and availability messaging. Run `npm run lint` and `npm run build` after source changes. For live database changes, follow `db-work`; for photo creation, follow `product-image`.
