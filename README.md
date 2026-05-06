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
| `npm run manual-release [patch\|minor\|major]` | Check, build, version bump, push tag |

Release: `npm run manual-release` then `npm publish`.

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

   The `?tfr-source=local` query param tells the storefront's TFR snippet to
   load the SDK from `http://localhost:5173/dist/index.js` instead of jsdelivr,
   and to initialize it with `environment: 'local'` (see `src/lib/config.ts` —
   that env points at `http://localhost:8080` for the API and the local MinIO
   bucket for assets).

Reload the storefront page after a rebuild to pick up changes.
