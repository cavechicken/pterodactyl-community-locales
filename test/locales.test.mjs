import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));

test('declares exactly the four supported locales', () => {
    assert.deepEqual(json('upstream.json').supportedLocales, ['en', 'de', 'swg', 'bar']);
});

for (const surface of ['frontend', 'admin']) {
    const german = json(`catalog/${surface}.de.json`);

    for (const locale of ['swg', 'bar']) {
        test(`${surface} ${locale} is a complete regional catalog`, () => {
            const overrides = json(`catalog/${surface}.${locale}.overrides.json`);
            assert.deepEqual(Object.keys(overrides).sort(), Object.keys(german).sort());
            for (const [key, value] of Object.entries(overrides)) {
                assert.ok(key in german, `unknown ${surface} key: ${key}`);
                assert.equal(typeof value, 'string');
                assert.notEqual(value.trim(), '');
            }
            const regionalized = Object.keys(german).filter((key) => overrides[key] !== german[key]).length;
            assert.ok(regionalized >= 45, `${surface}.${locale} only regionalizes ${regionalized} entries`);
        });
    }
}

test('regional catalogs keep technical status terms accurate', () => {
    for (const locale of ['swg', 'bar']) {
        const frontend = json(`catalog/frontend.${locale}.overrides.json`);
        assert.equal(frontend.ui_memory_c3963aedaa, 'Arbeitsspeicher');
        assert.equal(frontend.ui_disk_340e0cf3bf, 'Speicherplatz');
        assert.equal(frontend.ui_cpu_load_049d7cce07, 'CPU-Auslastung');
        assert.notEqual(frontend.ui_search_49c266baaa, 'Search');
    }
});

test('all German-derived catalogs reject known literal machine translations', () => {
    const forbidden = /Pterodaktylus|Häfen|Notgroschen|Erinnerung|Diskette/u;
    for (const surface of ['frontend', 'admin']) {
        for (const suffix of ['de', 'swg.overrides', 'bar.overrides']) {
            const catalog = json(`catalog/${surface}.${suffix}.json`);
            for (const [key, value] of Object.entries(catalog)) {
                assert.doesNotMatch(value, forbidden, `${surface}.${suffix}.${key}`);
            }
        }
    }
});

test('regional admin navigation has reviewed labels', () => {
    for (const locale of ['swg', 'bar']) {
        const admin = json(`catalog/admin.${locale}.overrides.json`);
        assert.equal(admin.ui_about_4efca0d10c, 'Übersicht');
        assert.equal(admin.ui_build_configuration_af5792870c, 'Ressourcen');
        assert.equal(admin.ui_details_45989de49f, 'Details');
        assert.notEqual(admin.legacyDelete, 'Delete');
    }
});

test('locale bootstrap uses safe fallback order', () => {
    const source = fs.readFileSync(path.join(root, 'overrides/resources/scripts/i18n.ts'), 'utf8');
    assert.match(source, /swg: \['de', 'en'\]/);
    assert.match(source, /bar: \['de', 'en'\]/);
    assert.match(source, /supportedLocales: ReadonlyArray<SupportedLocale> = \['en', 'de', 'swg', 'bar'\]/);
});

test('locale bootstrap is translated before the first React render', () => {
    const i18n = fs.readFileSync(path.join(root, 'overrides/resources/scripts/i18n.ts'), 'utf8');
    const apply = fs.readFileSync(path.join(root, 'tools/apply.mjs'), 'utf8');
    assert.match(i18n, /PterodactylLocale\?: Record<string, unknown>/);
    assert.match(i18n, /initImmediate: false/);
    assert.match(i18n, /frontend: localizedWindow\.PterodactylLocale \|\| \{\}/);
    assert.match(apply, /window\.PterodactylLocale/);
    assert.match(apply, /JSON_HEX_TAG \| JSON_HEX_APOS \| JSON_HEX_AMP \| JSON_HEX_QUOT/);
});

test('server-side locale request is an exact allowlist', () => {
    const source = fs.readFileSync(path.join(root, 'overrides/app/Http/Requests/Base/LocaleRequest.php'), 'utf8');
    assert.match(source, /Rule::in\(\['en', 'de', 'swg', 'bar'\]\)/);
});

test('server-side dialects clone German namespaces before applying overrides', () => {
    const source = fs.readFileSync(path.join(root, 'tools/apply.mjs'), 'utf8');
    assert.match(source, /cloneGermanNamespaces\(panelRoot, 'swg'\)/);
    assert.match(source, /cloneGermanNamespaces\(panelRoot, 'bar'\)/);
});

test('staging applier is reusable and refuses live environment trees', () => {
    const source = fs.readFileSync(path.join(root, 'tools/apply.mjs'), 'utf8');
    assert.match(source, /fs\.existsSync\(path\.join\(panelRoot, '\.env'\)\)/);
    assert.doesNotMatch(source, /\/opt\/services|cavetown/i);
});
