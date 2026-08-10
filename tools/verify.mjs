#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { extractAdmin, extractFrontend, readJson } from './lib.mjs';
import { readLocaleManifest, resolveLocaleCatalogs } from './locales.mjs';

const panelRoot = path.resolve(process.argv[2] || '');
if (!panelRoot || !fs.existsSync(path.join(panelRoot, 'artisan'))) {
    console.error('Usage: node tools/verify.mjs /path/to/pterodactyl-panel');
    process.exit(2);
}

const upstream = readJson('upstream.json');
const appConfig = fs.readFileSync(path.join(panelRoot, 'config/app.php'), 'utf8');
if (!appConfig.includes(`'version' => '${upstream.version}'`)) {
    throw new Error(`Unsupported Panel source: expected ${upstream.version}`);
}

const manifest = readLocaleManifest();
const catalogs = resolveLocaleCatalogs(manifest);
const sourceCatalogs = catalogs[manifest.defaultLocale];
const ignored = readJson('catalog/ignored.json');

function placeholders(value) {
    return [...value.matchAll(/\{\{value\d+\}\}/g)].map((match) => match[0]).sort();
}

function verifyPlaceholders(name, english, localized) {
    for (const key of Object.keys(english)) {
        if (JSON.stringify(placeholders(english[key])) !== JSON.stringify(placeholders(localized[key]))) {
            throw new Error(`${name} changes interpolation placeholders for ${key}`);
        }
    }
}

function verifyCoverage(name, candidates, catalog, ignoredTexts) {
    const translatedSources = new Set(Object.values(catalog));
    const allowed = new Set(ignoredTexts || []);
    const missing = [...candidates.keys()].filter((text) => !translatedSources.has(text) && !allowed.has(text)).sort();
    if (missing.length > 0) {
        console.error(`${name} contains ${missing.length} uncatalogued candidate strings:`);
        for (const text of missing.slice(0, 80)) {
            const first = candidates.get(text)[0];
            console.error(`  ${first.file}:${first.line}: ${JSON.stringify(text)}`);
        }
        if (missing.length > 80) console.error(`  ... ${missing.length - 80} more`);
        process.exitCode = 1;
    }
}

for (const locale of manifest.locales) {
    verifyPlaceholders(`${locale.englishName} frontend`, sourceCatalogs.frontend, catalogs[locale.code].frontend);
    verifyPlaceholders(`${locale.englishName} admin`, sourceCatalogs.admin, catalogs[locale.code].admin);
}
verifyCoverage('frontend', extractFrontend(panelRoot), sourceCatalogs.frontend, ignored.frontend);
verifyCoverage('admin', extractAdmin(panelRoot), sourceCatalogs.admin, ignored.admin);

if (process.exitCode) {
    console.error('Localization release gate failed. Review the generated worklist before deployment.');
} else {
    console.log('Localization catalogs and supported source coverage are complete.');
}
