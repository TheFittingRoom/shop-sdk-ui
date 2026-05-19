# shop-sdk-ui

The Fitting Room's browser SDK. A React/TypeScript ESM library that brands embed
on product pages to render virtual try-on, size recommendations, and avatar
creation flows. Authenticates against Firebase and talks to `tfr-backend`.

Distributed via npm and served to consumers through jsdelivr. The SDK registers
a `<tfr-widget>` custom element and exposes an `init()` entrypoint.

## Install

```sh
npm ci
```

## Scripts

| Script | What it does |
|---|---|
| `npm run build` | Clean + production build into `dist/` |
| `npm run check` | Type-check (`tsc --noEmit`) + ESLint + Prettier |
| `npm run watch` | Vite build in watch mode |
| `npm run serve` | Static-serve the repo on `:5173` with CORS |
| `npm run watch-serve` | Both `watch` and `serve` together; Ctrl+C stops both |
| `npm run test` / `npm run test:e2e` | Playwright e2e suite (Chromium) against the built bundle |
| `npm run test:e2e:ui` | Playwright UI runner for local debugging |
| `npm run gen-types` | Regenerate `src/api/gen/*.ts` from `tfr-backend` Go types |
| `npm run promote-latest [version]` | Move npm dist-tag `latest` onto a published version (defaults to current `package.json` version) |

## Running e2e tests

First-time setup: `npm install && npx playwright install chromium` (the
second command downloads the Chromium binary once; cached afterwards). Then
`npm run test:e2e` runs the suite. Specs live under `tests/e2e/`; they boot
the built bundle in headless Chromium against a static fixture page
(`tests/e2e/fixtures/host.html`) that mimics the minimal contract the Shopify
theme provides. Firebase is mocked via `InitParams.testHooks`
(see `src/lib/firebase-mock.ts`); REST endpoints are mocked via
`page.route()`. See AGENTS.md for the architecture and constraints.

For an interactive debug loop, `npm run watch-serve &` in one terminal and
`npm run test:e2e:ui` in another — Playwright reuses the live-rebuilt
`:5173`.

## Release process

Releases are explicit, human-initiated steps via a single GitHub Actions
workflow. No magic on PR merges.

**1. Cut a `next` release.**

- Go to https://github.com/TheFittingRoom/shop-sdk-ui/actions/workflows/release.yaml
- Click **Run workflow**
- Pick the bump type (`patch` / `minor` / `major`)
- Click **Run workflow**

The `release.yaml` workflow does everything in one run:

1. Checks out `main`, installs deps, builds (verifies it compiles)
2. Runs `npm version <bump>` — bumps `package.json` and creates the
   `vX.Y.Z` tag
3. Rebuilds with the new version embedded
4. Pushes the bump commit + tag back to `main`
5. Publishes to npm under dist-tag `next` via
   [npm trusted publishing](https://docs.npmjs.com/trusted-publishers)
   (OIDC, no long-lived secret) with `--provenance` for supply-chain
   attestation

The npm trusted-publisher entry for `@thefittingroom/shop-ui` must
point at `release.yaml`.

> **Branch protection note:** the workflow pushes commits + tags
> directly to `main`. If you enable required-PR branch protection on
> `main` later, this push will fail until either (a) the workflow uses
> a credential listed in the branch-protection bypass list, or (b)
> branch protection allows the workflow to bypass via some other means.
> The current setup deliberately defers that complication.

**2. Promote `next` → `latest` when ready for end users.**

`release.yaml` only publishes under dist-tag `next`. To make a version
the default that consumers get from `npm install @thefittingroom/shop-ui`,
you have to explicitly promote it:

```sh
git pull origin main      # ensure package.json reflects the latest release
npm run promote-latest    # moves dist-tag latest onto current package.json version
```

That runs `npm dist-tag add @thefittingroom/shop-ui@<ver> latest` — no
new artifact is published; we just re-point `latest` at the already-
published `next` build. The runner needs to be logged in to npm with
publish rights to `@thefittingroom/shop-ui` (`npm whoami` to check;
`npm login` if not).

To promote a specific older version: `npm run promote-latest -- 5.0.13`.

**3. Verify** with `npm dist-tag ls @thefittingroom/shop-ui`.

## Local development

Run the SDK against the local backend stack from
[`local-deployment`](https://github.com/TheFittingRoom/local-deployment).

1. Bring up the local stack (Postgres, Redis, MinIO, `tfr-backend`):

   ```sh
   cd /path/to/local-deployment && docker compose up -d
   ```

2. In this repo, start the watcher and dev server:

   ```sh
   npm run watch-serve
   ```

   This rebuilds `dist/index.js` on every file change and serves the repo at
   `http://localhost:5173/dist/index.js` with CORS enabled.

3. Open the test storefront:

   <https://tfrshop-1346.myshopify.com/products/blackbandana-fitted-dress?tfr-source=local>

   The `?tfr-source=local` query param tells the storefront's `tfr.js` to load
   the SDK from `http://localhost:5173/dist/index.js` instead of jsdelivr, and
   to initialize it with `environment: 'local'` (see `src/lib/config.ts` —
   that env points at `http://localhost:8080` for the API and the local
   s3proxy bucket for assets at `http://localhost:9000`).

Reload the storefront page after a rebuild to pick up changes.

### Working with the storefront

The test storefront lives in the
[`shopify`](https://github.com/TheFittingRoom/shopify) theme repo. Its
`development` branch syncs to `tfrshop-1346.myshopify.com` automatically —
push to `origin/development` and the live demo store updates without any
`shopify theme push`.

The integration glue lives in three places in that repo:

- `assets/tfr.js` — bootstraps the SDK. Builds `currentProduct` from
  `window.currentProduct` (set inline by `main-product.liquid`), wires the
  `productLookup` and `getOverlayTopOffset` callbacks, and selects the SDK
  source URL based on `?tfr-source=local`.
- `layout/theme.liquid` — loads `tfr.js` site-wide.
- `<tfr-widget>` embeds across `sections/main-product.liquid`,
  `sections/header.liquid`, and `snippets/card-product.liquid`.

When iterating with `?tfr-source=local`, the SDK comes from your watcher
and the theme from the live demo store — you only need to push to
`shopify` when changing markup, the bootstrap script, or merchant
callbacks (`getSelectedOptions`, `addToCart`, `productLookup`,
`getOverlayTopOffset`). For SDK-only changes, just rebuild and reload.

If you're using `local-deployment`, both repos are cloned side-by-side
under `local-repo/` for you. See `local-repo/shopify/AGENTS.md` for the
theme conventions.
