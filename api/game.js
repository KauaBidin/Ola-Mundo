import { createRoomService, RoomError } from '../lib/room-service.js';
import { createRoomStore } from '../lib/room-store.js';

const MAX_BODY = 8192;
function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(data));
}
async function readBody(req) {
  if (Number(req.headers?.['content-length']) > MAX_BODY) throw new RoomError(413, 'INVALID_REQUEST', 'Mensagem muito grande.');
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > MAX_BODY) throw new RoomError(413, 'INVALID_REQUEST', 'Mensagem muito grande.');
    return typeof req.body === 'string' ? JSON.parse(raw) : req.body;
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > MAX_BODY) throw new RoomError(413, 'INVALID_REQUEST', 'Mensagem muito grande.');
  }
  return JSON.parse(raw);
}
export function createGameHandler({ service, store } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST para acessar as salas.' } }); }
    try {
      if (req.headers?.origin) {
        let origin;
        try { origin = new URL(req.headers.origin); } catch { throw new RoomError(403, 'INVALID_ORIGIN', 'Origem inválida.'); }
        const host = req.headers.host;
        if (origin.host !== host) throw new RoomError(403, 'INVALID_ORIGIN', 'Abra o jogo no mesmo endereço do servidor.');
      }
      const instance = service || createRoomService({ store: store || createRoomStore() });
      const result = await instance.handle(await readBody(req));
      return send(res, 200, result);
    } catch (error) {
      if (error instanceof SyntaxError) return send(res, 400, { error: { code: 'INVALID_REQUEST', message: 'Mensagem JSON inválida.' } });
      const known = Number.isInteger(error?.status) && typeof error?.code === 'string';
      return send(res, known ? error.status : 503, { error: { code: known ? error.code : 'STORAGE_UNAVAILABLE', message: known ? error.message : 'O multiplayer está indisponível. Tente novamente.' } });
    }
  };
}
export default createGameHandler();
