#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function fail(message) {
    console.error(`ERROR: ${message}`);
    process.exit(1);
}

const [command, rootInput, manifestInput] = process.argv.slice(2);
if (!['write', 'check'].includes(command) || !rootInput || !manifestInput) {
    fail('usage: node tools/tree-manifest.mjs write|check /path/to/panel /path/to/manifest.json');
}

const root = path.resolve(rootInput);
const manifestPath = path.resolve(manifestInput);
const excluded = (relative) => (
    relative === '.env' ||
    relative === '.git' || relative.startsWith('.git/') ||
    relative === 'storage' || relative.startsWith('storage/') ||
    relative === 'vendor' || relative.startsWith('vendor/') ||
    relative === 'node_modules' || relative.startsWith('node_modules/') ||
    relative === 'bootstrap/cache' || relative.startsWith('bootstrap/cache/') ||
    relative === 'public/favicons' || relative.startsWith('public/favicons/') ||
    relative === '.pterodactyl-locales' || relative.startsWith('.pterodactyl-locales/') ||
    relative === '.pterodactyl-german' || relative.startsWith('.pterodactyl-german/')
);

function inventory() {
    const files = {};
    const visit = (directory, prefix = '') => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (excluded(relative)) continue;
            const absolute = path.join(directory, entry.name);
            if (entry.isSymbolicLink()) fail(`source tree contains a symbolic link: ${relative}`);
            if (entry.isDirectory()) {
                visit(absolute, relative);
            } else if (entry.isFile()) {
                files[relative] = crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
            } else {
                fail(`source tree contains a special file: ${relative}`);
            }
        }
    };
    visit(root);
    return files;
}

if (!fs.existsSync(path.join(root, 'artisan'))) fail('Panel artisan is absent');

if (command === 'write') {
    const document = { version: 1, files: inventory() };
    fs.writeFileSync(manifestPath, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o644 });
    console.log(`Recorded ${Object.keys(document.files).length} upstream files.`);
} else {
    const expected = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (expected.version !== 1 || !expected.files || typeof expected.files !== 'object') fail('source manifest format is invalid');
    const actual = inventory();
    const problems = [];
    for (const [relative, digest] of Object.entries(expected.files)) {
        if (!(relative in actual)) problems.push(`missing: ${relative}`);
        else if (actual[relative] !== digest) problems.push(`modified: ${relative}`);
    }
    for (const relative of Object.keys(actual)) {
        if (!(relative in expected.files)) problems.push(`unexpected: ${relative}`);
    }
    if (problems.length > 0) {
        for (const problem of problems.slice(0, 20)) console.error(`  ${problem}`);
        if (problems.length > 20) console.error(`  ... ${problems.length - 20} more`);
        fail('live Panel source differs from the checksum-pinned clean upstream release');
    }
    console.log(`Live Panel source matches ${Object.keys(actual).length} upstream files.`);
}
