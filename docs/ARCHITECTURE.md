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

`locales.json` is the single locale manifest. It defines the code, English and
native names, selector badge, namespace inheritance, and i18next fallbacks.
The applier renders the TypeScript union, Laravel allowlist, language helper,
and selector menu from this manifest. Adding a language therefore does not
require editing security-sensitive routing or validation code.

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

## Deployment model

`install.sh` performs the source build in an isolated tree and delegates
activation to `install-release.sh`. The builder records hashes for every
non-runtime upstream file; activation refuses modified, missing, additional, or
stale source files before maintenance mode. It preserves `.env`, `storage`,
`vendor`, cache ownership, and favicons and never runs migrations. The complete
old tree is renamed within the same filesystem before the staged tree is moved
into place. Any post-activation failure invokes the reciprocal rename and
health-checks the restored Panel.
