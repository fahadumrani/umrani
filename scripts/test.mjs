import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const tests=[];
async function walk(path){for(const entry of await readdir(path,{withFileTypes:true})){const full=resolve(path,entry.name);if(entry.isDirectory())await walk(full);else if(entry.name.endsWith('.test.mjs'))tests.push(full);}}
await walk(resolve(import.meta.dirname,'../tests'));
const result=spawnSync(process.execPath,['--test',...tests.sort()],{stdio:'inherit'});
process.exit(result.status ?? 1);
