#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { packRoot } from './lib.mjs';

const read = (file) => JSON.parse(fs.readFileSync(path.join(packRoot, file), 'utf8'));
const write = (file, value) => fs.writeFileSync(path.join(packRoot, file), `${JSON.stringify(value, null, 2)}\n`);
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function regionalizeLabel(value, rules) {
    // Regional vocabulary is applied only to short controls and headings.
    // Technical explanations remain reviewed Standard German unless a complete
    // sentence override exists below. Word-by-word dialect conversion of prose
    // produced grammatically broken hybrids and is deliberately forbidden.
    if (value.length > 52 || /[.!?]/.test(value) || value.includes('{{')) return value;
    return rules.reduce((text, [source, target]) => text.replace(
        new RegExp(`(?<![\\p{L}\\p{N}_])${escape(source)}(?![\\p{L}\\p{N}_])`, 'gu'),
        target,
    ), value);
}

const swabianLabelRules = [
    ['Einstellungen', 'Eistellunga'],
    ['Datenbanken', 'Datebanka'],
    ['Sicherungen', 'Sicherunga'],
    ['Berechtigungen', 'Berechtigunga'],
    ['Zuweisungen', 'Zuweisunga'],
    ['Dateien', 'Dateia'],
    ['Zeitpläne', 'Zeitplän'],
    ['Sprache', 'Sproch'],
    ['Sprachen', 'Sprocha'],
    ['Speichern', 'Speichra'],
    ['speichern', 'speichra'],
    ['Löschen', 'Löscha'],
    ['löschen', 'löscha'],
    ['Erstellen', 'Anlega'],
    ['erstellen', 'anlega'],
    ['Abbrechen', 'Abbrecha'],
    ['Schließen', 'Zumacha'],
    ['Auswählen', 'Auswähla'],
    ['Zurück', 'Zruck'],
    ['Weiter', 'Weider'],
];

const bavarianLabelRules = [
    ['Einstellungen', 'Eistellunga'],
    ['Datenbanken', 'Datenbankn'],
    ['Sicherungen', 'Sicherunga'],
    ['Berechtigungen', 'Berechtigunga'],
    ['Zuweisungen', 'Zuweisunga'],
    ['Dateien', 'Datein'],
    ['Zeitpläne', 'Zeitplän'],
    ['Sprache', 'Sproch'],
    ['Sprachen', 'Sprocha'],
    ['Speichern', 'Speichan'],
    ['speichern', 'speichan'],
    ['Löschen', 'Löschn'],
    ['löschen', 'löschn'],
    ['Erstellen', 'Anlegn'],
    ['erstellen', 'anlegn'],
    ['Abbrechen', 'Abbrecha'],
    ['Schließen', 'Zumacha'],
    ['Auswählen', 'Auswähln'],
    ['Zurück', 'Zruck'],
    ['Weiter', 'Weida'],
];

const explicit = {
    swg: {
        frontend: {
            chooseLanguage: 'Sproch auswähla',
            chooseLanguageDescription: 'Ändert d’Sproch für dei Konto ond fürs ganze Panel.',
            activeLanguage: 'Aktuelle Sproch',
            languageDescriptionEnglish: 'Englische Oberfläche',
            languageDescriptionGerman: 'Hochdeutsche Oberfläche',
            languageDescriptionSwabian: 'Schwäbische Oberfläche',
            languageDescriptionBavarian: 'Boarische Oberfläche',
            newUser: 'Neuer Benutzer',
            ui_create_new_subuser_e857c944c1: 'Neuen Unterbenutzer anlega',
            ui_invite_user_19fa22d995: 'Benutzer eilada',
            ui_search_49c266baaa: 'Suacha',
            ui_memory_c3963aedaa: 'Arbeitsspeicher',
            ui_disk_340e0cf3bf: 'Speicherplatz',
            ui_cpu_load_049d7cce07: 'CPU-Auslastung',
            ui_uptime_d63ab47114: 'Betriebszeit',
        },
        admin: {
            panelSettings: 'Panel-Einstellungen',
            configurePanel: 'Pterodactyl so eistella, wie du’s brauchst.',
            defaultLanguage: 'Standardsproch',
            requireTwoFactor: 'Zwei-Faktor-Anmeldung erforderlich',
            requireTwoFactorHelp: 'Konten aus dr ausgewählte Gruppe müsset d’Zwei-Faktor-Anmeldung aktiviere, um s’Panel zu benutza.',
            notRequired: 'Net erforderlich',
            adminOnly: 'Bloß Administratoren',
            allUsers: 'Alle Benutzer',
            ui_about_4efca0d10c: 'Übersicht',
            ui_details_45989de49f: 'Details',
            ui_build_configuration_af5792870c: 'Ressourcen',
            ui_database_fa7fe67124: 'Datebank',
            mounts: 'Einbindunga',
            ui_manage_5a23444828: 'Verwalta',
            legacyDelete: 'Löscha',
            legacySearch: 'Suacha',
        },
    },
    bar: {
        frontend: {
            chooseLanguage: 'Sproch auswähln',
            chooseLanguageDescription: 'Ändert d’Sproch für dei Konto und fürs ganze Panel.',
            activeLanguage: 'Aktuelle Sproch',
            languageDescriptionEnglish: 'Englische Oberfläche',
            languageDescriptionGerman: 'Hochdeitsche Oberfläche',
            languageDescriptionSwabian: 'Schwäbische Oberfläche',
            languageDescriptionBavarian: 'Boarische Oberfläche',
            newUser: 'Neia Benutzer',
            ui_create_new_subuser_e857c944c1: 'Neia Unterbenutzer anlegn',
            ui_invite_user_19fa22d995: 'Benutzer einladn',
            ui_search_49c266baaa: 'Suacha',
            ui_memory_c3963aedaa: 'Arbeitsspeicher',
            ui_disk_340e0cf3bf: 'Speicherplatz',
            ui_cpu_load_049d7cce07: 'CPU-Auslastung',
            ui_uptime_d63ab47114: 'Betriebszeit',
        },
        admin: {
            panelSettings: 'Panel-Einstellungen',
            configurePanel: 'Pterodactyl so eistelln, wia du’s brauchst.',
            defaultLanguage: 'Standardsproch',
            requireTwoFactor: 'Zwoa-Faktor-Anmeldung erforderlich',
            requireTwoFactorHelp: 'Konten aus da ausgewählten Gruppn miassn d’Zwoa-Faktor-Anmeldung aktiviern, damit’s s’Panel benutzn kenna.',
            notRequired: 'Ned erforderlich',
            adminOnly: 'Bloß Administratoren',
            allUsers: 'Alle Benutzer',
            ui_about_4efca0d10c: 'Übersicht',
            ui_details_45989de49f: 'Details',
            ui_build_configuration_af5792870c: 'Ressourcen',
            ui_database_fa7fe67124: 'Datenbank',
            mounts: 'Einbindunga',
            ui_manage_5a23444828: 'Verwaltn',
            legacyDelete: 'Löschn',
            legacySearch: 'Suacha',
        },
    },
};

for (const surface of ['frontend', 'admin']) {
    const german = read(`catalog/${surface}.de.json`);
    for (const [locale, rules] of [['swg', swabianLabelRules], ['bar', bavarianLabelRules]]) {
        const catalog = Object.fromEntries(Object.entries(german).map(
            ([key, value]) => [key, regionalizeLabel(value, rules)],
        ));
        Object.assign(catalog, explicit[locale][surface]);
        write(`catalog/${surface}.${locale}.overrides.json`, catalog);
        const changed = Object.keys(german).filter((key) => catalog[key] !== german[key]).length;
        console.log(`${surface}.${locale}: ${changed}/${Object.keys(german).length} reviewed regional entries`);
    }
}
