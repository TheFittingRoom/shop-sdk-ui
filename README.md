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
| `npm run check` | Type-check (`tsc --noEmit`) |
| `npm run watch` | Vite build in watch mode |
| `npm run serve` | Static-serve the repo on `:5173` with CORS |
| `npm run watch-serve` | Both `watch` and `serve` together; Ctrl+C stops both |
| `npm run gen-types` | Regenerate `src/api/gen/*.ts` from `tfr-backend` Go types |
| `npm run promote-latest [version]` | Move npm dist-tag `latest` onto a published version (defaults to current `package.json` version) |
| `npm run manual-release [patch\|minor\|major]` | Emergency local release path (rarely needed; CI handles normal releases) |

## Release process

Releases are CI-driven. The day-to-day flow:

**1. Auto-publish to `next` on every PR merge.** Open a PR, label it
`patch` / `minor` / `major` / `chore` (exactly one). On merge:

- `chore` → workflow skips entirely (use this for docs, CI fixes,
  internal refactors that don't ship to consumers)
- `patch` / `minor` / `major` → `.github/workflows/dev.yaml` bumps
  `package.json`, pushes the tag, and publishes to npm under dist-tag
  `next` via [npm trusted publishing](https://docs.npmjs.com/trusted-publishers)
  (OIDC, no long-lived secret)

**2. Promote `next` → `latest` when ready to ship.** When a `next` build
has been validated and you want it to become the default install for
end users, run from your local checkout (logged in to npm with publish
rights to `@thefittingroom/shop-ui`):

```sh
git pull origin main      # ensure package.json reflects the latest publish
npm run promote-latest    # moves dist-tag latest onto current package.json version
```

This runs `npm dist-tag add @thefittingroom/shop-ui@<ver> latest` — no
new artifact is published; we just point the `latest` tag at the
already-published `next` build, so consumers running `npm install
@thefittingroom/shop-ui` get the new version.

To promote a specific older version: `npm run promote-latest -- 5.0.13`.

**3. Verify the promotion** with `npm dist-tag ls @thefittingroom/shop-ui`.

The `manual-release` script is kept as an emergency local fallback for
when CI is unavailable; it does the version bump + git push but expects
you to run `npm publish` yourself afterward (which requires you to be
logged in to npm with publish rights).

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
