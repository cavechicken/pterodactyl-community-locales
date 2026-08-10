# Installation

This project intentionally does not provide a universal root installer. Panel
service names, PHP versions, web-server layouts, permissions, and deployment
procedures differ between installations. A generic script that guesses those
details would be unsafe.

## Before installing

1. Confirm the live Panel is exactly version 1.15.0.
2. Back up the Panel database.
3. Back up the complete Panel filesystem, including `.env`, storage, and custom
   assets.
4. Confirm the restore procedure before entering maintenance mode.
5. Build the localized archive from the official source with
   `scripts/build-release.sh`, or obtain a release artifact and verify its
   published SHA-256.

## Deployment model

Treat the localized archive as a rebuilt Pterodactyl Panel release. Follow the
official Pterodactyl manual-update procedure for the pinned Panel release, but
use the verified localized archive instead of the unmodified upstream archive.

Preserve the live `.env`, storage directory, uploads, permissions, Composer
dependencies, scheduler, queue worker, and web-server configuration. Never run
`tools/apply.mjs` against the live Panel: it is a development tool for a clean
staging tree and refuses a directory containing `.env`.

At minimum, acceptance must verify:

- login and account settings;
- all four locale selections and persistence after sign-out/sign-in;
- client server controls and console connectivity;
- administration navigation and forms;
- queue worker health;
- Wings API connectivity;
- one representative server operation;
- cache clearing and a hard browser refresh.

## Rollback

If any acceptance check fails, restore the complete pre-installation Panel tree
and database backup as a matched pair, clear Laravel caches, restore ownership,
and restart the queue worker and PHP service. Do not attempt a partial rollback
of only compiled JavaScript assets.

The official Panel release is documented at
<https://github.com/pterodactyl/panel/releases/tag/v1.15.0>.
