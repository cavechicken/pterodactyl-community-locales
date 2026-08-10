# Security policy

## Supported version

Only the release pinned in `upstream.json` is supported. The applier rejects
other Panel versions or modified patch points.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for security issues. Do not
open a public issue containing credentials, private URLs, server names, logs,
screenshots, or exploit details that could endanger a running Panel.

Include the localization release, upstream Panel version, affected component,
and a minimal sanitized reproduction. Translation quality problems that do not
have a security impact may be reported as ordinary issues.

## Security boundaries

- No runtime translation service or external asset host is used.
- React and Laravel escaping remain enabled.
- Locale changes require an authenticated session and valid CSRF token.
- Only `en`, `de`, `swg`, and `bar` are accepted.
- The source applier refuses a tree containing `.env`.
- Dynamic user, server, Egg, filesystem, command, and API content is not
  translated.
