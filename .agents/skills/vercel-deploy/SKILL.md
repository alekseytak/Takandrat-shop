---
name: vercel-deploy
description: Prepare and verify Tak and Rat Shop releases on Vercel, including build settings, API routes, production smoke checks, and rollback signals.
---

# Vercel deployment

Use for release preparation, Vercel configuration, production deployment checks, and incidents involving the Vercel project. The project is documented as Vite with `npm run build` and output directory `dist`; confirm the live settings before changing them.

## Before release

- Read `README.md`, `vercel.json`, `vite.config.ts`, `package.json`, and the changed API or Supabase function code.
- Run `npm run lint` and `npm run build` locally. Inspect the build output and ensure static files and `api/*.ts` endpoints are included as expected.
- Keep Vercel's filesystem handling ahead of the SPA fallback. Do not route `/api/*` or `/products/*` to `index.html`.
- Keep secrets in Vercel or Supabase secret settings. Never ask the user to paste secrets into chat or commit them. Do not print secret values while checking configuration.
- Do not deploy, promote a deployment, change production environment variables, or run a real checkout without explicit user authorization.

## Production verification

After an authorized deployment, check the exact production URL and deployment status. Verify:

- a known `/products/<file>` path returns the image with an image content type;
- `/api/payment-details` returns JSON, not the SPA shell, and missing secrets are not exposed;
- a normal SPA route returns the application;
- the deployed commit or build matches the intended change;
- checkout and notifications only use a safe test path or an owner-approved real test.

If Vercel reports `EBADPLATFORM` for `@rollup/rollup-darwin-x64`, check whether it is a direct dependency before editing. Do not add platform-specific Rollup packages as dependencies. If a ready deployment serves old code, check whether Vercel marked it rolled back or staged before changing configuration.

## Report

Separate local checks from production checks. Give the deployment URL and observed status only when verified. State any checks that remain undone. Do not claim a release is live because a build passed.
