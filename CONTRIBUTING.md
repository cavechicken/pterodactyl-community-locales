# Contributing

## Translation workflow

1. Start from the exact supported upstream release.
2. Run `npm run extract -- /path/to/panel`.
3. Add stable English and German catalog entries. Do not change dynamic values
   merely to make a coverage warning disappear.
4. For mixed JSX or Blade content, write a source patch with named
   interpolation placeholders; never translate sentence fragments blindly.
5. Run `npm run verify`, `npm test`, the Panel TypeScript/lint/test suites, and
   a production build.
6. Review every affected screen in English and German at desktop and mobile
   widths before submitting the change.

Catalog keys describe meaning, not visual location. Prefer `deleteDatabase`
over `redModalButtonText`. Reuse a key only when source text and meaning are the
same.

## Adding another language

Start a locale worklist with, for example:

```bash
npm run locale:add -- \
  --code fr \
  --english-name French \
  --native-name Français \
  --badge FR \
  --base en
```

This updates `locales.json` and creates complete frontend and administration
catalogs. Every generated value starts with `[TODO fr]`; verification fails
until every marker has been replaced by a human-reviewed translation. Translate
the new language description key in every existing frontend catalog as well.

Use a two- or three-letter ISO 639 code that fits Pterodactyl's existing user
language field. Keep operational values, placeholders such as `{{value0}}`,
commands, paths, and runtime data unchanged. A flag-specific CSS treatment is
optional: the language badge remains usable without one.

Before opening a pull request, run the full source build and visually check the
client, administration area, dialogs, submenus, mobile view, keyboard flow, and
fallback behavior with a fresh account.

## Security and privacy

- Never add production URLs, hostnames, IP addresses, credentials, API data,
  screenshots, logs, filenames, server names, or topology to fixtures.
- Never introduce raw HTML translations, remote translation APIs, external
  fonts, analytics, or client-side DOM mutation.
- Preserve placeholders exactly and keep React/Laravel escaping enabled.
- Do not translate commands, configuration keys, environment variables, paths,
  or user-provided content.
