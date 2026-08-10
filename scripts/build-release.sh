#!/usr/bin/env bash
set -Eeuo pipefail
umask 022

readonly PREFIX='[pterodactyl-locales]'
readonly ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"

log() { printf '%s %s\n' "$PREFIX" "$*"; }
fail() { printf '%s ERROR: %s\n' "$PREFIX" "$*" >&2; exit 1; }

[[ $# -eq 2 ]] || fail 'usage: scripts/build-release.sh /path/to/panel.tar.gz /path/to/output.tar.zst'

readonly SOURCE_ARCHIVE="$(realpath -e -- "$1")"
readonly OUTPUT_ARCHIVE="$(realpath -m -- "$2")"
readonly OUTPUT_CHECKSUM="$OUTPUT_ARCHIVE.sha256"
readonly OUTPUT_PARENT="$(dirname -- "$OUTPUT_ARCHIVE")"

for command in corepack find grep install mktemp mv node npm realpath rm sha256sum tar; do
    command -v "$command" >/dev/null || fail "required command is absent: $command"
done
[[ ! -e "$OUTPUT_ARCHIVE" && ! -e "$OUTPUT_CHECKSUM" ]] \
    || fail 'output archive or checksum already exists'
[[ -d "$OUTPUT_PARENT" ]] || install -d -m 0755 "$OUTPUT_PARENT"

readonly EXPECTED_SHA="$(node -p "require('$ROOT/upstream.json').sha256")"
printf '%s  %s\n' "$EXPECTED_SHA" "$SOURCE_ARCHIVE" | sha256sum --check --strict

readonly WORK_DIR="$(mktemp -d "$OUTPUT_PARENT/.pterodactyl-locales-build.XXXXXX")"
readonly PANEL_DIR="$WORK_DIR/panel"
cleanup() { rm -rf -- "$WORK_DIR"; }
trap cleanup EXIT

install -d -m 0755 "$PANEL_DIR"
tar -xzf "$SOURCE_ARCHIVE" -C "$PANEL_DIR"
[[ ! -e "$PANEL_DIR/.env" ]] || fail 'official source unexpectedly contains .env'

log 'Installing localization development dependencies.'
npm --prefix "$ROOT" ci
npm --prefix "$ROOT" run build:dialects
npm --prefix "$ROOT" run verify -- "$PANEL_DIR"
npm --prefix "$ROOT" test
"$ROOT/scripts/check-publication.sh"

log 'Applying the localization to the protected source tree.'
node "$ROOT/tools/apply.mjs" "$PANEL_DIR"

log 'Installing pinned Panel frontend dependencies.'
corepack yarn --cwd "$PANEL_DIR" install --frozen-lockfile
corepack yarn --cwd "$PANEL_DIR" tsc
corepack yarn --cwd "$PANEL_DIR" lint
corepack yarn --cwd "$PANEL_DIR" test --runInBand
corepack yarn --cwd "$PANEL_DIR" build:production

grep -RqlF 'frontend:ui_search_49c266baaa' "$PANEL_DIR"/public/assets/*.js \
    || fail 'compiled frontend is missing localized search UI'
grep -RqlF 'frontend:ui_memory_c3963aedaa' "$PANEL_DIR"/public/assets/*.js \
    || fail 'compiled frontend is missing localized resource labels'

rm -rf -- "$PANEL_DIR/node_modules"
tar --zstd -cf "$WORK_DIR/release.tar.zst" -C "$PANEL_DIR" .
tar --zstd -tf "$WORK_DIR/release.tar.zst" >/dev/null
mv -- "$WORK_DIR/release.tar.zst" "$OUTPUT_ARCHIVE"
(
    cd -- "$OUTPUT_PARENT"
    sha256sum "$(basename -- "$OUTPUT_ARCHIVE")" >"$(basename -- "$OUTPUT_CHECKSUM")"
)

log "Release archive: $OUTPUT_ARCHIVE"
log "Checksum: $OUTPUT_CHECKSUM"
