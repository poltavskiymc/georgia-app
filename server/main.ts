/* Сервер синхронизации плана поездки. Deno Deploy + Deno KV.
   Хранит по коду поездки один JSON: {rev, see, eat, pack, upd}.
   Никаких аккаунтов и паролей: кто знает код — тот в поездке. Внутри только чек-лист
   (места, блюда, сборы) — ни ключей, ни чатов, ни геопозиции, они с телефона не уезжают.

   Почему Deno, а не Cloudflare Workers: *.workers.dev не открывается из России (TCP режется),
   а *.deno.dev открывается. Логика та же, отличается только рантайм.

   Ручки:
     PUT  /t/:id        — создать поездку (409, если код уже занят)
     GET  /t/:id/rev    — {rev}: дешёвая проверка «на сервере что-то поменялось?»
     POST /t/:id        — прислать своё состояние, получить объединённое (это и есть синк)

   Слияние: union по id пункта, конфликт разрешается по ts последней правки (last-write-wins
   на уровне пункта, не всего плана). Удаление приезжает как «надгробие» {del:true} —
   без него пункт, убранный на одном телефоне, воскрес бы со второго при первом же синке.

   Запись — атомарная (KV check-and-set по versionstamp): если два телефона синкаются
   одновременно, второй не затрёт первого, а перечитает и смержит заново. */

type Item = { id: string; ts: number; del?: boolean; [k: string]: unknown };
type Trip = { rev: number; see: Item[]; eat: Item[]; pack: Item[]; upd: number };

const KINDS = ['see', 'eat', 'pack'] as const;
const ID_RE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;   // без 0/O/1/I — их путают, когда код диктуют голосом
const MAX_BODY = 256 * 1024;
const MAX_ITEMS = 500;                                   // на каждый список: столько мест и блюд руками не набрать
const TOMB_TTL = 180 * 24 * 3600 * 1000;                 // надгробия старше полугода можно забыть

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const kv = await Deno.openKv();
const empty = (): Trip => ({ rev: 0, see: [], eat: [], pack: [], upd: 0 });

// Мусор и переростков молча выкидываем — с телефона такого прийти не должно.
function clean(list: unknown): Item[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((it) => it && typeof it.id === 'string' && it.id.length <= 120)
    .slice(0, MAX_ITEMS)
    .map((it) => ({ ...it, ts: Number(it.ts) || 0 }));
}

function merge(a: Partial<Trip>, b: Partial<Trip>): Pick<Trip, 'see' | 'eat' | 'pack'> {
  const now = Date.now();
  const out = { see: [], eat: [], pack: [] } as Pick<Trip, 'see' | 'eat' | 'pack'>;
  for (const kind of KINDS) {
    const byId = new Map<string, Item>();
    for (const it of [...clean(a[kind]), ...clean(b[kind])]) {
      const prev = byId.get(it.id);
      if (!prev || it.ts > prev.ts) byId.set(it.id, it);   // побеждает более свежая правка
    }
    out[kind] = [...byId.values()].filter((it) => !(it.del && now - it.ts > TOMB_TTL));
  }
  return out;
}

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const url = new URL(request.url);
  if (url.pathname === '/') return json({ ok: 'georgia-trip' });

  const m = /^\/t\/([^/]+)(\/rev)?$/.exec(url.pathname);
  if (!m) return json({ error: 'not_found' }, 404);

  const id = decodeURIComponent(m[1]).toUpperCase();
  const isRev = !!m[2];
  if (!ID_RE.test(id)) return json({ error: 'bad_id' }, 400);
  const key = ['trip', id];

  if (request.method === 'PUT' && !isRev) {
    const trip: Trip = { ...empty(), rev: 1, upd: Date.now() };
    // check(null) = «создать, только если ключа ещё нет» — иначе два одновременных PUT затрут друг друга
    const res = await kv.atomic().check({ key, versionstamp: null }).set(key, trip).commit();
    return res.ok ? json(trip, 201) : json({ error: 'exists' }, 409);
  }

  if (request.method === 'GET') {
    const cur = await kv.get<Trip>(key);
    if (!cur.value) return json({ error: 'no_trip' }, 404);
    return json(isRev ? { rev: cur.value.rev } : cur.value);
  }

  if (request.method === 'POST' && !isRev) {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: 'too_big' }, 413);
    let mine: Partial<Trip>;
    try { mine = JSON.parse(raw || '{}'); } catch { return json({ error: 'bad_json' }, 400); }

    // читаем → мержим → пишем, но только если за это время никто другой не записал
    for (let i = 0; i < 5; i++) {
      const cur = await kv.get<Trip>(key);
      if (!cur.value) return json({ error: 'no_trip' }, 404);
      const trip: Trip = { ...merge(cur.value, mine), rev: (cur.value.rev || 0) + 1, upd: Date.now() };
      const res = await kv.atomic().check(cur).set(key, trip).commit();
      if (res.ok) return json(trip);
    }
    return json({ error: 'busy' }, 503);   // пять раз подряд разошлись — такого на двух телефонах не бывает
  }

  return json({ error: 'method' }, 405);
}

if (import.meta.main) Deno.serve(handle);

export { handle, merge };
