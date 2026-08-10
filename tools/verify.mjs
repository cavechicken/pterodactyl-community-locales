#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { extractAdmin, extractFrontend, readJson } from './lib.mjs';

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

const frontendEn = readJson('catalog/frontend.en.json');
const frontendDe = readJson('catalog/frontend.de.json');
const frontendSwg = readJson('catalog/frontend.swg.overrides.json');
const frontendBar = readJson('catalog/frontend.bar.overrides.json');
const adminEn = readJson('catalog/admin.en.json');
const adminDe = readJson('catalog/admin.de.json');
const adminSwg = readJson('catalog/admin.swg.overrides.json');
const adminBar = readJson('catalog/admin.bar.overrides.json');
const ignored = readJson('catalog/ignored.json');

function verifyCatalog(name, english, german) {
    const englishKeys = Object.keys(english).sort();
    const germanKeys = Object.keys(german).sort();
    if (JSON.stringify(englishKeys) !== JSON.stringify(germanKeys)) {
        const missing = englishKeys.filter((key) => !germanKeys.includes(key));
        const extra = germanKeys.filter((key) => !englishKeys.includes(key));
        throw new Error(`${name} catalog key mismatch; missing=[${missing}] extra=[${extra}]`);
    }
    const blank = germanKeys.filter((key) => typeof german[key] !== 'string' || german[key].trim() === '');
    if (blank.length > 0) throw new Error(`${name} has blank German values: ${blank.join(', ')}`);
}

function verifyOverrides(name, base, overrides) {
    const baseKeys = Object.keys(base).sort();
    const overrideKeys = Object.keys(overrides).sort();
    if (JSON.stringify(baseKeys) !== JSON.stringify(overrideKeys)) {
        const missing = baseKeys.filter((key) => !overrideKeys.includes(key));
        const extra = overrideKeys.filter((key) => !baseKeys.includes(key));
        throw new Error(`${name} must be complete; missing=[${missing}] extra=[${extra}]`);
    }
    const unknown = Object.keys(overrides).filter((key) => !(key in base));
    if (unknown.length > 0) throw new Error(`${name} has unknown keys: ${unknown.join(', ')}`);
    const blank = Object.keys(overrides).filter((key) => typeof overrides[key] !== 'string' || overrides[key].trim() === '');
    if (blank.length > 0) throw new Error(`${name} has blank values: ${blank.join(', ')}`);
}

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

verifyCatalog('frontend', frontendEn, frontendDe);
verifyCatalog('admin', adminEn, adminDe);
verifyPlaceholders('German frontend', frontendEn, frontendDe);
verifyPlaceholders('German admin', adminEn, adminDe);
verifyOverrides('Swabian frontend', frontendDe, frontendSwg);
verifyOverrides('Bavarian frontend', frontendDe, frontendBar);
verifyOverrides('Swabian admin', adminDe, adminSwg);
verifyOverrides('Bavarian admin', adminDe, adminBar);
verifyPlaceholders('Swabian frontend', frontendEn, frontendSwg);
verifyPlaceholders('Bavarian frontend', frontendEn, frontendBar);
verifyPlaceholders('Swabian admin', adminEn, adminSwg);
verifyPlaceholders('Bavarian admin', adminEn, adminBar);
verifyCoverage('frontend', extractFrontend(panelRoot), frontendEn, ignored.frontend);
verifyCoverage('admin', extractAdmin(panelRoot), adminEn, ignored.admin);

if (process.exitCode) {
    console.error('Localization release gate failed. Review the generated worklist before deployment.');
} else {
    console.log('Localization catalogs and supported source coverage are complete.');
}
