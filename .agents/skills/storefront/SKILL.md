---
name: storefront
description: Design and change the Tak and Rat storefront, product discovery, cart, and checkout. Use for storefront UI, cart behavior, order creation, payments, and customer flow.
---

# Storefront

Work on the Tak and Rat Telegram Mini App and its browser storefront. Keep the existing React, TypeScript, Vite, Zustand, Supabase, and Tailwind architecture unless the task calls for a deliberate change.

## Start with the real flow

1. Trace the requested journey through `src/App.tsx`, `src/components/Store/ProductGrid.tsx`, `src/components/Cart.tsx`, `src/components/Checkout.tsx`, `src/store.ts`, `src/hooks/useCartManagement.ts`, `src/services/adminService.ts`, and the relevant Supabase function.
2. Read `src/types.ts`, `src/constants.ts`, and `README.md` before changing product, order, payment, or customer data.
3. Distinguish the UI state from persisted state. Zustand holds the current cart; `adminService.createOrder` sends order creation to the backend.
4. Keep existing brand language, Russian copy, mobile behavior, and Telegram Mini App support. Do not redesign the shop without a request.

## Cart and checkout rules

- Keep product identity, selected size, and quantity consistent across the catalog, cart, and order payload. Do not merge different sizes into one line.
- Display totals from the current cart, but treat all client values as untrusted. The server must validate product IDs, quantities, prices, inventory, and totals against authoritative data before accepting an order. If the current backend does not do this, report and fix that boundary instead of assuming the browser is trustworthy.
- Preserve the minimum-data principle: collect only information needed to fulfill the order. The documented default is Telegram ID and pickup-point address. Do not add phone, email, or full name without an explicit operational need.
- Payment card and crypto details must come from the server endpoint `/api/payment-details`. Never put payment secrets in browser code, static assets, prompts, or logs.
- Make loading, empty, success, validation-error, and retry states explicit. Prevent duplicate submission while a request is in flight. Do not clear the cart before the server confirms order creation.
- Keep order confirmation honest. Creating an order is not proof that payment cleared, stock was reserved, or a notification was delivered.
- Preserve accessible labels, keyboard operation, focus visibility, and touch targets when editing controls.

## Verification

Run `npm run lint` and `npm run build`. Test the relevant path in the UI when a running environment is available. For checkout, verify both a successful order response and a rejected request; do not create a real paid order without authorization. Check that `/api/payment-details` returns JSON and that a missing configuration state does not expose or fabricate credentials.

## Boundaries

Do not deploy, change production data, send real payment, or publish a commit unless the user asks. Never put secrets in Git. Follow `db-work` for schema changes and `vercel-deploy` for production releases.
