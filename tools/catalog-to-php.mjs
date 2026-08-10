import fs from 'node:fs';
import path from 'node:path';

function phpString(value) {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function writePhpCatalog(catalog, target) {
    const lines = ['<?php', '', 'return ['];
    for (const key of Object.keys(catalog).sort()) {
        lines.push(`    ${phpString(key)} => ${phpString(catalog[key])},`);
    }
    lines.push('];', '');
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o755 });
    fs.writeFileSync(target, lines.join('\n'), { mode: 0o644 });
}
