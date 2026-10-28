import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, createMatch, PUNCH_DURATION, SPECIAL_DURATION } from '../public/engine.js';

// Pretend the original image atlases have finished loading: guests must still
// draw their own bodies, rather than silently adopting an original fighter.
const previousImage = globalThis.Image;
globalThis.Image = class { complete = true; naturalWidth = 1536; };
const { drawFighter, portraitSVG } = await import('../public/art.js');
if (previousImage === undefined) delete globalThis.Image;
else globalThis.Image = previousImage;

function recordingContext() {
  const rectangles = [], images = [];
  const values = { fillStyle: '#000', globalAlpha: 1 };
  const context = new Proxy(values, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => ({ addColorStop() {} });
      return (...args) => {
        for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${String(key)} uses finite coordinates`);
        if (key === 'fillRect') rectangles.push([...args, target.fillStyle]);
        if (key === 'drawImage') images.push(args[0]);
      };
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  return { context, rectangles, images };
}

test('guest portraits and arena bodies are distinct even after original atlases load', () => {
  const originals = recordingContext();
  drawFighter(originals.context, createMatch().players[0], 300, 500, 1, 0);
  assert.ok(originals.images.length > 0, 'fixture loads the original image atlases');
  const signatures = new Set();
  const guests = CHARACTERS.slice(4);
  for (const character of guests) {
    const svg = portraitSVG(character);
    assert.ok(svg.includes(character.name));
    assert.doesNotMatch(svg, /emerzon-corinthians|douglas-revolver|jose-coffee|kaua-saopaulo/);
    const player = createMatch([character.id, 'emerzon']).players[0];
    const idle = recordingContext();
    drawFighter(idle.context, player, 300, 500, 1, 0);
    assert.ok(idle.rectangles.length > 0, `${character.name} has visible pixel art`);
    assert.equal(idle.images.length, 0, `${character.name} bypasses the original atlases`);
    signatures.add(JSON.stringify(idle.rectangles));
    for (const action of ['walk', 'jump', 'attack', 'special', 'block', 'hit', 'down', 'knockout']) {
      const render = recordingContext();
      drawFighter(render.context, {
        ...player, action, hp: action === 'knockout' ? 0 : 100,
        y: action === 'jump' || action === 'special' ? 40 : 0,
        attackTimer: (action === 'special' ? SPECIAL_DURATION : PUNCH_DURATION) / 2,
        downTimer: action === 'down' ? 0.6 : 0,
      }, 300, 500, 1, 0.25);
      assert.ok(render.rectangles.length > 0, `${character.name}: ${action} draws`);
      assert.equal(render.images.length, 0, `${character.name}: ${action} keeps its own art`);
    }
  }
  assert.equal(signatures.size, guests.length, 'each guest has a different body');
});
