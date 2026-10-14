/* Pruebas aisladas del handler: no se conecta a ninguna base de datos real. */
const assert = require('node:assert/strict');
const Module = require('node:module');
const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const SIGN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let rows = [], profiles = [{ id: ID_A, alias: 'Ana' }, { id: ID_B, alias: 'Ana' }], interpretations = [];
let stored = null, storeAvailable = true, dbError = false, quota = false, writes = 0;
let lastReservedOwner, authCalls = 0;
class Query {
  constructor(table, initial) { this.table = table; this.initial = initial; this.filters = []; this.kind = 'read'; this.start = 0; this.end = 999; }
  select() { return this; }
  eq(key, value) { this.filters.push(row => row[key] === value); return this; }
  neq(key, value) { this.filters.push(row => row[key] !== value); return this; }
  ilike(key, value) { this.filters.push(row => row[key].toLowerCase().includes(value.replace(/%/g, '').toLowerCase())); return this; }
  limit(limit) { this.end = limit - 1; return this; }
  range(start, end) { this.start = start; this.end = end; return this; }
  order() { return this; }
  maybeSingle() { this.singleResult = true; return this; }
  single() { this.singleResult = true; return this; }
  update(value) { this.kind = 'update'; this.value = value; return this; }
  upsert(value) { this.kind = 'upsert'; this.value = value; return this; }
  then(resolve, reject) {
    try {
      if (dbError) return Promise.resolve({ error: { code: '42P01' }, data: null }).then(resolve, reject);
      let source = this.initial || ({ comunidad_senas: rows, comunidad_perfiles: profiles, lsc_interfaz: interpretations }[this.table]);
      let matches = source.filter(row => this.filters.every(fn => fn(row)));
      if (this.kind === 'update') { matches.forEach(row => Object.assign(row, this.value)); writes++; }
      if (this.kind === 'upsert') { const key = this.table === 'lsc_interfaz' ? 'clave' : 'id'; const old = source.find(row => row[key] === this.value[key]); if (old) Object.assign(old, this.value); else source.push(this.value); writes++; }
      const count = matches.length;
      matches = matches.slice(this.start, this.end + 1).map(row => ({ ...row, ...(this.table === 'comunidad_senas' ? { comunidad_perfiles: profiles.find(p => p.id === row.autor_id) } : {}) }));
      return Promise.resolve({ data: this.singleResult ? matches[0] || null : matches, count, error: null }).then(resolve, reject);
    } catch (error) { return Promise.reject(error).then(resolve, reject); }
  }
}
const auth = {
  async getUser(token) { authCalls++; return token === 'memberA' || token === 'memberB' ? { data: { user: { id: token === 'memberA' ? ID_A : ID_B, email_confirmed_at: '2026-01-01', user_metadata: { alias: 'Ana' } } } } : { data: {}, error: new Error('invalid') }; },
  async signInWithPassword({ password }) { return password === 'valid-password' ? { data: { user: { email_confirmed_at: '2026-01-01' }, session: { access_token: 'memberA', refresh_token: 'refreshA' } } } : { error: new Error('invalid') }; },
  async signUp() { return { data: { user: {} } }; },
  async refreshSession() { return { data: { session: { access_token: 'memberA', refresh_token: 'refreshB' } } }; },
  admin: { async signOut() { return {}; } }
};
const sb = {
  auth, from: table => new Query(table),
  rpc(name, params) {
    if (name === 'comunidad_ranking') {
      const counts = profiles.map(profile => ({ autor_id: profile.id, alias: profile.alias, aportes: rows.filter(row => row.autor_id === profile.id && row.estado === 'aprobado').length })).filter(row => row.aportes);
      return Promise.resolve({ data: counts, error: dbError ? { code: '42P01' } : null });
    }
    if (name === 'comunidad_descubrir') return new Query('comunidad_senas', rows.filter(row => row.estado === 'aprobado'));
    if (quota) return Promise.resolve({ error: { message: 'MAX_PENDIENTES' } });
    lastReservedOwner = params.p_autor;
    const row = { id: SIGN, autor_id: params.p_autor, significado: params.p_significado, descripcion: params.p_descripcion, mime: params.p_mime, bytes: params.p_bytes, archivo: `${params.p_autor}/${SIGN}.mp4`, estado: 'borrador', nota_revision: '', creado_en: '2026-10-13' };
    rows.push(row); writes++; return Promise.resolve({ data: row });
  },
  storage: { from(bucket) { assert.equal(bucket, 'ensenas-comunidad'); return {
    async createSignedUploadUrl(path, options) { assert.equal(options.upsert, false); return { data: { signedUrl: `https://storage.example/${path}?token=test` } }; },
    async createSignedUrls(paths) { return { data: paths.map(() => ({ signedUrl: 'https://storage.example/read?token=signed' })) }; },
    async list() { return { data: stored ? [stored] : [] }; }
  }; } }
};
require.cache[require.resolve('../api/db')] = { exports: { getSupabase: () => storeAvailable ? sb : null } };
require.cache[require.resolve('../api/auth')] = { exports: { verifyToken: token => token === 'admin' ? { rol: 'admin' } : null, isAdminUser: user => user?.rol === 'admin' } };
const originalLoad = Module._load;
Module._load = function (name, ...args) { return name === '@supabase/supabase-js' ? { createClient: () => ({ auth }) } : originalLoad.call(this, name, ...args); };
process.env.SUPABASE_URL = 'https://example.supabase.co'; process.env.SUPABASE_ANON_KEY = 'test-public-key';
const handler = require('../api/comunidad');
async function call(action, body, identity, origin) {
  const headers = { host: 'example.test' };
  if (identity === 'admin') headers.authorization = 'Bearer admin';
  else if (identity) headers.cookie = `ensenas_member_access=${identity}`;
  if (origin) headers.origin = origin;
  const req = { method: body ? 'POST' : 'GET', query: { action }, body: body ? { action, ...body } : undefined, headers };
  const response = { code: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  await handler(req, response); return response;
}
(async () => {
  let result = await call('reservar', { significado: 'Hola', descripcion: '', mime: 'video/mp4', bytes: 100, consent: true });
  assert.equal(result.code, 401); assert.equal(writes, 0);
  result = await call('reservar', {}, 'memberA', 'https://evil.test'); assert.equal(result.code, 403);
  result = await call('reservar', { significado: 'Hola', mime: 'video/mp4', bytes: 100, consent: false }, 'memberA'); assert.equal(result.code, 400);
  result = await call('reservar', { significado: 'Hola', mime: 'video/mp4', bytes: 999999999, consent: true }, 'memberA'); assert.equal(result.code, 400);
  quota = true; result = await call('reservar', { significado: 'Hola', mime: 'video/mp4', bytes: 100, consent: true }, 'memberA'); assert.equal(result.code, 429); quota = false;
  result = await call('reservar', { significado: '<img src=x onerror=alert(1)>', descripcion: 'Saludo', mime: 'video/mp4', bytes: 100, consent: true, autor_id: ID_B }, 'memberA');
  assert.equal(result.code, 200); assert.equal(lastReservedOwner, ID_A); assert.ok(result.data.signedUrl); assert.equal(rows[0].estado, 'borrador');
  result = await call('enviar', { id: SIGN }, 'memberB'); assert.equal(result.code, 404);
  result = await call('enviar', { id: SIGN }, 'memberA'); assert.equal(result.code, 409); assert.equal(rows[0].estado, 'borrador');
  stored = { name: `${SIGN}.mp4`, metadata: { size: 99, mimetype: 'video/mp4' } };
  result = await call('enviar', { id: SIGN }, 'memberA'); assert.equal(result.code, 409);
  stored.metadata.size = 100; result = await call('enviar', { id: SIGN }, 'memberA'); assert.equal(result.code, 200); assert.equal(rows[0].estado, 'pendiente');
  const before = writes; result = await call('enviar', { id: SIGN }, 'memberA'); assert.equal(result.code, 200); assert.equal(writes, before);
  result = await call('senas'); assert.equal(result.data.items.length, 0);
  result = await call('moderacion'); assert.equal(result.code, 403);
  result = await call('revisar', { id: SIGN, estado: 'aprobado' }, 'memberA'); assert.equal(result.code, 403);
  result = await call('revisar', { id: SIGN, estado: 'aprobado' }, 'admin'); assert.equal(result.code, 200);
  result = await call('ranking'); assert.deepEqual(result.data.items, [{ autor_id: ID_A, alias: 'Ana', aportes: 1 }]);
  await call('revisar', { id: SIGN, estado: 'aprobado' }, 'admin'); result = await call('ranking'); assert.equal(result.data.items[0].aportes, 1);
  result = await call('senas'); assert.equal(result.data.items.length, 1); assert.equal(result.data.items[0].archivo, undefined); assert.equal(result.data.items[0].nota_revision, undefined); assert.ok(result.data.items[0].video_url);
  result = await call('descubrir'); assert.equal(result.data.items.length, 1);
  result = await call('revisar', { id: SIGN, estado: 'rechazado', nota: '' }, 'admin'); assert.equal(result.code, 400);
  await call('revisar', { id: SIGN, estado: 'rechazado', nota: 'Revisar significado' }, 'admin');
  result = await call('ranking'); assert.equal(result.data.items.length, 0); result = await call('senas'); assert.equal(result.data.items.length, 0);
  result = await call('interpretacion', { clave: 'nav.catalogo', etiqueta: 'Catálogo', video_url: 'https://media.example/video.mp4' }, 'memberA'); assert.equal(result.code, 403);
  result = await call('interpretacion', { clave: 'nav.catalogo', etiqueta: 'Catálogo', video_url: 'javascript:alert(1)' }, 'admin'); assert.equal(result.code, 400);
  result = await call('interpretacion', { clave: 'nav.catalogo', etiqueta: 'Catálogo', video_url: 'https://media.example/video.mp4' }, 'admin'); assert.equal(result.code, 200);
  result = await call('interpretaciones'); assert.equal(result.data.items.length, 1);
  result = await call('login', { email: 'ana@example.test', password: 'valid-password' }); assert.equal(result.code, 200); assert.ok(result.headers['Set-Cookie'].every(value => value.includes('HttpOnly') && value.includes('SameSite=Lax'))); assert.equal(result.data.access_token, undefined);
  result = await call('login', { email: 'ana@example.test', password: 'invalid-password' }); assert.equal(result.code, 401);
  result = await call('sesion', undefined, 'forged'); assert.equal(result.code, 401); assert.ok(authCalls > 0);
  result = await call('logout', {}, 'memberA'); assert.ok(result.headers['Set-Cookie'].every(value => value.includes('Max-Age=0')));
  dbError = true; result = await call('senas'); assert.equal(result.code, 503); assert.equal(result.data.success, false); dbError = false;
  storeAvailable = false; result = await call('ranking'); assert.equal(result.code, 503);
  console.log('OK: permisos, identidad verificada, cuota, subida incompleta, confirmación idempotente, moderación, ranking, privacidad, cookies y fallos persistentes. No se utilizó una base real.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { Module._load = originalLoad; });
