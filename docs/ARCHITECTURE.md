# Architecture

## Build-time localization

The frontend transformer wraps only catalogued static interface literals with
i18next lookups. Unknown literals remain a coverage error. Runtime values are
never submitted to a translator or mutated in the browser.

Administration Blade templates are transformed against an exact source
inventory. Blade expressions, code fragments, and interpolated values are
masked while surrounding static prose is localized.

## Catalog model

English defines stable semantic keys. Standard German is the technical source
of truth for the German-derived locales. Swabian and Bavarian catalogs are
complete overlays generated from German plus reviewed regional labels and full
phrases. Broad word-by-word dialect conversion is prohibited.

## Locale persistence

The language menu submits to an authenticated Laravel route with CSRF
protection. The request validates an exact locale allowlist and stores the
selection in Pterodactyl's existing user language field.

## Safety model

- Every patched upstream file has a pinned pre-patch SHA-256.
- The applier refuses a tree containing `.env`.
- Unknown versions and source drift fail closed.
- No database migration is added.
- No production configuration belongs in this repository.
- Release artifacts are built from the checksum-pinned official source archive.
