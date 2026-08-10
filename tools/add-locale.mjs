#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { packRoot } from './lib.mjs';
import { readLocaleManifest, resolveLocaleCatalogs } from './locales.mjs';

function fail(message) {
    console.error(`ERROR: ${message}`);
    process.exit(2);
}

const options = {};
for (let index = 2; index < process.argv.length; index += 2) {
    const name = process.argv[index];
    const value = process.argv[index + 1];
    if (!name?.startsWith('--') || value === undefined) fail('options must be provided as --name value pairs');
    options[name.slice(2)] = value;
}

for (const required of ['code', 'english-name', 'native-name', 'badge', 'base']) {
    if (!options[required]) {
        fail('usage: npm run locale:add -- --code fr --english-name French --native-name Français --badge FR --base en');
    }
}

const code = options.code.toLowerCase();
const badge = options.badge.toUpperCase();
if (!/^[a-z]{2,3}$/.test(code)) fail('locale code must be a two- or three-letter lowercase ISO 639 code');
if (!/^[A-Z0-9]{2,3}$/.test(badge)) fail('badge must contain two or three uppercase letters or digits');

const manifest = readLocaleManifest();
if (manifest.locales.some((locale) => locale.code === code)) fail(`locale already exists: ${code}`);
if (!manifest.locales.some((locale) => locale.code === options.base)) fail(`base locale does not exist: ${options.base}`);

const catalogs = resolveLocaleCatalogs(manifest);
const descriptionKey = `languageDescription${options['english-name'].replace(/[^A-Za-z0-9]/g, '')}`;
if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(descriptionKey)) fail('english name cannot produce a safe description key');
if (manifest.locales.some((locale) => locale.descriptionKey === descriptionKey)) {
    fail(`language description key already exists: ${descriptionKey}`);
}

const writeJson = (filename, value) => {
    fs.writeFileSync(path.join(packRoot, filename), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o644 });
};
const todo = (value) => `[TODO ${code}] ${value}`;

for (const filename of fs.readdirSync(path.join(packRoot, 'catalog'))) {
    if (!/^frontend\.(?:[a-z]{2,3})(?:\.overrides)?\.json$/.test(filename)) continue;
    const relative = `catalog/${filename}`;
    const catalog = JSON.parse(fs.readFileSync(path.join(packRoot, relative), 'utf8'));
    catalog[descriptionKey] = todo(`${options['native-name']} interface`);
    writeJson(relative, catalog);
}

for (const surface of ['frontend', 'admin']) {
    const source = catalogs[options.base][surface];
    const localized = Object.fromEntries(Object.entries(source).map(([key, value]) => [key, todo(value)]));
    if (surface === 'frontend') localized[descriptionKey] = todo(`${options['native-name']} interface`);
    writeJson(`catalog/${surface}.${code}.json`, localized);
}

manifest.locales.push({
    code,
    englishName: options['english-name'],
    nativeName: options['native-name'],
    badge,
    descriptionKey,
    baseLocale: options.base,
    fallbacks: [options.base, ...(options.base === manifest.defaultLocale ? [] : [manifest.defaultLocale])],
});
writeJson('locales.json', manifest);

console.log(`Scaffolded ${code} (${options['native-name']}).`);
console.log(`Translate every [TODO ${code}] entry before committing; verification rejects unfinished placeholders.`);
console.log(`Optionally add .ptero-i18n-language-flag--${code} to the selector stylesheet.`);
