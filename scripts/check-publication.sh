#!/usr/bin/env bash
set -Eeuo pipefail

readonly ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
readonly PRIVATE_PATTERN='cavetown[.]de|extgate|/opt/services|159[.]195[.]|172[.]27[.]|46[.]142[.]'

if grep -RInEi \
    --exclude-dir=.git \
    --exclude-dir=.generated \
    --exclude-dir=node_modules \
    --exclude='check-publication.sh' \
    "$PRIVATE_PATTERN" "$ROOT"; then
    printf 'ERROR: deployment-specific identifier found in publication tree\n' >&2
    exit 1
fi

if grep -RIlE \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude='check-publication.sh' \
    -- '-----BEGIN ([A-Z0-9 ]+ )?PRIVATE KEY-----' "$ROOT" | grep -q .; then
    printf 'ERROR: private-key material found in publication tree\n' >&2
    exit 1
fi

if find "$ROOT" -type f \
    \( -name '.env' -o -name '*.pem' -o -name '*.key' -o -name '*.p12' -o -name '*.pfx' \) \
    -not -path '*/node_modules/*' -print -quit | grep -q .; then
    printf 'ERROR: secret-bearing filename found in publication tree\n' >&2
    exit 1
fi

node --test "$ROOT"/test/*.test.mjs
printf 'Publication boundary checks passed.\n'
