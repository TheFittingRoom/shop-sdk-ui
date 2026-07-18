# shop-sdk-ui — agent notes

The Fitting Room's browser SDK: a React/TypeScript ESM library that brands embed on
product pages. Authenticates against Firebase, talks to `tfr-backend` over HTTPS,
and renders a `<tfr-widget>` custom element.

## Build and distribution

- Vite library build → `dist/index.js` (single ESM bundle, unminified) plus inlined CSS.
- `npm run check` runs `tsc --noEmit`, ESLint, then `prettier --check` — the
  one-stop validation command. `npm run lint` / `lint:fix` run ESLint alone
  (flat config, `eslint.config.js`); `npm run format` / `format:check` run
  Prettier alone (`.prettierrc`; `.prettierignore` excludes `src/api/gen/`).
  `npm run build` cleans + builds. CI runs `check` + `build`. ESLint ignores
  `src/api/gen/` (tygo-generated). Non-null assertions and `any` are errors;
  control statements must be braced; `react-hooks/exhaustive-deps` is a warning.
- Consumers load the SDK via `<script type="module">` from a CDN URL backed by the npm package `@thefittingroom/shop-ui`. The `shopify` theme's `tfr.js` uses `unpkg.com/@thefittingroom/shop-ui@5` — a **semver range**, resolved by unpkg/jsdelivr to the highest matching published 5.x version regardless of dist-tag. **Consequence: publishing under `--tag next` is enough for the demo storefront to pick it up on the next reload; no `latest` promotion is required for that path.**

### Release flow

Releases are explicit and human-initiated. No magic on PR merges. See
README.md for the full walkthrough. Summary:

1. **Publish a release: trigger `.github/workflows/release.yaml`
   manually.** Actions tab → Release → Run workflow → pick patch /
   minor / major. The workflow: checks out main, builds (pre-bump
   verification), runs `npm version` on a fresh `release-bump-<ts>`
   branch, rebuilds with the new version, pushes the branch + tag,
   publishes to npm under dist-tag `next` via OIDC trusted publishing
   with `--provenance`, then opens an auto-merge PR to main. GitHub
   completes the squash-merge seconds later once `pr-checks.yml`
   posts the (skipped) `verify` check-run on the bump SHA. The npm
   trusted-publisher entry for `@thefittingroom/shop-ui` **must
   point at `release.yaml`**.

   The published version is immediately live on the demo storefront —
   `tfr.js`'s `unpkg.com/@thefittingroom/shop-ui@5` URL resolves to the
   highest matching 5.x version regardless of dist-tag. Demo picks up
   the new version even before the auto-merge PR completes (npm
   publish and GitHub merge are independent).

2. **(Optional) Promote to `latest` dist-tag.** Only matters for
   consumers who install without a version pin (`npm install
   @thefittingroom/shop-ui`) or reference `@latest` in a CDN URL. The
   demo storefront does not, so this step is not required for changes
   to appear on demo. When you do want to move the `latest` pointer:
   `git pull origin main && npm run promote-latest` locally (needs
   `npm login` with publish rights). Override the version with
   `npm run promote-latest -- <version>`.

The two-stage design (split bump from publish) was used previously to
work around npm OIDC trusted publishing not supporting
`pull_request_target` triggers ([npm/cli#8739](https://github.com/npm/cli/issues/8739)).
That constraint disappears entirely once the trigger is `workflow_dispatch`,
so the current single-workflow design is simpler and has no PAT
chain. Historical context preserved here in case the constraint comes
back or someone needs to re-derive why we don't auto-publish on PR
merge.

#### Ruleset + auto-merge coupling

`main` is protected by a repository ruleset (Settings → Rules) that
requires PRs to merge AND requires the `verify` context to be green.
`release.yaml` can't `git push origin main` directly under that
ruleset (`GITHUB_TOKEN`-authenticated pushes aren't in any bypass
list — repo-scoped rulesets can't reference the GitHub Actions
integration as a bypass actor). Instead:

- Push the bump on a `release-bump-<ts>` branch (not main).
- Open the PR via `gh pr create` + queue auto-merge via
  `gh pr merge --auto`. GitHub finishes the squash-merge as soon
  as the required-check is recorded.
- `pull_request` events fired by a PR opened via GITHUB_TOKEN get
  `action_required` — GitHub's anti-loop guard for bot-triggered
  workflows, not configurable at the repo level. Without an
  override, the `verify` check-run never posts and auto-merge
  blocks forever.
- `release.yaml`'s final step polls for that action_required run
  and approves it via `POST /actions/runs/{id}/approve` (needs
  `actions: write`). Approval is a separate authorization from the
  anti-loop rule and is allowed for GITHUB_TOKEN.
- Once approved, the `verify` job hits its `if:` guard, skips, and
  posts a `skipped` check-run. Job-level skip posts a check-run;
  workflow-level `paths-ignore` would post none, blocking
  indefinitely. `skipped` counts as SUCCESS for
  required-status-checks, and auto-merge fires.

The `verify` skip is safe: the release bump only touches
`package.json` + `package-lock.json` + a `dist/` rebuild whose only
difference is the embedded version string — nothing that lint, tsc,
or tests would fail on differently than the pre-bump verify that
`release.yaml` already ran.

If the org later grants the repo the ability to reference the
GitHub Actions integration as a bypass actor at ruleset creation
time (org-level ruleset, or via an app installation), the flow can
revert to a direct-push design — see the git history for how
`release.yaml` looked before the auto-merge PR indirection landed.

#### Why no auto-publish on PR merge

A previous design used PR labels (`patch` / `minor` / `major` /
`chore`) to auto-bump and publish on merge. It worked but had a
fragile multi-stage chain dependent on `pull_request_target` (broken
with OIDC), `SDK_PUSH_PAT` (an org secret with unknown scopes that
turned out to be unset), and a bunch of subtle interactions between
checkout credentials and downstream-workflow-trigger rules.
`workflow_dispatch` collapses all of that to a single button.

## Generated code — do not edit by hand

**`src/api/gen/`** is generated by [tygo](https://github.com/gzuidhof/tygo) from the
Go types in `tfr-backend`. Files: `common.ts`, `enums.ts`, `requests.ts`, `responses.ts`.
To change a payload shape, change the Go struct and regenerate:

```sh
npm run gen-types                     # default: ../tfr-backend
npm run gen-types -- /path/to/backend
```

The script (`scripts/gen-types.sh`) runs tygo inside a Go Docker container,
so the host needs Docker but no Go toolchain. Config lives in `tygo.yaml` at
the repo root.

`pkg/types/errors` is intentionally excluded — its constants use
`Error("...")` type-conversion form that tygo emits as `= any`, breaking
strict TS compilation. The SDK does not consume those constants directly,
so there are no callers to migrate.

## Runtime entry

`src/index.tsx` exports `init(InitParams)` and registers the `<tfr-widget>` custom
element. `init` runs a fixed sequence of `_init` calls across `src/lib/*` — the
`init` function in `src/index.tsx` is the source of truth for the current order.
Most lib modules follow this pattern: a module-scoped variable, an `_init` that
populates it (from `InitParams` or the store), and accessor functions. Order
matters — each `_init` may rely on an earlier one having run, so do not reorder
or insert a step without tracing the deps.

## Testing

E2E tests live in `tests/e2e/` and run via Playwright (Chromium). The harness
builds the bundle, serves the repo with `npm run serve`, and loads
`tests/e2e/fixtures/host.html` — a minimal Shopify-free analog of
`local-repo/shopify/assets/tfr.js`. Run them with `npm run test:e2e` (or
`npm run test:e2e:ui` to debug interactively).

**Firebase is mocked, not emulated.** `src/lib/firebase-mock.ts` provides
`MockAuthManager` and `MockFirestoreManager` that satisfy the `IAuthManager` /
`IFirestoreManager` interfaces. They're activated via `InitParams.testHooks`
— a data-only test hatch. The branch lives in exactly one place, at the top
of `_init` in `src/lib/firebase.ts`; no other file in `src/` knows about test
mode, and no `window.X` lookup happens in the SDK itself (the test host
fixture reads `window.__TFR_TEST_CONFIG__` and threads it into `init`).

Production callers MUST NOT set `InitParams.testHooks`. The field is
namespaced and documented as test-only.

REST endpoints (`/v1/styles/{id}/recommendation`, `/v1/style-categories`,
`/v1/style-category-groups`, `/v1/vto-compositions`) are mocked via Playwright
`page.route()` from `tests/e2e/mocks/api.ts`. Per-test overrides drive error
paths and edge cases.

`npm run check` stays cheap (tsc + ESLint + Prettier). `npm run test` runs the
e2e suite. CI runs both — see `.github/workflows/build.yml`.

## Environment selection

`InitParams.environment` is an `EnvName` (`development` | `production` | `demo`
| `local`). `src/lib/config.ts` maps each to firebase/api/asset/frames URLs.
`demo` points at the hosted demo server (`demo.thefittingroom.xyz`); `local`
points at the `local-deployment` Docker stack on the developer's host
(`http://localhost:8080`, s3proxy at `:9000`). Both reuse the dev Firebase
project. The Shopify theme defaults to `demo` and switches to `local` when the
page URL carries `?tfr-source=local`.

## Frame URL rewriting

Frame paths are bare (e.g. `user-X/avatar-N/frames/image_K.png` for avatar,
`user-X/avatar-N/vto-{token}/frames/image_K.png` for VTO compositions) — see the
matching note in `tfr-backend/AGENTS.md`. Avatar frames arrive on the Firestore
user doc; VTO frames come back directly in the `/v1/vto-compositions` API
response. The SDK prepends the configured `frames.baseUrl` (per-env in
`config.ts`) at the consumption site. Helper: `applyFrameBaseUrl` in
`src/lib/util.ts`. It also strips the host from any legacy host-prefixed URLs,
so both shapes work.

Used in both VTO overlays (`quick-view.tsx` and `fitting-room/`). Anywhere else
that turns a bare frame path into an `<img src>` should call `applyFrameBaseUrl`
too.

## VTO request flow

`requestVto(items)` in `src/lib/api.ts` posts a 1..4-garment composition to
`/v1/vto-compositions`. The endpoint is **synchronous**: the backend renders
inline and the resolved `VtoCompositionResponse` carries `{token, frames}`
directly — there is no Firestore subscription. A render failure rejects the
promise (HTTP 500 → thrown `Error` carrying the backend's message). The
request gets a client-side abort timeout (`config.api.vtoTimeoutMs`).

`requestVto` dedupes identical concurrent calls via a module-level in-flight
`Map<canonicalKey, Promise>`: while a composition's request is in flight every
caller shares the one promise and one POST. The canonical key is the items
sorted by `(colorway_size_asset_id, untucked)` — the same ordering the backend
hashes into the token. This is the SDK's guarantee against duplicate in-flight
VTO requests, and it holds across both overlays since both call `requestVto`.

Both VTO overlays drive that endpoint through the shared `useVtoRequests`
hook (`src/lib/use-vto-requests.ts`). The hook keys results
and component-level dedup by `outfitKey` (items joined on
`colorway_size_asset_id:untucked`), stores rendered frame paths per outfit,
applies the config-driven prefetch throttle (`config.api.vtoPrefetchDelayMs`),
and cancels still-queued prefetch timers when a new priority request fires.
The fitting room passes multi-garment outfits plus prefetch alternates;
`quick-view.tsx` passes a one-item outfit per size/color (`untucked` always
`false`) — it holds no `framesByKey`/`requestedKeysRef`/`compositionKey` of
its own. `useCache` on `execApiRequest` stays **off** for this endpoint; the
in-flight dedup above plus the backend's content-hash cache cover repeat
requests.

## Conventions

- Path alias `@/*` → `src/*` (configured in both `tsconfig.json` and `vite.config.js`).
- SVG imports use `?react` (vite-plugin-svgr) for components, plain import for URLs.
- CSS imported with `?inline` from `src/style.css`, injected as a `<style>` tag at init.
- Emotion is the styling solution (`jsxImportSource: '@emotion/react'`).
- State: Zustand (`useMainStore` in `src/lib/store.ts`). Static init-time data lives
  in a separate `staticData` singleton, not in the store.

## How this is consumed in the demo storefront

The test storefront is the `shopify` theme repo. Its `development` branch
syncs to `tfrshop-1346.myshopify.com` automatically on push. The theme's
`assets/tfr.js` is the bootstrap layer — it builds `currentProduct` from
Shopify's product object, wires merchant-supplied callbacks
(`getSelectedOptions`, `addToCart`, `productLookup`, `getOverlayTopOffset`),
and chooses the SDK URL: jsdelivr in production, `localhost:5173` when the
page URL has `?tfr-source=local`.

The widgets are embedded as `<tfr-widget>` custom elements in
`sections/main-product.liquid`, `sections/header.liquid`, and
`snippets/card-product.liquid`. New widgets typically need a corresponding
`<tfr-widget>` insertion there.

For SDK-only changes, run `npm run watch-serve` and reload the demo
storefront with `?tfr-source=local` — no theme push needed. For changes
that touch the bootstrap script, callbacks, or markup, push to the
`shopify` repo's `development` branch.

### Per-variant swatch metadata (`swatchImageUrl`, `swatchHex`)

`ExternalProductVariant` carries two optional swatch fields used by the
fitting-room rail-card `ColorSwatchRow`. They're populated by
`tfr.js`'s Storefront GraphQL `productLookup` path — sourced from
Shopify's Online Store 2.0 native option-value swatch metadata. When
the merchant hasn't configured a Storefront API token (Headless app +
public access token) or hasn't linked Colour option values to a Colour
metaobject, both fields come through `null` and `ColorSwatchRow` falls
through image → hex → text-label rendering. See `shopify/AGENTS.md` →
"Colour swatches (Storefront API token)" for the merchant-side setup.

## Fitting-room icon widget — three responsibilities

`src/components/widgets/fitting-room-icon.tsx` is no longer just the
header icon. It also hosts two anchored popovers that need to live next
to the icon:

- **First-visit tooltip** (`first-visit-tooltip.tsx`) — fires once per
  browser the first time the widget mounts. Dismiss paths (icon click,
  tooltip close, click-outside) all write the localStorage flag
  `tfr:first-visit-tooltip-seen:v1`, a sibling to the existing
  `tfr:fitting-room:v1`. While showing, the icon button gets a soft
  green pulsing box-shadow.
- **Add-confirmation drawer** (`add-confirmation-drawer.tsx`) — fires
  whenever any item is added to the fitting room from any surface
  (catalog hanger, PDP, quick-view). Auto-dismisses after 4s; click-
  outside also dismisses. Items inside use a trash icon for remove
  (calls `removeFromFittingRoom`); CTA opens the overlay.

### `lastAddEvent` — the cross-widget signal

The drawer is owned by the icon widget but fires in response to adds
that happen elsewhere (a separate `add-to-fitting-room-compact` widget
on catalog cards, a PDP widget, etc). They cannot call each other
directly. The signal funnels through `useMainStore`:

```ts
lastAddEvent: { externalId: string; at: number } | null
setLastAddEvent: (externalId: string) => void
```

Written by `addFittingRoomItem` in `fitting-room-storage.ts` (the
single funnel for all add paths). The icon widget subscribes; the `at`
timestamp lets re-adds of the same `externalId` re-fire (object
reference changes on every add). Not persisted to localStorage.

This is the canonical pattern for transient cross-widget signals — if
you need another one, use the same `{ id, at }` shape so subscribers
can dep on the whole object.

---

## Definition of done

A change is not complete until every box below is checked. The `init` /
gen / Firestore-conventions notes above are easy to drift from when
files move or shapes change — keep AGENTS.md edits in the same change as
the code they describe.

- [ ] `npm run check` (tsc --noEmit + ESLint + Prettier) clean
- [ ] `npm run build` produces `dist/index.js` without errors
- [ ] `npm run test:e2e` passes (locally or in CI)
- [ ] If the change touches Firebase, the REST API, the `_init` sequence, or
      the `InitParams` shape: e2e fixtures (`tests/e2e/fixtures/host.html`,
      `tests/e2e/fixtures/seed.ts`, `tests/e2e/mocks/api.ts`) still match the
      contract, and `MockAuthManager` / `MockFirestoreManager` still satisfy
      `IAuthManager` / `IFirestoreManager`
- [ ] If consumed any new or changed backend types: `npm run gen-types`
      ran and the `src/api/gen/*` diff is committed in the same change
- [ ] If a new `_init` step was added: placed correctly in the `init`
      function in `src/index.tsx` relative to the steps it depends on,
      and any module-scoped `let` variable + accessor pattern is
      consistent with sibling modules
- [ ] If a new Firestore subscription was added: an `Unsubscribe` is
      tracked and torn down on unmount or auth-state change (see
      `AuthManager.listenToUserProfileUnsub` in `src/lib/firebase.ts` for
      the pattern)
- [ ] Demo storefront round-trip verified with `?tfr-source=local` for any
      user-visible change (or noted explicitly when the change can't be
      visually verified)
- [ ] **AGENTS.md updated** if the change touches: the build/release flow,
      the gen-types boundary, the `_init` order, the frame URL contract,
      the VTO request flow, the Zustand store conventions, or any specific
      file/helper this file cites by name
- [ ] **README.md updated** if the local-development workflow,
      `npm run` scripts, or storefront integration changed
