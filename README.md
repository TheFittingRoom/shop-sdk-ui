# shop-sdk-ui

The Fitting Room's browser SDK. A React/TypeScript ESM library that brands embed
on product pages to render virtual try-on, size recommendations, and avatar
creation flows. Authenticates against Firebase and talks to `tfr-backend`.

Distributed via npm and served to consumers through unpkg. The SDK registers
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

**1. Publish a release.**

- Go to https://github.com/TheFittingRoom/shop-sdk-ui/actions/workflows/release.yaml
- Click **Run workflow**
- Pick the bump type (`patch` / `minor` / `major`)
- Click **Run workflow**

The `release.yaml` workflow does everything in one run, in this order:

1. Checks out `main`, installs deps, and runs the same verification as
   the `verify` job in `pr-checks.yml`: `npm run check` (tsc, ESLint,
   Prettier), `npm run build`, and the Playwright suite.
2. Creates a fresh `release-bump-<timestamp>` branch and runs
   `npm version <bump>`: bumps `package.json` and `package-lock.json`,
   creates the bump commit, tags it `vX.Y.Z`. Nothing is pushed yet.
3. Rebuilds with the new version embedded and runs the verification
   again on the bump commit, the exact commit about to be published.
4. Publishes to npm under dist-tag `next` via
   [npm trusted publishing](https://docs.npmjs.com/trusted-publishers)
   (OIDC, no long-lived secret) with `--provenance` for supply-chain
   attestation.
5. Pushes the bump branch + tag (not to `main`, see below).
6. Opens a PR from the bump branch to `main`, posts a `verify` check
   run on the bump SHA through the Checks API (the run just verified
   that commit in step 3; the check links back to the run), and
   queues auto-merge.

The npm trusted-publisher entry for `@thefittingroom/shop-ui` must
point at `release.yaml`.

**What blocks publication:** any failure in steps 1 to 3. The run
stops there, before anything is published, pushed or opened, and the
Playwright report is attached to the failed run. The published
tarball's provenance (shown on the package's npm page and verified by
`npm audit signatures`) names the `main` commit the run started from;
the bump commit it was built from is that commit plus the version
change, tagged `vX.Y.Z`.

**If publish succeeds but the push or PR fails:** the version on npm
is the verified one, so only the bookkeeping is missing. Recreate the
bump from a clean `main` checkout and open the PR by hand;
`pr-checks.yml` runs `verify` on it like any other PR:

```sh
git checkout main && git pull origin main
git checkout -b release-bump-manual
npm version <patch|minor|major>   # same version and vX.Y.Z tag the run published
git push origin release-bump-manual --follow-tags
gh pr create --base main --head release-bump-manual --title "chore: release vX.Y.Z"
```

**Demo storefront visibility:** the `shopify` theme's `tfr.js` loads
the SDK from `unpkg.com/@thefittingroom/shop-ui@5` (its `PROD_URL`).
unpkg resolves that range to the highest published 5.x regardless of
dist-tag, so a release is live on the store as soon as it is on npm
(the redirect is cached for up to 5 minutes), with no theme change and
no `latest` promotion. Anything the release depends on, such as a
backend deploy, must be live first.

> **Ruleset + auto-merge note:** `main` is protected by a repository
> ruleset requiring PRs + a passing `verify` check. `release.yaml`
> works around this by pushing to a `release-bump-*` branch and
> opening an auto-merge PR. A branch push made with `GITHUB_TOKEN`
> never triggers `pr-checks.yml`, and the PR's own run is only created
> in an approval-required state (GitHub's anti-loop rule), so the
> workflow posts the `verify` check run itself, on the bump SHA it has
> just verified in step 3, and auto-merge fires on that check. See
> `AGENTS.md` → "Ruleset + auto-merge coupling" for the full
> rationale.

**2. (Optional) Promote to `latest` dist-tag.**

Only matters for consumers who install without a version pin
(`npm install @thefittingroom/shop-ui` → gets `latest`) or reference
`@latest` in a CDN URL. The demo storefront does neither, so this
step is not required for changes to appear on demo. When you do want
to move the `latest` pointer:

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

**4. Roll back a bad release.**

Treat published versions as permanent: npm's unpublish window is
narrow and unpkg/jsdelivr keep their copy regardless. Recovery means
moving pointers and publishing a fixed version, not deleting the bad
one. Which pointer depends on how the consumer loads the SDK:

- Consumers on `latest` (unpinned `npm install`, `@latest` CDN URLs):
  move `latest` back onto the last good version with
  `npm run promote-latest -- <previous version>`. No new publish is
  needed.
- Consumers on the `next` dist-tag (`@next` CDN URLs or
  `npm install @thefittingroom/shop-ui@next`): `next` points at the last
  version the workflow published, so a bad version can only be superseded.
  Fix on `main` and run the release workflow again.
- Consumers on a semver range (an `@5` CDN URL or a `^5` install): these
  resolve to the highest published version regardless of dist-tag, so the
  same applies; only a newer publish moves them.
- The demo store loads `@5`, so it is in the semver-range case above.
  To hold it on a known-good version while a fix is prepared, pin
  `PROD_URL` in the `shopify` theme's `tfr.js` to that exact version (a
  PR on `development`, which the live store syncs from), and set it back
  to `@5` once the fixed version is published.

## Environments

`init({ environment })` selects one of the profiles in
`src/lib/config.ts`. Each backend host verifies Firebase ID tokens
against exactly one Firebase project, so the SDK must sign users in to
that project or every authenticated call fails.
`tests/e2e/environment-contract.spec.ts` pins the pairings below;
change the table and the test together.

| `environment` | API host | Firebase project | Asset base | Release channel |
|---|---|---|---|---|
| `development` | `tfr.dev.thefittingroom.xyz` | `fittingroom-dev-5d248` | `objects.infra.thefittingroom.xyz/tfr-assets-dev` | The highest published 5.x, via the theme's `PROD_URL` (`unpkg.com/@thefittingroom/shop-ui@5`); live on publish, `latest` is not involved |
| `demo` | `demo.thefittingroom.xyz/api` | `fittingroom-dev-5d248` | `demo.thefittingroom.xyz/s3/tfr-assets-dev` | The same bundle, selected with `?tfr-source=demo` |
| `local` | `localhost:8080` | `fittingroom-dev-5d248` | `localhost:9000/tfr-assets-dev` | Local `dist/index.js` from `npm run watch-serve`, selected with `?tfr-source=local` |
| `production` | none yet | | | `init` fails with "not available yet"; use `development` |

The shared backend at `tfr-synteq.thefittingroom.xyz` also verifies
tokens against `fittingroom-dev-5d248`; it is not a production host. A
`production` profile will be added together with a backend that
verifies tokens against `fittingroom-prod`.

## Local development

Run the SDK against the local backend stack from
[`local-deployment`](https://github.com/TheFittingRoom/local-deployment).

1. Bring up the local stack (Postgres, Redis, s3proxy, `tfr-backend`):

   ```sh
   cd /path/to/local-deployment && docker compose -f docker-compose.nosimvis.yml up -d
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
   the SDK from `http://localhost:5173/dist/index.js` instead of unpkg, and
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
