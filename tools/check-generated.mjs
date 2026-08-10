#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readLocaleManifest } from './locales.mjs';

function fail(message) {
    console.error(`ERROR: ${message}`);
    process.exit(1);
}

const panelRoot = path.resolve(process.argv[2] || '');
if (!panelRoot || !fs.existsSync(path.join(panelRoot, 'artisan'))) {
    fail('usage: node tools/check-generated.mjs /path/to/patched-panel');
}

const manifest = readLocaleManifest();
const codes = manifest.locales.map((locale) => locale.code);
const phpCodes = codes.map((code) => `'${code}'`).join(', ');
const tsCodes = codes.map((code) => `'${code}'`).join(' | ');
const read = (relative) => fs.readFileSync(path.join(panelRoot, relative), 'utf8');

if (!read('app/Http/Requests/Base/LocaleRequest.php').includes(`Rule::in([${phpCodes}])`)) {
    fail('generated Laravel locale allowlist does not match locales.json');
}
if (!read('resources/scripts/i18n.ts').includes(`type SupportedLocale = ${tsCodes};`)) {
    fail('generated TypeScript locale union does not match locales.json');
}

const releasePath = path.join(panelRoot, '.pterodactyl-locales/release.json');
if (!fs.existsSync(releasePath)) fail('generated release metadata is absent');
const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
if (JSON.stringify(release.locales) !== JSON.stringify(codes)) {
    fail('generated release metadata locales do not match locales.json');
}
if (fs.existsSync(path.join(panelRoot, '.pterodactyl-german'))) {
    fail('obsolete localization metadata directory is present');
}

for (const code of codes) {
    for (const catalog of ['frontend.php', 'admin.php']) {
        if (!fs.existsSync(path.join(panelRoot, 'resources/lang', code, catalog))) {
            fail(`generated catalog is absent: resources/lang/${code}/${catalog}`);
        }
    }
}

console.log(`Generated locale boundaries match locales.json: ${codes.join(', ')}.`);
