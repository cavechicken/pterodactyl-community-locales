# Installation

The deployment assistant supports clean, unmodified Pterodactyl Panel 1.15.0
installations. It deliberately fails when service discovery, dependency
identity, health checks, ownership, or version checks are ambiguous.

## Before installing

1. Confirm the live Panel is exactly version 1.15.0.
2. Back up the Panel database independently and test its restore procedure.
3. Back up the complete Panel filesystem, including `.env`, storage, and custom
   assets.
4. Confirm the Panel is healthy before starting.
5. Confirm the queue and PHP-FPM systemd unit names, and that `APP_URL` is
   reachable from the Panel host.

The build host needs Node.js 22 or newer, npm, Corepack/Yarn 1 support, PHP CLI,
`tar`, `zstd`, `curl`, and standard GNU/Linux administration tools. The
transactional service integration currently targets systemd installations.

## One-command build and installation

After inspecting the cloned repository:

```bash
sudo ./scripts/install.sh --panel /var/www/pterodactyl
```

The path is an example. Replace it with the actual absolute path of the
existing Panel. The wrapper verifies the directory, `artisan`, `.env`, runtime
storage, and Composer vendor tree before it downloads or builds anything.

The installer downloads only the exact URL in `upstream.json`; the builder
then verifies the pinned SHA-256. Building runs in a protected temporary tree,
not inside the live Panel.

If service discovery is ambiguous, specify it explicitly:

```bash
sudo ./scripts/install.sh \
  --panel /var/www/pterodactyl \
  --queue-service pteroq.service \
  --php-service php8.3-fpm.service \
  --health-url https://panel.example.com
```

Apache `mod_php` installations can pass `--php-service none`. A non-systemd
queue manager must be stopped and supervised manually; passing
`--queue-service none` accepts that responsibility and is not the recommended
path.

To avoid rebuilding, download a published `.tar.zst` and its adjacent
`.sha256`, then use `--release-archive`. To build from an already downloaded
official source, use `--source-archive panel.tar.gz`.

## Deployment model

The installer treats the localized archive as a rebuilt Pterodactyl release.
It verifies every non-runtime file in the live Panel against a source manifest
generated from the checksum-pinned upstream release. It also verifies that the
live and staged `composer.lock` files are identical, copies runtime state into
staging, validates PHP and the language route, and
only then enters maintenance mode.

It preserves `.env`, `storage`, `vendor`, cache ownership, and
`public/favicons`. It clears Laravel views, configuration, and routes, restarts
the queue and selected PHP service, and checks the configured health URL. It
does not touch Wings or running game containers and does not run database
migrations.

This strict check intentionally refuses existing source customizations and an
already-patched localization tree. Such installations need a reviewed manual
merge or a future version-specific upgrade path; `--yes` does not bypass the
source check.

Never run `tools/apply.mjs` against the live Panel: it is a development tool for
a clean staging tree and refuses a directory containing `.env`.

## Acceptance

At minimum, verify:

- login and account settings;
- all declared locale selections and persistence after sign-out/sign-in;
- client server controls and console connectivity;
- administration navigation, submenus, dialogs, and forms;
- queue worker health;
- Wings API connectivity;
- one representative server operation;
- cache clearing and a hard browser refresh.

## Rollback

If an activation check fails, the installer automatically restores the complete
previous tree, clears caches, restarts the selected services, and verifies the
old Panel's health. On success it prints the protected rollback directory and
does not delete it. Keep it until authenticated browser, administration, queue,
Wings, and representative server tests have passed.

No migration is performed, so the installer does not automatically restore a
database. Retaining an independently tested database backup remains mandatory
operational practice. Do not attempt a partial rollback of only JavaScript
assets.

The official Panel update procedure is documented at
<https://pterodactyl.io/panel/1.0/updating.html>.
