import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const files=['server.js'];
for(const dir of ['public','api','lib'])for(const name of readdirSync(new URL('../'+dir+'/',import.meta.url)))if(name.endsWith('.js'))files.push(dir+'/'+name);
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
console.log(`Sintaxe validada em ${files.length} módulos.`);
