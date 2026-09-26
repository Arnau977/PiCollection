#!/usr/bin/env bash
# One-call verification for PiCollection: typecheck, lint of changed files,
# tests, and the Electron rebuild - printing only what needs attention.
#
#   bash .claude/skills/verify/verify.sh            # full suite
#   bash .claude/skills/verify/verify.sh --changed  # only tests affected by changes vs master
#   bash .claude/skills/verify/verify.sh --no-tests # typecheck + lint only
set -u
cd "$(git rev-parse --show-toplevel)" || exit 2
mode="${1:-full}"
status=0

echo "== typecheck"
if out=$(npm run typecheck 2>&1); then echo "ok"; else echo "$out" | grep -E "error TS" | head -30; status=1; fi

echo "== lint (changed .ts/.tsx vs master, CRLF noise filtered)"
files=$( { git diff --name-only master...HEAD; git diff --name-only; git ls-files --others --exclude-standard; } \
  | sort -u | grep -E '\.(ts|tsx)$' | while read -r f; do [ -f "$f" ] && echo "$f"; done)
if [ -z "$files" ]; then
  echo "no changed .ts/.tsx files"
else
  # "Delete `␍`" is this checkout's autocrlf artifact, not a real issue.
  lint=$(npx eslint --no-fix $files 2>/dev/null | grep -vE "Delete .␍.|^\s*$|problems|potentially fixable|LF will be replaced")
  errors=$(echo "$lint" | grep -cE "^\s+[0-9]+:[0-9]+\s+error" || true)
  if [ -n "$(echo "$lint" | grep -E '^\s+[0-9]+:[0-9]+')" ]; then
    echo "$lint" | grep -E "^[A-Z]:|^/|^\s+[0-9]+:[0-9]+" | head -40
    echo "(warnings on lines you didn't touch are pre-existing; fix only yours)"
  else
    echo "ok"
  fi
  [ "$errors" -gt 0 ] && status=1
fi

if [ "$mode" != "--no-tests" ]; then
  echo "== tests"
  npm rebuild better-sqlite3 >/dev/null 2>&1
  if [ "$mode" = "--changed" ]; then
    out=$(npx vitest run --changed master 2>&1)
  else
    out=$(npx vitest run 2>&1)
  fi
  echo "$out" | grep -E "Test Files|Tests  " | sed 's/\x1b\[[0-9;]*m//g'
  failed=$(echo "$out" | sed 's/\x1b\[[0-9;]*m//g' | grep -E "^\s*FAIL " | sort -u)
  if [ -n "$failed" ]; then
    known=$(echo "$failed" | grep -c "extensionBridge.server.test.ts" || true)
    other=$(echo "$failed" | grep -v "extensionBridge.server.test.ts" || true)
    if [ "$known" -gt 0 ] && echo "$out" | grep -q "EADDRINUSE"; then
      if tasklist 2>/dev/null | grep -qi "PiCollection.exe"; then
        echo "known: $known extensionBridge.server failure(s) - port 8934 held by the running PiCollection app (not a regression)"
      else
        echo "extensionBridge.server failed with EADDRINUSE but PiCollection isn't running - something else holds port 8934"; status=1
      fi
    elif [ "$known" -gt 0 ]; then
      other="$failed"
    fi
    if [ -n "$other" ]; then echo "$other"; status=1; fi
  fi
fi

echo "== rebuild better-sqlite3 for Electron"
if npm run rebuild >/dev/null 2>&1; then echo "ok - safe to run the app"; else echo "rebuild FAILED - the app will crash with NODE_MODULE_VERSION"; status=1; fi

exit $status
