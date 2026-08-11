#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

readonly PREFIX='[pterodactyl-locales]'
readonly ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"

PANEL=''
SOURCE_ARCHIVE=''
RELEASE_ARCHIVE=''
HEALTH_URL=''
QUEUE_SERVICE='auto'
PHP_SERVICE='auto'
ASSUME_YES=0

fail() { printf '%s ERROR: %s\n' "$PREFIX" "$*" >&2; exit 1; }
usage() {
    cat <<'EOF'
Usage:
  sudo ./scripts/install.sh --panel /var/www/pterodactyl [options]

Options:
  --source-archive FILE  Use an existing official panel.tar.gz instead of downloading it
  --release-archive FILE Install an already-built localized .tar.zst and its .sha256
  --health-url URL       Override the Panel APP_URL used for HTTP checks
  --queue-service NAME   Override pteroq.service detection
  --php-service NAME     Override PHP-FPM detection; use none for mod_php
  --yes                  Skip the deployment confirmation
  --help                 Show this help

Without an archive option, the exact official source is downloaded, verified,
localized, fully tested, and then transactionally deployed.
EOF
}

while (($# > 0)); do
    case "$1" in
        --panel) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; PANEL=$2; shift 2 ;;
        --source-archive) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; SOURCE_ARCHIVE=$2; shift 2 ;;
        --release-archive) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; RELEASE_ARCHIVE=$2; shift 2 ;;
        --health-url) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; HEALTH_URL=$2; shift 2 ;;
        --queue-service) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; QUEUE_SERVICE=$2; shift 2 ;;
        --php-service) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; PHP_SERVICE=$2; shift 2 ;;
        --yes) ASSUME_YES=1; shift ;;
        --help) usage; exit 0 ;;
        *) usage >&2; fail "unknown option: $1" ;;
    esac
done

[[ ${EUID:-$(id -u)} -eq 0 ]] || fail 'run this installer with sudo or as root'
[[ -n "$PANEL" ]] || { usage >&2; exit 2; }
[[ -z "$SOURCE_ARCHIVE" || -z "$RELEASE_ARCHIVE" ]] || fail 'choose either --source-archive or --release-archive'

for command in chmod curl mktemp node realpath rm; do
    command -v "$command" >/dev/null || fail "required command is absent: $command"
done

# Reject an invalid target before downloading dependencies or building a release.
[[ -d "$PANEL" ]] || fail "Panel directory does not exist: $PANEL"
[[ ! -L "$PANEL" ]] || fail 'Panel path must not be a symbolic link'
PANEL=$(realpath -e -- "$PANEL") || fail "could not resolve Panel directory: $PANEL"
[[ -f "$PANEL/artisan" && -f "$PANEL/.env" ]] || fail 'Panel artisan or .env is absent'
[[ -d "$PANEL/storage" && -f "$PANEL/vendor/autoload.php" ]] \
    || fail 'Panel storage or Composer vendor tree is absent'

work_dir=''
cleanup() { if [[ -n "$work_dir" && -d "$work_dir" ]]; then rm -rf -- "$work_dir"; fi; }
trap cleanup EXIT INT TERM

if [[ -n "$RELEASE_ARCHIVE" ]]; then
    release_archive=$(realpath -e -- "$RELEASE_ARCHIVE")
else
    work_dir=$(mktemp -d /tmp/pterodactyl-locales-install.XXXXXX)
    chmod 0700 "$work_dir"
    if [[ -n "$SOURCE_ARCHIVE" ]]; then
        source_archive=$(realpath -e -- "$SOURCE_ARCHIVE")
    else
        source_archive="$work_dir/panel.tar.gz"
        archive_url=$(node -p "require('$ROOT/upstream.json').archiveUrl")
        printf '%s Downloading the checksum-pinned official Panel source.\n' "$PREFIX"
        curl --fail --location --proto '=https' --tlsv1.2 \
            --connect-timeout 20 --max-time 300 \
            --output "$source_archive" "$archive_url"
        chmod 0600 "$source_archive"
    fi
    release_archive="$work_dir/panel-localized.tar.zst"
    "$ROOT/scripts/build-release.sh" "$source_archive" "$release_archive"
    chmod 0600 "$release_archive" "$release_archive.sha256"
fi

arguments=(
    --panel "$PANEL"
    --archive "$release_archive"
    --queue-service "$QUEUE_SERVICE"
    --php-service "$PHP_SERVICE"
)
[[ -z "$HEALTH_URL" ]] || arguments+=(--health-url "$HEALTH_URL")
((ASSUME_YES == 0)) || arguments+=(--yes)

"$ROOT/scripts/install-release.sh" "${arguments[@]}"
