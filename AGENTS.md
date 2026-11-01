# shop-sdk-ui — agent notes

## Agent notes live in AGENTS.md — pair every one with a CLAUDE.md

Contributor and agent guidance in this repo goes in `AGENTS.md` files (this
root file and any per-directory ones). **Claude Code only auto-loads
`CLAUDE.md` files — including nested ones in subdirectories — and does not
read `AGENTS.md` on its own.** So every `AGENTS.md` must sit beside a
`CLAUDE.md` that imports it, whose entire contents are:

    @AGENTS.md

The repo root already does this. When you add directory-scoped notes, create
both `<dir>/AGENTS.md` and `<dir>/CLAUDE.md` (the latter containing just
`@AGENTS.md`), or Claude Code will never load them.

## Overview

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
- Consumers load the SDK via `<script type="module">` from a CDN URL backed by the npm package `@thefittingroom/shop-ui`. The `shopify` theme's `tfr.js` loads `unpkg.com/@thefittingroom/shop-ui@5` in its `PROD_URL`, a semver range that unpkg resolves to the highest published 5.x **regardless of dist-tag**. **Consequence: every release is live on the store as soon as it is on npm (unpkg caches the redirect for up to 5 minutes), with no theme change. Anything the release depends on, such as a backend deploy, must be live first.**

### Release flow

Releases are explicit and human-initiated. No magic on PR merges. See
README.md for the full walkthrough. Summary:

1. **Publish a release: trigger `.github/workflows/release.yaml`
   manually.** Actions tab → Release → Run workflow → pick patch /
   minor / major. The workflow, in one job: checks out main, runs
   the same `check` + `build` + e2e verification as `pr-checks.yml`,
   runs `npm version` on a fresh `release-bump-<ts>` branch, rebuilds
   with the new version and runs the verification again on the bump
   commit (any failure stops the run before anything is published,
   pushed or opened), publishes to npm under dist-tag `next` via OIDC
   trusted publishing with `--provenance`, pushes the branch + tag,
   opens a PR to main, posts a `verify` check run on the bump SHA
   through the Checks API, and queues auto-merge. If publish
   succeeds but a later step fails, recreate the bump and PR by hand
   (README "Release process"). The npm trusted-publisher entry for
   `@thefittingroom/shop-ui` **must point at `release.yaml`**.

   The published version goes live on the storefront as soon as the
   publish lands (the theme loads `@5`, see above), so the release run
   is the store release.

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
- A branch push made with GITHUB_TOKEN never creates a workflow run,
  and the `pull_request` run for a PR opened with GITHUB_TOKEN is
  created only in an approval-required state (GitHub's anti-loop
  rule, see
  https://docs.github.com/en/actions/concepts/security/github_token).
  Neither can be relied on to post the `verify` context.
- So `release.yaml` posts the `verify` check run on the bump SHA
  itself through the Checks API (`checks: write`), right after it has
  run the full verification on that commit, with `details_url`
  pointing at the run. No PAT or GitHub App is involved.
- Open the PR via `gh pr create` + queue auto-merge via
  `gh pr merge --auto`. GitHub finishes the squash-merge as soon as
  the check is recorded.

`verify` must not be skipped in `pr-checks.yml`. A job-level `if:`
posts a `skipped` check-run, which GitHub counts as SUCCESS for
required-status-checks, so any branch-name exemption lets an
unverified commit merge. For release PRs the context is the check
run `release.yaml` posts, which reports the verification it ran on
that exact commit before publishing.

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

**Firestore queries are plain data, not Firebase constraint objects.**
`IFirestoreManager.queryDocs` takes `QueryFilter[]` (`{ field, op: '==', value }`)
rather than the `QueryFieldFilterConstraint` objects `where()` returns.
`FirestoreManager` translates them into `where(...)` internally, so the
Firebase-specific shape stops at that class.

The reason is that those constraint objects are opaque — field, operator and
value live on private members — so `MockFirestoreManager` could not honour them
and returned *every* doc in a collection regardless of the query. Two documents
in one collection were therefore indistinguishable: every lookup got the first,
which blocked any test needing two distinct products. Only equality is
modelled, because only equality is used; widening to Firebase's full
`WhereFilterOp` would let callers write comparisons the mock silently does not
apply, so a test would pass while filtering nothing.

**Firebase is mocked, not emulated.** `src/lib/firebase-mock.ts` provides
`MockAuthManager` and `MockFirestoreManager` that satisfy the `IAuthManager` /
`IFirestoreManager` interfaces. They're activated via `InitParams.testHooks`
— a data-only test hatch. The branch lives in exactly one place, at the top
of `_init` in `src/lib/firebase.ts`; no other file in `src/` knows about test
mode, and no `window.X` lookup happens in the SDK itself (the test host
fixture reads `window.__TFR_TEST_CONFIG__` and threads it into `init`).

Production callers MUST NOT set `InitParams.testHooks`. The field is
namespaced and documented as test-only.

**Any of `testHooks.auth`, `testHooks.accounts` or `testHooks.firestore`
switches the mocks on; nothing else does.** A test with none of them runs
against **real Firebase** (the dev project). `accounts` was added to that
list after a signed-out sign-up test that only listed accounts created a real
account (`taken@example.com`) in the dev project. `bootSdk` now always sets
`accounts` (empty by default), so every e2e test runs on the mocks; a test
that builds its own `testHooks` must do the same.

`MockAuthManager.signUp` creates uid `signup-<email>` and refuses an email the
seeded user or `accounts` already has (`auth/email-already-in-use`). No
profile exists until the test writes `users/<uid>` through
`window.__TFR_TEST_MOCKS__`, as the backend's Firestore sync would.

REST endpoints (`/v1/styles/{id}/recommendation`, `/v1/style-categories`,
`/v1/style-category-groups`, `/v1/vto-compositions`, `PUT /v1/users/{uid}`,
`PUT /v1/users/{uid}/gender`, `/v1/demo-avatars/{gender}`) are mocked via Playwright
`page.route()` from `tests/e2e/mocks/api.ts`. Per-test overrides drive error
paths and edge cases.

`npm run check` stays cheap (tsc + ESLint + Prettier). `npm run test` runs the
e2e suite. CI runs both — see `.github/workflows/build.yml`.

### A test isn't done until it has failed

The standard across our repos: a test is not ready until it has been shown
to fail when the code it guards does the wrong thing. A green test proves
nothing on its own — a selector that matches nothing, an assertion made
before the state it checks, or a fixture that hides the behaviour all pass.

For each new or changed test:

1. Name the behaviour it guards and write a **mutant**: the smallest change
   to `src/` that breaks that behaviour (drop a condition, return early,
   render nothing, skip a call).
2. Run the test against the mutant and see it fail, **for the reason it
   should** (read the failure, not just the count).
3. Restore the code and see it pass again.

A test no relevant mutant fails is fixed or deleted. Record the mutants and
what each one caught in the PR, and in this file where a test guards
something easy to undo (as the frame-display and outfit sections do).

Two traps:

- **Playwright reuses a running server.** `reuseExistingServer` is on
  locally, so if anything is serving `:5173` (`npm run watch-serve`, a
  previous run) the mutant is never built and every run tests the old
  bundle. Check nothing holds the port before a mutation run.
- **Restore from a copy, and verify the restore.** Use `/bin/cp -f` (a
  `cp` alias that prompts hangs a script) or keep the original in memory,
  and diff afterwards; a mutant left behind ships.

**The host page is not the store.** `host.html` has none of the theme's fonts
or CSS, so layout that fits there can overflow or collapse on a real
storefront. For any visual change, also run
`node scripts/storefront-screenshots.cjs <out-dir>` (after `npm run build`):
it loads the demo storefront in a headless browser and answers the store's
unpkg request with `dist/index.js`, so the theme runs this build (desktop and
phone; signed-out screens only, so no renders). It deliberately doesn't use
`?tfr-source=local-dev`: Chrome's local network access rules block a public
site loading from localhost unless the user has allowed it. Two things it
caught that the e2e host page never showed:

- **Storefront themes hide empty elements** (Shopify Dawn has
  `div:empty { display: none }`). Never rely on an empty element for spacing
  (e.g. an always-present error row); space with margins and render the row
  only when it has content.
- **Content can outgrow the modal.** `ContentModal`'s body has `minHeight: 0`
  so it scrolls inside the fixed-height frame instead of clipping its buttons
  out of reach, and the landing image is capped at 30vh so the pinned
  "Powered by" footer doesn't cover the sign-in line.

## Environment selection

`InitParams.environment` is an `EnvName` (`development` | `demo` | `local`;
`production` is in the enum but `getConfig` throws for it because no production
backend exists yet). `src/lib/config.ts` maps each to firebase/api/asset/frames
URLs; `tests/e2e/environment-contract.spec.ts` pins which Firebase project each
API host is paired with, and every host today verifies tokens against the dev
project. `development` points at the shared dev backend
(`tfr.dev.thefittingroom.xyz`);
`demo` points at the hosted demo server (`demo.thefittingroom.xyz`); `local`
points at the `local-deployment` Docker stack on the developer's host
(`http://localhost:8080`, s3proxy at `:9000`). The Shopify theme defaults to
`development` and switches to `local` or `demo` via `?tfr-source` (see README
"Environments").

## Frame URL rewriting

Frame paths are bare (e.g. `user-X/avatar-N/frames/image_K.{ext}` for avatar,
`user-X/avatar-N/vto-{token}/frames/image_K.{ext}` for VTO compositions) — see
the matching note in `tfr-backend/AGENTS.md`. **The extension is not fixed**:
sim-vis chooses the render format (PNG historically, JPEG as of WEB-12), the
backend derives the stored path from the bytes, and the SDK just consumes
whatever path it is given. Nothing here may pattern-match on `.png`.

Avatar frames arrive on the Firestore
user doc; VTO frames come back directly in the `/v1/vto-compositions` API
response. The SDK prepends the configured `frames.baseUrl` (per-env in
`config.ts`) at the consumption site. Helper: `applyFrameBaseUrl` in
`src/lib/util.ts`. It also strips the host from any legacy host-prefixed URLs,
so both shapes work.

Used in both VTO overlays (`quick-view.tsx` and `fitting-room/`). Anywhere else
that turns a bare frame path into an `<img src>` should call `applyFrameBaseUrl`
too.

## Frame display: preload, then animate

The avatar viewer swaps `src` on a **single** `<img>`. A browser keeps painting
the previous frame until the new one has decoded, so an un-preloaded rotation
advances its index on schedule while the pixels barely move — and there is no
loading state to show, because as far as the DOM is concerned an image is
already displayed. That is the mechanism behind most of WEB-12's "auto-spin
didn't happen" / "inexplicable delay with no loading state" reports.

Three pieces, and they are meant to be used together:

- **`use-frame-preload.ts`** fetches and `decode()`s a whole frame set and
  reports `allSettled`. It **retains** the `Image` objects in a ref (bounded,
  oldest-first eviction). Retention is the point: the previous approach created
  `new Image()` inside a `useMemo` and dropped every reference immediately, so
  it depended entirely on HTTP caching — which was itself broken. Failures
  count as settled so one bad frame can't wedge the gate.
- **`use-auto-rotate.ts`** takes `framesReady` and won't start until the set is
  decoded, with a timeout so a frame that never settles delays the rotation
  rather than suppressing it. It steps off `requestAnimationFrame` using
  elapsed time (not `setInterval`), so it can't accumulate drift and stops on
  its own in a backgrounded tab instead of queueing catch-up ticks.

**Where a rotation starts and ends (the "anchor").** Frame 0 until the shopper
moves the frame themselves; afterwards, whichever frame they settled on — so
someone who spun round to see the back, then adds another product, sees the new
outfit settle on that same back view. The second half is the original design
intent; the first half fixes a wrinkle in it, because the anchor used to be
simply "whatever index is displayed when the trigger fires" and an outfit
change *during* a rotation therefore adopted whatever angle the animation was
passing through — parking shoppers on a side view they never asked for.

Two consequences for anyone touching this:

- **`cancelAutoRotate` is the user-control signal, not just a stop button.**
  It halts the rotation *and* marks the frame as the shopper's to choose.
  Every surface that moves the frame must call it — chevrons, drag, the zoom
  modal, the (currently hidden) rotation slider. A rotation ending by itself
  goes through the internal `stopRotation` instead; routing completion through
  `cancelAutoRotate` would make the avatar anchor wherever the last animation
  happened to stop.
- **The anchor is only recorded while nothing is playing.** Mid-rotation the
  index belongs to the animation, not the shopper.

**The snap to the anchor is a `useLayoutEffect`, deliberately.** When the
frame set changes it must land *before the browser paints*, or the new outfit
is painted at whatever index the previous one was left on and then jumps to an
unrelated angle. The rotation itself cannot do this job: it waits for the set
to finish decoding, and a plain effect runs after paint either way. The snap is
gated on a pending trigger, so an outfit change resets the angle while a size
or colour swap holds it — which is what lets a shopper compare sizes at the
same view.

Covered by `e2e/outfit-change-rotation.spec.ts`, which is the only spec that
performs **two successive adds**. That matters: quick-view fires one
auto-rotate trigger per product, so a second trigger never arrives there and
old/new behaviour agree — both WEB-12 rotation regressions reached demo
because every existing spec was structurally blind to them.

Three properties, each verified to fail when the corresponding behaviour is
reverted:

| Behaviour removed | Which test catches it |
|---|---|
| anchor follows the live index | changing outfit mid-rotation shows the new outfit front-facing |
| pre-paint snap becomes a no-op | (same test) |
| anchor always resets to 0 | a manually chosen angle survives an outfit change |

Two things that fixture has to keep doing, or it silently stops proving
anything:

- **Return distinct frames per composition.** Identical frame paths leave
  `frameKey` unchanged, the snap correctly does not fire, and the test passes
  for the wrong reason. Real compositions differ because the S3 path embeds a
  content hash.
- **Assert a rotation *left* the anchor before returning to it.** The frame set
  is displayed at the anchor from the start, so asserting only the final
  position passes without any rotation having run — an earlier draft of these
  tests did exactly that and completed in 700 ms.
- **`use-frame-rotation.ts`** fires `onUserInteract` at *drag start* (mouse) or
  at the *axis-lock decision* (touch, so a vertical page scroll doesn't cancel),
  not at the first committed rotation step.

**Every surface that shares a frame index must be able to cancel the
rotation.** The desktop zoom modal shares `selectedFrameIndex` with
`AvatarPane`, so `AvatarPane` publishes its cancel callback through the
optional `cancelAutoRotateRef` prop and `desktop-layout.tsx` hands it to
`ZoomModal`. Miss this and a rotation keeps ticking behind the modal, fighting
the user's own chevron taps.

`e2e/quick-view-vto.spec.ts` guards all of this: frames requested up front (not
per tick), the rotation advancing, and user-cancel. The preload test was
confirmed to fail when the preload is disabled — keep it that way.

## Pinch-zoom on the frame

`AvatarFrameViewer` zooms with two fingers (`src/components/use-pinch-zoom.ts`),
so it works wherever the frame does — fitting room and quick view, phone
layouts. Desktop keeps its separate Zoom In modal.

- **Pinch** zooms 1×–4× about the fingers' midpoint. Pinching back to within
  5% of 1× snaps out; a **double tap** while zoomed resets.
- **Zoomed, one finger pans** instead of rotating, and the image switches to
  `touch-action: none` so the page doesn't scroll under it. The arrows still
  rotate and keep the zoom, so a detail can be compared across angles.
- **A new frame set resets the zoom** (keyed on the first frame URL).
- **Each finger fires its own touchstart.** A second finger landing during a
  gesture restarts that gesture as a pinch (`restartRef`) rather than
  starting a second one, and `useFrameRotation`'s touch drag gives itself up
  when it sees two touches, so a drag that becomes a pinch never rotates.
- The pinch counts as user control (`onUserInteract`), so it stops an
  auto-rotate like a drag does.

Guarded by `e2e/pinch-zoom.spec.ts` (Pixel 5 profile, synthetic multi-touch),
confirmed to fail when the pinch is disabled.

## VTO request flow

`requestVto(items)` in `src/lib/api.ts` posts a 1..3-garment composition (`MAX_OUTFIT_ITEMS`, see "The garment cap") to
`/v1/vto-compositions`. The endpoint is **synchronous**: the backend renders
inline and the resolved `VtoCompositionResponse` carries `{token, frames, tuck}`
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

### The tuck control is the backend's call

Whether the tuck control appears, and what it says, comes from the `tuck`
object on the VTO response (`{available, untucked, label}`) — **never from the
style categories.** The backend owns the rules (an oversized top stays
untucked; a dress in the outfit turns the wording into "Top Over" / "Top
Under"; a loose top stays over a fitted dress; and the older "is there
anything to tuck into" check). The SDK used to compute that last one itself
(`canTuck` in `fitting-room/index.tsx`, `containerHasTuckableChild` in
`quick-view.tsx`); both are gone, and re-adding a client-side rule would put
the SDK back in disagreement with what was actually rendered.

- `useVtoRequests` exposes `tuckControlForOutfit(items)` → `{available, label}`
  or `null`. `null` (no response for those garments yet, or a backend that
  sends no `tuck`) means **hidden** — there is deliberately no fallback.
- The ruling is stored per **set of garments** (`garmentsKey`, the sorted CSA
  ids), not per `outfitKey`. `available` and `label` do not depend on the
  requested tuck state, so the flipped outfit's ruling is known the moment the
  shopper presses the control and the mobile button under ADD TO CART does not
  disappear for a whole render. (The desktop pill disappears anyway: `AvatarPane`
  hides all its controls while frames load.)
- `tuckActionKey(label, untucked, placement)` in `src/lib/tuck-control.ts` is
  the one place that maps a ruling to a locale key. The control names the
  action, so it reads from the state the outfit is *not* in: "Untuck" /
  "Top Over" while tucked in, "Tuck In" / "Top Under" while untucked.
- `forceUntuck` / `containerUntucked` are still only the shopper's *request*.
  When the backend forces a top untucked the response says
  `available: false, untucked: true` and the frames are the untucked render,
  whatever the SDK asked for; with the control hidden there is nothing to
  reconcile.

Guarded by `e2e/tuck-control.spec.ts`, whose outfit "can be tucked" by its
categories in every test — so a control that ignores the response fails the
unavailable, no-ruling and Top Over cases.

**Deploy order:** the backend must ship `tuck` before an SDK with this change
is released. Against an older backend the control is simply hidden.

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
and chooses the SDK URL: unpkg (`@5`) by default, `localhost:5173` when the
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

## Fitting-room desktop detail accordion

The desktop middle pane (`detail-accordion.tsx` → `DesktopAccordionItem` in
`detail-accordion-item.tsx`) shows **at most one** open section. Normally one
*is* open, but zero is a legitimate state the shopper reaches by collapsing the
open section — so nothing may auto-open unconditionally, or the collapse
control becomes impossible to use. The one case that does re-open
automatically is the effect in `index.tsx` watching for the open item leaving
the selection (deselected, removed via its X, or evicted by a clashing add):
the open state moves to another selected item rather than leaving everything
collapsed.

**That effect is the only place allowed to react to it.** The three call sites
that drop an item previously cleared the open id themselves. Because those
`setState` calls batch with the selection update, the effect only ever saw an
already-null id and never fired — the hand-off was dead code until an e2e that
could hold two sections open caught it.

**Collapsed rows carry the product name and a size selector**, so a garment can
be re-sized without opening it. Both platforms use the same card model: a grey
card (`#EEEEEE`) with the header tinting over it, and a white content area
inset by 6px so a frame of the card shade surrounds it — that frame *is* the
border, rather than a drawn one. Desktop and mobile share the header
typography too (Times New Roman 400, 0.04em tracking, category and product
name on one baseline row with the name greyed and ellipsised); only the size
differs, 20px desktop vs 16px mobile.

Two constraints hold this together:

- **The size pills render OUTSIDE the header `<Button>`.** That button is the
  section toggle and spans the row, so pills nested inside it would collapse or
  expand the section on every size change — and because the section re-renders,
  that reads as the size change not working at all. Guarded by
  `e2e/desktop-detail-accordion.spec.ts`, verified to fail if the collapsed
  strip is made to toggle.
- **The product name appears only while collapsed** — the one intentional
  divergence from mobile, whose header carries the name in both states. The
  desktop open body already renders it as `variant="brand"`, so showing both
  would duplicate it; mobile's body has no product name, so it doesn't.

**The pane itself doesn't scroll.** Every selected item's row is always on
screen: collapsed rows take their natural height, the open item fills what is
left (`containerOpen`) and its body scrolls inside itself. The open item has a
floor (`OPEN_ITEM_MIN_HEIGHT_PX`); only a pane too short for the collapsed rows
plus that floor falls back to scrolling as a whole.

**The open item says when there's more below.** macOS hides overlay
scrollbars until you scroll, so on its own the body gives no sign it scrolls.
Two cues, because neither works everywhere:

- **A styled scrollbar** (`::-webkit-scrollbar` on the body). Once styled,
  Chrome, Edge and Safari draw a classic, always-visible bar instead of the
  fading overlay. Don't add `scrollbar-width` / `scrollbar-color` to the same
  element: Chrome 121+ ignores the `::-webkit-scrollbar` rules when either is
  set. Firefox can't be forced; on macOS it follows the system setting.
- **A white fade with a Scroll down button** over the body's bottom edge,
  shown only while there's more below (`useScrollOverflow`, shared with the
  card rails' edge handles). The fade sits outside the scroller in a
  `bodyFrame` so it doesn't scroll away with the content, has
  `pointer-events: none` so it never blocks the controls under it (Add to
  cart is often there), and stops short of the scrollbar. Only the button
  takes clicks; it scrolls 80% of the body's height.

Playwright's headless Chromium runs with `--hide-scrollbars`, so the e2e
checks the scrollbar *rule* on the body, not its width.

**Add all to cart** shows only with two or more items selected (for one, that
item's own Add to cart is the same action), in TFR teal rather than the brand
colour so it reads as a different action from the per-item button. It sits
at the bottom of the pane (`marginTop: auto`, so also with nothing open); on
mobile it follows the product rows in the try-on sheet, so it shows whenever
the sheet is not collapsed. It
calls the merchant `addToCart` once per selected item, one after another —
concurrent Shopify `/cart/add` calls can drop each other's additions — closes
the overlay when all went in, and otherwise stays open with an error snackbar.

**An item with no fitting size says so.** The backend answers a no-fit
product with an empty recommendation (200), so `buildVtoProductDataFromResolved`
returns null for it exactly as it does while data is still loading. The two are
told apart by `isItemLoadSettled` / `isItemNoFit` (`src/lib/fitting-room-data.ts`):
once the merchant product and our size recommendation have both settled
(loaded or failed) and there is still no usable size, the row shows quick
view's "no well fitting sizes" message instead of "Loading..." — open or
collapsed, desktop and mobile. **Add all to cart is disabled** while any
selected item is no-fit: it would otherwise go in at its remembered PDP size,
which we've just said doesn't fit. The row's message is the explanation.

**A failed cart add shows an error** — the single-item Add to cart (desktop
and mobile) as well as Add all. The snackbar is our own message, plus the
store's reason on a second line when there is one: `cartErrorDetail`
(`src/lib/cart-error.ts`) finds Shopify's cart error JSON inside the error the
merchant callback threw (the theme's `tfr.js` embeds the 422 body in its error
text) and takes `description`, falling back to `message` — Shopify's `message`
is just the heading "Cart Error", and `description` is the actual reason
("Cannot find variant"). Nothing else from the error text is shown: the rest
is developer detail. Quick view is not covered — it adds through the PDP's own
form after closing itself, so the store page reports those errors.

Guarded by `e2e/desktop-detail-pane.spec.ts`. The host fixture records every
add in `__TFR_TEST_ADDS__` and fails the ids listed in `__TFR_TEST_ADD_FAIL__`,
with a theme-shaped error text (or `__TFR_TEST_ADD_FAIL_TEXT__`).

This is desktop-only. Mobile keeps its own three-state sheet, where
`isMobileQuickRow = sheetSnap === 'expanded' && openAccordionItemId == null`
puts a size selector on *every* row when nothing is open. Note that expression
depends on the shared `openAccordionItemId` being nullable — forcing a section
to always be open would silently disable mobile's quick-row mode.

## Outfit composition: clashes swap, only the cap disables

The composition rules (`includes` / `excludes` per category, each group's
`same_group_default`) come from the backend's style-category config, but
**only the SDK applies them** — the backend checks nothing but the garment
cap. They live in `src/lib/fitting-room-outfit.ts`.

A clash never disables a fitting-room card. Selecting an item evicts every
selected item it can't be worn with (`getOutfitConflicts`): the same parent
category, or any pair `itemsCompatible` rejects. A Suits & Sets container is
judged by its pieces, so a shirt + trousers Set evicts a standalone shirt and
pants, and either of those evicts the whole Set — a Set is never partly
selected. Same parent category still swaps inside a `compatible` group, where
the rules alone would let two coexist.

`computeAvailability` disables a card only for a missing category or the
garment cap, and counts the cap **after** those evictions (shirt + pants, then
a 3-piece Set with a shirt and trousers: both leave, 0 + 3 = 3, allowed).

### The garment cap: 3, temporarily (WEB-36)

`MAX_OUTFIT_ITEMS` caps the garments in a try-on, a Set counting one per
piece. It is **3 for now** (normally 4): 4-layer renders need more testing
against real outerwear first. The backend enforces the same cap on
`/v1/vto-compositions` and caps Sets and Set templates at 3 pieces
(tfr-backend AGENTS.md → "Garment cap"), so no new 4-piece Set can be made; one
made before is disabled in the fitting room, being over the cap on its own.

**Order matters.** Lowering: release the SDK before deploying the backend,
or an older SDK on the store sends 4-garment outfits to a backend that
refuses them. Raising back to 4: the backend first, then this constant, then
release.

Guarded by `e2e/garment-cap.spec.ts`, each test confirmed to fail with the
cap at 4 or at 2 (as named in it), with a Set counted as one garment, and
with evicted items still counted. `buildOutfit`'s trim to the cap is not
covered: `computeAvailability` stops an over-cap selection before it runs.

**A clash swap says what it removed.** A same-category swap (one pair of pants
for another) is self-explanatory and stays silent. Any other eviction raises
an info snackbar — "Removed X, Y from your outfit" with **Undo** — that closes
after `SWAP_NOTICE_MS` (5s). Undo restores the selection from before the tap;
nothing was removed from the fitting room, only deselected. The notice holds
the selection its swap produced (`swapNotice.result`) and is dropped the
moment the selection is anything else, so Undo can never throw away a later
change. It yields to an error snackbar rather than stacking under it.

`Snackbar`'s `variant="info"` fills with TFR teal (`theme.color_tfr_800`, as
the help popups use) so a notice never reads as one of the near-black error
pills; it also takes an `action` link, `autoDismissMs` and `bottom`. Info is
`role="status"`, error `role="alert"`.

**Fitting-room snackbars sit above the bottom controls**, error and info alike:
80px on desktop and mobile try-on (clearing the 48px Add all / Try It On button
inset 16px), 140px on mobile browse (also clearing the floating Clear All pill
at 96px). `bottom` is applied outside `useCss`, which computes once per mount,
because the layout can switch while a snackbar is up. If either layout's bottom
controls move, update `SNACKBAR_BOTTOM*` in `fitting-room/index.tsx`. The
overlap tests check vertical clearance only: the test host has no viewport
meta, so the phone profile lays out 980px wide.

Guarded by `e2e/outfit-conflicts.spec.ts`; the swap tests were verified to
fail with the old disable rule, the notice test with a notice on every swap.

## Sign-up and the demo avatar (WEB-25)

Shoppers can create an account in the SDK and try on before they ever scan:
until they have an avatar of their own they **borrow** a shared demo avatar
for the gender they chose. The backend decides which avatar size-rec and VTO
use (tfr-backend `AGENTS.md` → "Demo avatars"); the SDK mirrors that decision
so what it shows matches what was rendered.

**Which avatar — `src/lib/user-avatar.ts`.** `userAvatarFromProfile` turns
the Firestore profile into `store.userAvatar`:

- `own` — `avatar_frames` present **or** `avatar_status === 'CREATED'`. Both
  halves matter. The status covers the avatar sync, which rewrites the whole
  user doc and adds `avatar_frames` back a moment later (without it, a
  shopper with an avatar and a gender flickers to the demo one; guarded by
  `vto-prefetch.spec.ts` "a new avatar while quick view stays open"). The
  frames cover a re-scan (`PENDING`) or a failed render (`NOT_CREATED`), where
  the previous avatar is still theirs — the backend uses it too.
- `demo` — no own avatar, `gender` is `female` or `male`.
- `needs_gender` — neither (an app account that never scanned). Quick view
  and the fitting room show `GenderPrompt` instead of the try-on; choosing
  calls `PUT /v1/users/:uid/gender` and patches the profile locally rather
  than waiting for the Firestore sync.

`userHasAvatar` and the redirect to the get-app screen for shoppers without
an avatar are gone.

**Demo frames come from `GET /v1/demo-avatars/:gender`**, loaded by
`src/lib/demo-avatar.ts` into `store.demoAvatarFrames` — never from the
shopper's own `avatar_frames`, which the backend keeps free of them because
the mobile app shows that field as the user's own avatar. `useAvatarFrames()`
gives whichever applies; the fitting room's bare-avatar pane uses it.

**Caches follow the avatar.** `avatarKey` names the avatar results were
computed on (`demo:<gender>`, or an own avatar's first frame path) and
`AvatarKeyTracker` reports when one known avatar replaces another. api.ts
then moves the owner generation on (VTO caches, see "VTO request flow") and
clears the response cache, and product.ts drops the stored product data, so
size recommendations made on the demo avatar's measurements are fetched
again once the shopper's own avatar arrives. The demo key is what makes the
demo → own switch count as a replacement; `demo-avatar.spec.ts` "when the
shopper's own avatar arrives" fails without it.

**UI pieces**, each rendering nothing for a shopper with their own avatar so
layouts can place them unconditionally:

- `DemoWatermark` — "DEMO AVATAR" over every try-on image: inside
  `AvatarFrameViewer` (fitting room, quick view) and the desktop
  `ZoomModal`. `pointer-events: none`, so dragging and pinching still reach
  the image.
- `MiniMePill` — "Create your Mini Me", TFR teal, opens `GetAppPopup`: the
  get-app content as its own modal over the current overlay, so closing it
  returns the shopper exactly where they were (switching to the GET_APP
  overlay would unmount the fitting room and lose its state). Placement:
  quick view desktop replaces the title; quick view mobile top-left (close is
  top-right); fitting room mobile try-on top-right; fitting room desktop and
  mobile browse in `TopRightPills` beside the `SectionNav`.

**Sign-up (`overlays/sign-up.tsx`, OverlayName.SIGN_UP)**, from the landing
screen's "Try it now, scan later" and the sign-in screen's "Create one.": email,
password (Firebase's 6-character minimum), name, Female/Male, and the 18+ and
Terms/Privacy checkboxes (`config.links`), all required. It does what the
mobile app does: `authManager.signUp` (Firebase), then `api.putUser` with
`gender`, then refreshes the token so it carries the role the backend just
assigned. If the Firebase account was created but `putUser` failed, the
shopper is still signed in to it and the next submit skips straight to
`putUser` (signing up again would fail with "email already in use"). The
profile doc appears once the backend's Firestore sync runs; until then the
overlay shows Loading.

**Landing screen:** "Try before you scan with a demo avatar", a white
"Try it now, scan later" button (Button variant `secondary`), "OR", then
"Create your Mini Me" (the get-app screen) and Sign in.

**Errors.** The SDK has no special handling for the backend's 409 (gender
required) or 503 (no demo avatar set up). It never sends a request that
could get the 409: nothing loads for a `needs_gender` shopper until they
choose. A 503 is a failed try-on like any other (the try-on error
snackbar). A failed gender save keeps the prompt up with an error.

Guarded by `e2e/demo-avatar.spec.ts`. Each mutant below was applied to
`src/` alone and failed the tests named (2026-11-01, 25 mutants, all
caught):

| Mutant | Fails |
|---|---|
| no watermark | every demo test that shows a try-on |
| no watermark in the zoom view | the zoom view is watermarked too |
| pill for every shopper | own avatar sees no pill; PENDING / NOT_CREATED |
| pill popup won't close | a demo shopper sees the demo avatar (returns to the fitting room) |
| quick view keeps its title for a demo shopper | sign-up creates the account; own avatar arrives |
| no pill on mobile try-on | mobile |
| demo avatarKey blank | own avatar arrives |
| no `avatar_frames` clause in `userAvatarFromProfile` | PENDING / NOT_CREATED keep their own avatar |
| no `CREATED` clause | `vto-prefetch.spec.ts` "a new avatar while quick view stays open" |
| own frames shown for a demo shopper | a demo shopper sees the demo avatar |
| no gender prompt (quick view) | no gender chooses first; saving the gender fails |
| product data loads without a gender | no gender chooses first (no requests before choosing) |
| gender not patched locally | no gender chooses first |
| gender save failure silent | saving the gender fails |
| `putUser` without gender | sign-up creates the account |
| retry signs up to Firebase again | retries only the record |
| no email / password / gender check | sign-up creates the account; malformed email (email, password) |
| email in use offers no sign in | already has an account |
| intro video never plays | landing screen |
| no section selector on desktop | jump-to-section |
| product data kept on avatar change | own avatar arrives |
| VTO caches kept on avatar change | own avatar arrives |
| try-on error hidden | the backend refuses |

Not covered: the French copy, and the fitting room's own gender prompt
(the same component as quick view's, but its call site is untested).

## Landing intro video

The landing screen shows `intro-video-poster.jpg` with a play button the SDK
draws (`landing.tsx`); tapping it swaps in `intro-video.mp4` in the same
square box, so nothing moves. Both come from the assets bucket
(`config.asset.baseUrl`, `shop-sdk/assets/v5/`), not the bundle — the video is
1.6 MB. It plays `muted` (it has no sound track; muted is what lets autoplay
start everywhere) and `playsInline` (iPhones would otherwise go fullscreen).
The box is `min(100%, 30vh)` square: see "The host page is not the store"
for why the landing image is capped.

The poster is the video's first frame ("Step 1 — Download the app"), so
playback starts on exactly what was shown. Swapping it is an upload to the
same key, no code change. The old `intro-video-thumbnail.png` stays in the bucket for released
SDK versions.

## Fitting-room section selector

`SectionNav`, the dark jump-to-section pill, sits over the card rails on
**both** layouts (desktop since WEB-25). `useSectionNav` (in
`section-nav.tsx`) is the shared scroll-spy: attach `scrollerRef`/`onScroll`
to the scrolling column and `sectionRef(name)` to each rail's wrapper.
`SectionNav` no longer positions itself; `TopRightPills` floats it top-right
next to `MiniMePill` and lets the row wrap on a narrow screen (the second
pill drops below the first). It is held back while the rails load and hidden
with a single section.

## Get-app QR code

The get-app screen's QR code (`src/assets/get-app-qr-code.svg`, to
`https://www.thefittingroom.tech/download`) is **bundled**, not fetched from
the assets bucket like the store badges beside it. The bucket's
`get-app-qr-code.png` pointed at a short link on a paid QR service we no
longer use, so it no longer scans to anything useful; nothing reads it now.

It is generated, not drawn: `scripts/make-get-app-qr.py` (needs
`pip install segno==1.6.1`; usage in its docstring) renders the old image's
style — teal round modules, black square finders, the TFR door in the
centre — at error correction H so the logo doesn't break scanning. To change
the URL, regenerate rather than editing the SVG, and keep the dot radius at
0.5 of a module: smaller dots leave gaps jsQR fails to decode. Check the
result with a real phone camera before shipping it.

On a phone the screen shows App Store / Google Play badges instead, which
open `config.links` (`src/lib/config.ts`). The Play listing moved to package
`com.thefittingroom.app` (the old `com.thefittingroom.marketplace` is gone).

The same content appears in two places: the signed-out GET_APP overlay
(from the landing screen's "Create your Mini Me") and `GetAppPopup` (the
pill on the try-on overlays, see "Sign-up and the demo avatar").

`e2e/get-app.spec.ts` checks the screen shows the bundled image (a
`data:image/svg+xml` URI carrying the URL in its header comment), not the
bucket file, and that the phone badges open those two store URLs.

## Fitting-room icon widget — three responsibilities

`src/components/widgets/fitting-room-icon.tsx` is no longer just the
header icon. It also hosts two anchored popovers that need to live next
to the icon:

- **First-visit popup** — the `fitting_room_icon` help popup (see "Help
  popups" below), shown once per browser. Dismiss paths (icon click,
  popup close, click-outside, 4s timeout) all record it as seen. While
  showing, the icon button gets a soft green pulsing box-shadow.
- **Add-confirmation drawer** (`add-confirmation-drawer.tsx`) — fires
  whenever any item is added to the fitting room from any surface
  (catalog hanger, PDP, quick-view). Auto-dismisses after 4s; click-
  outside also dismisses. Items inside use a trash icon for remove
  (calls `removeFromFittingRoom`); CTA opens the overlay.

## Help popups

Nine one-time hints, each pointing at a control: the catalogue hanger and
the header icon (store widgets, in that order), the first product card, the mobile TRY IT
ON button, the avatar's rotate arrows (fitting room and quick view), the
mobile try-on view's sheet swipe-up handle, first expand chevron and back
button, and on desktop the detail pane's first *collapsed* row's chevron
(only shown when a row is collapsed, i.e. two or more items are selected).

- **One flag per popup, one record per browser.** `src/lib/help-tips.ts`
  keeps `tfr:help-tips:v1` = `{ "<HelpTipId>": true, ... }`. Per browser,
  not per shopper: the store-widget popups show to signed-out visitors too.
  The two store-widget popups used to keep their own flags
  (`tfr:first-visit-tooltip-seen:v1`, `tfr:first-add-tooltip-seen:v1`);
  those are still read, so a returning visitor isn't shown them again.
- **Only one is ever on screen.** Each mounted popup that could show asks
  `useHelpTip(id, enabled)`; the coordinator shows the highest-priority
  unseen one (order: `HELP_TIP_PRIORITY`) on the first instance that asked,
  and the next appears once it is dismissed. That is what turns them into a
  sequence — cards → try it on → arrows → swipe up → expand — instead of a
  pile that a single tap would clear. Each closes on its own after
  `HELP_TIP_AUTO_DISMISS_MS` (4s, shared by the overlay and store-widget
  popups), which is also the gap before the next one. Two rules keep the
  order honest:
  - a popup on screen is never swapped out by a higher-priority one that
    becomes eligible later (frames arriving, say);
  - requests arriving within `REQUEST_BATCH_MS` are decided together, so the
    store widgets — separate React roots that mount one after another — are
    ordered by priority rather than mount order.
- **`enabled` is the hint making sense now**, not just the anchor existing:
  the try-it-on popup waits for a selection (the button is disabled before),
  the fitting room's rotate popup waits for an outfit rather than the bare
  avatar (so the cards popup comes first), the expand popup only shows while
  its row is closed.
- **`HelpTip`** (`src/components/help-tooltip.tsx`) is the overlay wrapper:
  dismissed by its close button, by the shopper touching anything else
  (pointerdown, capture phase — usually the very control it points at, and
  the touch still reaches that control), or after 4s. The store widgets
  drive `HelpTooltip` through `useHelpTip` directly, because they fold its
  dismissal into their drawer handling.
- **`HelpTooltip` re-reads its anchor's position every animation frame**
  while up. Overlay anchors move without a resize or scroll event (the
  mobile sheet animates its height), and a popup is only up for seconds.

**Adding a popup:** add the id to `HelpTipId` and `HELP_TIP_PRIORITY`, the
id to `ALL_HELP_TIPS` in `tests/e2e/helpers/boot.ts`, and the text under
`help_tip` in both locales; then render `<HelpTip>` beside its anchor.

**e2e:** `bootSdk` marks every popup seen before boot unless
`helpTips: true`, because popups sit over controls other specs click.
`e2e/help-tips.spec.ts` opts in and covers the one-at-a-time sequence on
desktop and mobile, and the legacy flags. Mobile layout is chosen from the
user agent and touch support, not viewport width — that spec runs its mobile
case on the Pixel 5 device profile.

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

- [ ] **Every new or changed test has been seen to fail** — see "A test
      isn't done until it has failed" below. Say in the PR which mutant each
      test caught.
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
