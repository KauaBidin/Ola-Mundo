// Vercel publishes public/ and bundles api/ from the repository root.
import { access } from 'node:fs/promises';
for(const file of ['public/index.html','public/app.js','public/engine.js','public/online.js','api/game.js','api/health.js'])await access(new URL('../'+file,import.meta.url));
console.log('Jogo estático e API multiplayer prontos para publicação.');
