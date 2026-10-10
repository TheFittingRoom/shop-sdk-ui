#!/bin/sh
# Promote a published version from npm dist-tag `next` to `latest`.
#
# .github/workflows/release.yaml publishes every release under dist-tag
# `next`. When you decide a `next` version is ready to be the default
# install for end users, run this to move the `latest` dist-tag onto it.
# Pointing it back at an older version is the rollback path for `latest`
# consumers; no new artifact is published either way.
#
# Usage:
#   npm run promote-latest             # promotes the version in package.json
#   npm run promote-latest -- 5.0.13   # promotes a specific version
#
# Requires the runner to be logged in to npm with publish rights to
# @thefittingroom/shop-ui:
#   npm whoami
#   npm login   # if you aren't

set -e

PKG=$(node -p "require('./package.json').name")
VER="${1:-$(node -p "require('./package.json').version")}"

echo "Promoting $PKG@$VER to dist-tag 'latest'..."
npm dist-tag add "$PKG@$VER" latest
echo
echo "Done. Current dist-tags:"
npm dist-tag ls "$PKG"
