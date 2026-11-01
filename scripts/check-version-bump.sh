#!/bin/sh
# Fails unless the commit at HEAD changes nothing but the package version:
# the "version" fields of package.json and package-lock.json, which is all
# `npm version` writes. release.yaml runs this on the bump commit in place
# of a second full verification: the code is then exactly what was just
# verified on main, so re-running the tests on it proves nothing new.
#
#   scripts/check-version-bump.sh            # checks HEAD against HEAD~1
set -eu

files=$(git diff --name-only HEAD~1 HEAD | sort | tr '\n' ' ')
if [ "$files" != "package-lock.json package.json " ]; then
  echo "check-version-bump: expected only package.json and package-lock.json to change, got: $files" >&2
  exit 1
fi

# Every changed line, either side, must be a "version" line.
other=$(git diff -U0 HEAD~1 HEAD -- package.json package-lock.json |
  grep -E '^[-+]' | grep -vE '^(\+\+\+|---) ' | grep -vE '^[-+][[:space:]]*"version": "[^"]*",?$' || true)
if [ -n "$other" ]; then
  echo "check-version-bump: the bump commit changes more than the version:" >&2
  echo "$other" >&2
  exit 1
fi

echo "check-version-bump: only the version changed"
