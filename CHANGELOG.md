# Changelog

## v0.1.0 - 2026-08-11

- Added checksum-pinned one-command build and transactional installation.
- Added complete-tree rollback, service discovery, health gates, and
  customization refusal.
- Added a release-bound upstream file manifest so modified, missing, stale, or
  additional Panel source files are rejected before maintenance mode.
- Added a manifest-driven locale model and a failing-by-default new-language
  scaffold for community translations.
- Added an early target preflight so invalid Panel paths fail before downloads
  or release builds begin.

## complete-r4-20260810

- Added complete English, Standard German, Swabian, and Bavarian catalogs for
  Pterodactyl Panel 1.15.0.
- Added source-level React/i18next and Laravel/Blade localization.
- Added an authenticated, CSRF-protected language menu with locale descriptions.
- Added first-render frontend catalog bootstrap.
- Added subuser permission localization.
- Added full source coverage, dialect quality, and machine-translation gates.
- Corrected technical terminology and protected runtime data from translation.
