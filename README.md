# Pterodactyl Community Locales

An independent, source-level localization patch for
[Pterodactyl Panel](https://github.com/pterodactyl/panel). It adds four account
locales to the Panel:

- English (`en`)
- Standard German (`de`)
- Swabian (`swg`)
- Bavarian (`bar`)

The patch is pinned to **Pterodactyl Panel 1.15.0**. It deliberately refuses
unknown upstream source hashes and refuses to patch any tree containing a live
`.env` file. A transactional installer builds away from production, retains the
complete previous Panel, and restores it if activation or health checks fail.

This is an independent community project, not an official Pterodactyl release.

## What it changes

- React literals are localized at build time through the existing i18next
  instance.
- Laravel and administration views use Laravel language catalogs.
- A keyboard-accessible flag menu stores the selected locale immediately using
  the authenticated session and Laravel CSRF protection.
- Frontend and administration catalogs cover the pinned source inventory.
- Swabian and Bavarian use reviewed regional labels and phrases while retaining
  clear Standard German for longer technical explanations.

It does **not** translate server names, filenames, console output, commands,
Egg metadata, mount paths, environment variables, API data, or other runtime
content.

## Current release

Release `complete-r4-20260810` contains:

- 524 frontend catalog entries per locale
- 652 administration catalog entries per locale
- 1,123 source-level administration replacements
- first-render localization without DOM mutation or remote translation services

The reviewed tree passes catalog coverage, project tests, TypeScript, ESLint,
the 46 upstream Jest tests, PHP syntax checks, and a production Webpack build.

## Install on an existing Panel

Read and inspect the repository before giving it root privileges. On a clean,
unmodified Panel 1.15.0 installation using the standard `pteroq.service` and a
detectable PHP-FPM service:

```bash
git clone --branch v0.1.0 --depth 1 \
  https://github.com/cavechicken/pterodactyl-community-locales.git &&
cd pterodactyl-community-locales &&
sudo ./scripts/install.sh --panel /var/www/pterodactyl
```

Replace `/var/www/pterodactyl` with the actual absolute path of the existing
Panel. The installer validates that target before downloading or building
anything. Do not run it against an already-localized tree; upgrades require a
version-specific release or a reviewed clean reinstall.

The command downloads the exact official source, verifies its SHA-256, builds
and tests the localized release in an isolated directory, briefly enables
maintenance mode, and atomically activates it. It does not run database
migrations. The previous complete Panel tree remains beside the installation
until the operator removes it.

Custom Panel code or Composer dependencies are rejected rather than silently
overwritten. See [Installation](docs/INSTALL.md) for service overrides,
prebuilt releases, backups, rollback behavior, and acceptance testing.

## Build a patched release

Requirements:

- Linux
- Node.js 22 or newer
- npm
- Corepack/Yarn 1 support
- `tar`, `zstd`, and `sha256sum`

Download the official `panel.tar.gz` asset from the
[Pterodactyl v1.15.0 release](https://github.com/pterodactyl/panel/releases/tag/v1.15.0),
then run:

```bash
npm ci
./scripts/build-release.sh /path/to/panel.tar.gz dist/panel-1.15.0-localized.tar.zst
```

The builder verifies the upstream SHA-256 before extraction, works in a
temporary directory, applies the patch, runs all localization and upstream
frontend gates, and creates a checksum beside the resulting archive.

Never point `tools/apply.mjs` at a live Panel. See [Installation](docs/INSTALL.md)
for the supported staging workflow and rollback expectations.

## Development

```bash
npm ci
npm run build:dialects
npm run extract -- /path/to/clean-panel-1.15.0
npm run verify -- /path/to/clean-panel-1.15.0
npm test
```

See [Contributing](CONTRIBUTING.md), the
[translation style guide](TRANSLATION_STYLE.md), and
[architecture notes](docs/ARCHITECTURE.md) before changing catalogs or source
transformers.

New languages are declared in `locales.json`, not hard-coded throughout the
Panel patch. `npm run locale:add` creates a deliberately failing translation
worklist so incomplete machine-generated text cannot be released.

## Security and privacy

The project performs no runtime translation, analytics, remote asset loading,
or DOM rewriting. Translation values remain escaped by React and Laravel. The
language mutation endpoint is authenticated, CSRF-protected, and restricted to
an exact locale allowlist.

Do not publish production screenshots, logs, hostnames, IP addresses, paths,
credentials, or runtime configuration in issues or pull requests. See
[SECURITY.md](SECURITY.md) for vulnerability reporting.

## License and trademarks

This patch is MIT-licensed. Pterodactyl Panel is also distributed under the MIT
License. Pterodactyl and its marks belong to their respective owners. See
[third-party notices](THIRD_PARTY_NOTICES.md).
