import { createRoomStore } from '../lib/room-store.js';
export function createHealthHandler({ store } = {}) {
  return async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.statusCode = 405; res.setHeader('Allow', 'GET, HEAD');
      res.end(JSON.stringify({ ok: false, transport: 'http', message: 'Use GET.' })); return;
    }
    try {
      await (store || createRoomStore()).ping(); res.statusCode = 200;
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ ok: true, transport: 'http', pollAfterMs: 100, game: 'PVP GRUPO APANE' }));
    } catch (error) {
      res.statusCode = 503;
      const message = error?.code === 'NOT_CONFIGURED' ? error.message : 'O multiplayer está temporariamente indisponível.';
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ ok: false, transport: 'http', message }));
    }
  };
}
export default createHealthHandler();
