#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { extractAdmin, extractFrontend, packRoot, serializableCandidates } from './lib.mjs';

const panelRoot = path.resolve(process.argv[2] || '');
if (!panelRoot || !fs.existsSync(path.join(panelRoot, 'artisan'))) {
    console.error('Usage: node tools/extract.mjs /path/to/pterodactyl-panel');
    process.exit(2);
}

const generated = path.join(packRoot, '.generated');
fs.mkdirSync(generated, { recursive: true, mode: 0o755 });

const frontend = serializableCandidates(extractFrontend(panelRoot));
const admin = serializableCandidates(extractAdmin(panelRoot));
fs.writeFileSync(path.join(generated, 'frontend-candidates.json'), `${JSON.stringify(frontend, null, 2)}\n`);
fs.writeFileSync(path.join(generated, 'admin-candidates.json'), `${JSON.stringify(admin, null, 2)}\n`);

console.log(`Frontend candidate strings: ${Object.keys(frontend).length}`);
console.log(`Administration candidate strings: ${Object.keys(admin).length}`);
console.log(`Review worklists: ${generated}`);
