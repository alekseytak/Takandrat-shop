---
name: design-system
description: Keep the Tak and Rat shop's visual language, responsive catalog, typography, spacing, color, and interaction patterns coherent.
---

# Design system

The current storefront uses React components with Tailwind utility classes, brand color classes, and a compact, high-contrast editorial style. There is no confirmed standalone token package or CSS entry point in the current source inventory. Inspect the live files before choosing where a system belongs.

## Preserve and extend the system

- Read `src/components/Store/ProductGrid.tsx`, `src/components/Header.tsx`, `src/components/Cart.tsx`, `src/components/Checkout.tsx`, `src/App.tsx`, and the current Tailwind configuration before changing shared styles.
- Search for existing brand classes and CSS variables before adding tokens. Do not assume a missing path such as `src/index.css` or a conventional token file exists.
- Keep the established brutalist, functional visual language: strong borders, direct uppercase labels, restrained color, clear prices, and product-first imagery. Improve consistency without redesigning the brand unless asked.
- Define a token once when multiple components need the same color, type scale, spacing, border, or breakpoint. Prefer the repository's current Tailwind configuration or actual style entry point over scattered arbitrary values.
- Keep type hierarchy clear and legible in Russian. Do not reduce body copy, form labels, or prices to decorative microtext.
- Use a consistent catalog image ratio and layout. Check the 4:5 card media area in `ProductGrid.tsx` before altering crops or grid geometry.
- Support small Telegram Mini App viewports, normal browsers, keyboard navigation, focus visibility, and touch-sized controls.
- Check both light and dark theme behavior where the application exposes theme switching. Avoid hard-coded colors that break one theme.

## Change process

For a shared visual change, identify affected components and define the intended token or component rule before editing. Avoid sweeping unrelated restyling. Keep interaction states visible: default, hover, focus, selected, disabled, loading, and error as applicable.

## Verify

Run `npm run lint` and `npm run build`. Inspect the changed page at a narrow phone width and a desktop width. Check text wrapping, grid alignment, image crop, contrast, focus indication, and both themes where applicable. Report any viewport or theme you could not inspect.
