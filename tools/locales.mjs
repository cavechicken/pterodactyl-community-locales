import fs from 'node:fs';
import path from 'node:path';
import { packRoot, readJson } from './lib.mjs';

function fail(message) {
    throw new Error(`invalid locales.json: ${message}`);
}

export function readLocaleManifest() {
    const manifest = readJson('locales.json');
    if (!Array.isArray(manifest.locales) || manifest.locales.length < 2) fail('locales must contain at least two entries');

    const codes = new Set();
    const descriptionKeys = new Set();
    for (const locale of manifest.locales) {
        if (!locale || typeof locale !== 'object') fail('every locale must be an object');
        if (!/^[a-z]{2,3}$/.test(locale.code || '')) fail(`unsupported locale code: ${locale.code}`);
        if (codes.has(locale.code)) fail(`duplicate locale code: ${locale.code}`);
        codes.add(locale.code);
        for (const field of ['englishName', 'nativeName', 'badge', 'descriptionKey']) {
            if (typeof locale[field] !== 'string' || locale[field].trim() === '') fail(`${locale.code}.${field} is required`);
        }
        if (!/^[A-Z0-9]{2,3}$/.test(locale.badge)) fail(`${locale.code}.badge must be two or three uppercase characters`);
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(locale.descriptionKey)) fail(`${locale.code}.descriptionKey is invalid`);
        if (descriptionKeys.has(locale.descriptionKey)) fail(`duplicate description key: ${locale.descriptionKey}`);
        descriptionKeys.add(locale.descriptionKey);
        if (locale.baseLocale !== null && typeof locale.baseLocale !== 'string') fail(`${locale.code}.baseLocale is invalid`);
        if (!Array.isArray(locale.fallbacks)) fail(`${locale.code}.fallbacks must be an array`);
    }

    if (!codes.has(manifest.defaultLocale)) fail('defaultLocale is not declared');
    for (const locale of manifest.locales) {
        if (locale.baseLocale !== null && !codes.has(locale.baseLocale)) fail(`${locale.code}.baseLocale is not declared`);
        for (const fallback of locale.fallbacks) {
            if (!codes.has(fallback)) fail(`${locale.code} has an unknown fallback: ${fallback}`);
            if (fallback === locale.code) fail(`${locale.code} cannot fall back to itself`);
        }
    }

    const resolving = new Set();
    const resolved = new Set();
    const visit = (code) => {
        if (resolved.has(code)) return;
        if (resolving.has(code)) fail(`baseLocale cycle contains ${code}`);
        resolving.add(code);
        const locale = manifest.locales.find((item) => item.code === code);
        if (locale.baseLocale) visit(locale.baseLocale);
        resolving.delete(code);
        resolved.add(code);
    };
    for (const code of codes) visit(code);

    return manifest;
}

export function catalogPath(surface, code, kind = 'full') {
    const suffix = kind === 'override' ? `${code}.overrides` : code;
    return `catalog/${surface}.${suffix}.json`;
}

export function resolveLocaleCatalogs(manifest = readLocaleManifest()) {
    const byCode = new Map(manifest.locales.map((locale) => [locale.code, locale]));
    const cache = new Map();

    const resolveOne = (surface, code) => {
        const cacheKey = `${surface}:${code}`;
        if (cache.has(cacheKey)) return cache.get(cacheKey);
        const locale = byCode.get(code);
        const full = catalogPath(surface, code);
        const override = catalogPath(surface, code, 'override');
        const fullPath = path.join(packRoot, full);
        const overridePath = path.join(packRoot, override);
        let catalog;

        if (fs.existsSync(fullPath)) {
            catalog = readJson(full);
        } else {
            if (!locale.baseLocale) fail(`${code} needs a complete ${surface} catalog`);
            if (!fs.existsSync(overridePath)) fail(`${code} needs ${override}`);
            const base = resolveOne(surface, locale.baseLocale);
            const changes = readJson(override);
            const unknown = Object.keys(changes).filter((key) => !(key in base));
            if (unknown.length > 0) fail(`${override} contains unknown keys: ${unknown.join(', ')}`);
            const missing = Object.keys(base).filter((key) => !(key in changes));
            if (missing.length > 0) fail(`${override} is not complete; missing: ${missing.join(', ')}`);
            catalog = { ...base, ...changes };
        }

        for (const [key, value] of Object.entries(catalog)) {
            if (typeof value !== 'string' || value.trim() === '') fail(`${surface}.${code}.${key} is empty or not text`);
            if (/^\[TODO [a-z]{2,3}\]/.test(value)) fail(`${surface}.${code}.${key} is still an unfinished scaffold entry`);
        }
        cache.set(cacheKey, catalog);
        return catalog;
    };

    const result = {};
    for (const locale of manifest.locales) {
        result[locale.code] = {
            frontend: resolveOne('frontend', locale.code),
            admin: resolveOne('admin', locale.code),
        };
    }

    for (const locale of manifest.locales) {
        for (const surface of ['frontend', 'admin']) {
            const expected = Object.keys(result[manifest.defaultLocale][surface]).sort();
            const actual = Object.keys(result[locale.code][surface]).sort();
            if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${surface}.${locale.code} does not have complete key coverage`);
        }
        for (const described of manifest.locales) {
            if (!(described.descriptionKey in result[locale.code].frontend)) {
                fail(`frontend.${locale.code} lacks ${described.descriptionKey}`);
            }
        }
    }

    return result;
}

export function phpString(value) {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}
