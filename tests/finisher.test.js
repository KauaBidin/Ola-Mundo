import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, FINISHER_DURATION, createMatch, stepMatch } from '../public/engine.js';
import { drawFinisher, getFinisherStage, FINISHER_IMPACT_AT, FINISHER_IMPACT_TIMES } from '../public/finisher.js';

// Record effective Canvas state as well as geometry, so these checks catch
// accidental frame-history randomness and leaked clipping/compositing state.
function recordingContext() {
  const operations = [], stack = [];
  let current = {
    globalAlpha: 0.7, globalCompositeOperation: 'destination-over',
    imageSmoothingEnabled: true, filter: 'blur(0.25px)', fillStyle: '#123456', strokeStyle: '#654321',
    lineWidth: 3, font: '13px monospace', textAlign: 'left', textBaseline: 'alphabetic', transforms: [],
  };
  const snapshot = () => ({ ...current, transforms: current.transforms.map(value => [...value]) });
  const serial = value => value?.kind === 'gradient'
    ? { type: value.type, args: value.args, stops: value.stops.map(stop => [...stop]) }
    : value?.src ? { src: value.src } : value;
  const context = new Proxy({}, {
    get(_, key) {
      if (key in current) return current[key];
      if (key === 'measureText') return text => ({ width: String(text).length * 7 });
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return (...args) => {
        assert.ok(args.every(Number.isFinite));
        return { kind: 'gradient', type: key, args, stops: [], addColorStop(offset, color) { this.stops.push([offset, color]); } };
      };
      return (...args) => {
        for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${String(key)} uses finite coordinates`);
        operations.push({
          method: key, args: args.map(serial), depth: stack.length,
          alpha: current.globalAlpha, fill: serial(current.fillStyle), stroke: serial(current.strokeStyle),
          composite: current.globalCompositeOperation, filter: current.filter,
        });
        if (key === 'save') stack.push(snapshot());
        else if (key === 'restore') { assert.ok(stack.length, 'restore must have a matching save'); current = stack.pop(); }
        else if (['translate', 'scale', 'rotate', 'transform', 'setTransform'].includes(key)) current.transforms.push([key, ...args]);
      };
    },
    set(_, key, value) {
      if (['globalAlpha', 'lineWidth'].includes(key)) assert.ok(Number.isFinite(value), `${key} is finite`);
      current[key] = value; return true;
    },
  });
  context.translate(7, 9);
  return { context, operations, snapshot, depth: () => stack.length };
}

function cinematicFor(index) {
  const fighter = CHARACTERS[index], rival = CHARACTERS[(index + 1) % CHARACTERS.length];
  const match = createMatch([fighter.id, rival.id], { seed: 19 });
  match.phase = 'playing'; match.countdown = 0;
  match.players[0].x = 400; match.players[1].x = 485; match.players[1].hp = 1;
  stepMatch(match, [{ special: true }, {}], 1 / 120);
  assert.ok(match.finisher, 'fixture produces an authoritative finisher');
  return Object.freeze({
    attacker: match.finisher.source, target: match.finisher.target,
    color: fighter.color, seed: 97 + index,
  });
}

test('the 5.5s finisher stages neck grab, blackout, silhouette and victory at shared impact times', () => {
  assert.equal(FINISHER_DURATION, 5.5);
  for (const age of [-1, 0, 1.099, NaN, Infinity]) assert.equal(getFinisherStage(age), 'grab');
  for (const age of [1.1, FINISHER_IMPACT_AT, 3.499]) assert.equal(getFinisherStage(age), 'blackout');
  for (const age of [3.5, 4, 4.299]) assert.equal(getFinisherStage(age), 'silhouette');
  for (const age of [4.3, 5.49, FINISHER_DURATION, 6]) assert.equal(getFinisherStage(age), 'victory');
  assert.deepEqual(FINISHER_IMPACT_TIMES, [1.4, 2.2, 3]);
  assert.equal(FINISHER_IMPACT_AT, FINISHER_IMPACT_TIMES[0]);
  for (const age of FINISHER_IMPACT_TIMES) assert.equal(getFinisherStage(age), 'blackout');
});

test('all eleven finishers draw deterministically without mutating snapshots or leaking Canvas state', () => {
  for (let index = 0; index < CHARACTERS.length; index++) {
    const scene = cinematicFor(index), before = structuredClone(scene);
    assert.ok(Object.isFrozen(scene.attacker) && Object.isFrozen(scene.target));
    for (const reducedMotion of [false, true]) {
      for (const age of [0, 0.6, 1.1, 1.4, 2.2, 3, 3.49, 3.5, 3.9, 4.3, 4.9, 5.49]) {
        const first = recordingContext(), baseline = first.snapshot();
        drawFinisher(first.context, scene, age, reducedMotion);
        assert.equal(first.depth(), 0, `${CHARACTERS[index].name}: balanced save/restore`);
        assert.deepEqual(first.snapshot(), baseline, 'caller transform, alpha, smoothing and compositing survive');
        assert.ok(first.operations.some(operation => operation.method === 'fillRect'), 'frame has visible geometry');
        const second = recordingContext();
        drawFinisher(second.context, scene, age, reducedMotion);
        assert.deepEqual(first.operations, second.operations, `${CHARACTERS[index].name}: same snapshot/time redraws the same frame`);
      }
    }
    assert.deepEqual(scene, before, 'rendering never alters either frozen combat snapshot');
  }
});

test('reduced motion keeps the cinematic camera steady through impact and skips bright screen flashes', () => {
  const scene = cinematicFor(4), cameraTraces = [];
  for (const age of [0.6, 1.1, 1.4, 2.2, 3, 3.5, 4.3, 5.1]) {
    const render = recordingContext();
    drawFinisher(render.context, scene, age, true);
    const camera = render.operations.filter(operation => operation.depth === 1 && ['translate', 'scale', 'rotate'].includes(operation.method));
    for (const operation of camera) {
      if (operation.method === 'scale') assert.deepEqual(operation.args, [1, 1], 'reduced motion never zooms the camera');
      if (operation.method === 'rotate') assert.equal(operation.args[0], 0, 'reduced motion never rotates the camera');
    }
    if (camera.length) cameraTraces.push(camera.map(({ method, args }) => ({ method, args })));
    const flashes = render.operations.filter(operation => {
      if (operation.method !== 'fillRect' || typeof operation.fill !== 'string' || operation.alpha <= 0.1) return false;
      const color = operation.fill.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})(?:[\da-f]{2})?$/i);
      if (!color || !color.slice(1).every(channel => parseInt(channel, 16) > 210)) return false;
      return Math.abs(operation.args[2] * operation.args[3]) > 1200 * 600 * 0.25;
    });
    assert.deepEqual(flashes, [], 'reduced motion avoids broad bright flash overlays');
  }
  assert.ok(cameraTraces[0].length, 'fixture observes the cinematic camera');
  for (const camera of cameraTraces.slice(1)) assert.deepEqual(camera, cameraTraces[0], 'camera does not shake between phases');
});
