// Every production instance talks to this shared store. Never use local memory
// as a silent fallback: separate Vercel instances would create separate rooms.
export class RoomStorageError extends Error {
  constructor(message = 'Não foi possível acessar as salas. Tente novamente.', code = 'STORAGE_UNAVAILABLE') {
    super(message); this.name = 'RoomStorageError'; this.status = 503; this.code = code;
  }
}

export const COMPARE_AND_SET_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
if ARGV[2] == '' then
  redis.call('DEL', KEYS[1])
else
  redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
end
return 1`;

export class UpstashRoomStore {
  constructor({ url, token, fetchImpl = globalThis.fetch, ttlSeconds = 1800, prefix = 'apane:v1:room:' } = {}) {
    let parsed;
    try { parsed = new URL(url); } catch { /* handled below */ }
    if (!parsed || parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || typeof token !== 'string' || !token.trim()) {
      throw new RoomStorageError('Multiplayer não configurado. Defina UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN na Vercel.', 'NOT_CONFIGURED');
    }
    this.url = parsed.href.replace(/\/$/, ''); this.token = token;
    this.fetchImpl = fetchImpl; this.ttlSeconds = ttlSeconds; this.prefix = prefix;
  }
  async command(command) {
    try {
      const response = await this.fetchImpl(this.url, {
        method: 'POST', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(command), signal: AbortSignal.timeout(3500), cache: 'no-store',
      });
      if (!response.ok) throw new Error('Redis unavailable');
      const data = await response.json();
      if (!data || data.error || !Object.hasOwn(data, 'result')) throw new Error('Invalid Redis response');
      return data.result;
    } catch { throw new RoomStorageError(); }
  }
  async ping() { if ((await this.command(['PING'])) !== 'PONG') throw new RoomStorageError(); return true; }
  async get(code) { return await this.command(['GET', this.prefix + code]); }
  async create(code, raw) { return (await this.command(['SET', this.prefix + code, raw, 'EX', this.ttlSeconds, 'NX'])) === 'OK'; }
  async compareAndSet(code, expectedRaw, nextRaw) {
    return Number(await this.command(['EVAL', COMPARE_AND_SET_SCRIPT, 1, this.prefix + code, expectedRaw, nextRaw ?? '', this.ttlSeconds])) === 1;
  }
}

export function createRoomStore(env = process.env) {
  return new UpstashRoomStore({
    url: env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN,
  });
}

// Explicitly injected test/development store; api handlers never select it.
export class MemoryRoomStore {
  constructor({ now = Date.now, ttlSeconds = 1800 } = {}) { this.now = now; this.ttlSeconds = ttlSeconds; this.entries = new Map(); }
  async ping() { return true; }
  async get(code) {
    const entry = this.entries.get(code);
    if (!entry) return null;
    if (entry.expires <= this.now()) { this.entries.delete(code); return null; }
    return entry.raw;
  }
  async create(code, raw) {
    if (await this.get(code) !== null) return false;
    // No await between the final comparison and write, matching SET NX.
    if (this.entries.has(code)) return false;
    this.entries.set(code, { raw, expires: this.now() + this.ttlSeconds * 1000 }); return true;
  }
  async compareAndSet(code, expectedRaw, nextRaw) {
    if (await this.get(code) !== expectedRaw) return false;
    const current = this.entries.get(code);
    if (!current || current.raw !== expectedRaw) return false;
    if (nextRaw === null) this.entries.delete(code);
    else this.entries.set(code, { raw: nextRaw, expires: this.now() + this.ttlSeconds * 1000 });
    return true;
  }
}
