# Releasing

1. Update `upstream.json` only after reviewing a new official Panel release.
2. Extract a clean official archive and run `npm run extract`.
3. Review every new or changed source candidate.
4. Update English and German catalogs and regenerate dialect catalogs.
5. Run `npm test` and `scripts/check-publication.sh`.
6. Build from the official archive with `scripts/build-release.sh`.
7. Visually review every locale declared in `locales.json` at desktop, mobile,
   200%, and 400% zoom.
8. Test `install.sh`, a fresh activation, a forced failed activation, and the
   automatic rollback on a disposable Panel instance.
9. Publish the archive, SHA-256 file, changelog, and supported upstream version.

Never build a public release from a production Panel tree.
