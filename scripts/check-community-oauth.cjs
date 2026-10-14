/* SDK real de Supabase + HTTP simulado: nunca conecta con Google ni una base real. */
const assert = require('node:assert/strict');
const Module = require('node:module');
const crypto = require('node:crypto');
const { createClient } = require(require.resolve('@supabase/supabase-js', { paths: [process.env.ENSENAS_AUTH_PACKAGES || process.cwd()] }));
const ORIGIN = 'https://ensenas.example.test';
const ID = '33333333-3333-4333-8333-333333333333';
process.env.SUPABASE_URL = 'https://test-project.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.PUBLIC_APP_URL = ORIGIN;
process.env.JWT_SECRET = 'test-only-not-a-real-secret-at-least-32-chars';
process.env.NODE_ENV = 'production';
delete process.env.COMMUNITY_EMAIL_SIGNUP_ENABLED;
const profiles = [];
let challenge, used = false, verified = true, tokenCalls = 0;
const user = { id: ID, email: 'private@example.test', email_confirmed_at: '2026-10-14', user_metadata: { full_name: 'Private Google name' }, identities: [{ provider: 'google' }] };
const originalFetch = global.fetch;
global.fetch = async (input, options) => {
  const url = new URL(input);
  assert.equal(url.origin, process.env.SUPABASE_URL);
  assert.equal(url.pathname, '/auth/v1/token');
  assert.equal(url.searchParams.get('grant_type'), 'pkce');
  const body = JSON.parse(options.body); tokenCalls++;
  const valid = body.auth_code === 'single-use-code' && !used && crypto.createHash('sha256').update(body.code_verifier).digest('base64url') === challenge;
  if (!valid) return new Response(JSON.stringify({ error: 'invalid_grant', msg: 'Invalid code' }), { status: 400 });
  used = true;
  return new Response(JSON.stringify({ access_token: 'verified-access', refresh_token: 'verified-refresh', token_type: 'bearer', expires_in: 3600, user }), { status: 200 });
};
const sb = {
  auth: { async getUser(token) { assert.equal(token, 'verified-access'); return verified ? { data: { user } } : { data: {}, error: new Error('invalid') }; } },
  from(table) {
    assert.equal(table, 'comunidad_perfiles');
    return {
      select() { return this; }, eq() { return this; },
      async maybeSingle() { return { data: profiles[0] || null }; },
      async upsert(value) { profiles.push(value); return { data: null }; }
    };
  }
};
require.cache[require.resolve('../api/db')] = { exports: { getSupabase: () => sb } };
require.cache[require.resolve('../api/auth')] = { exports: { verifyToken: () => null, isAdminUser: () => false } };
const originalLoad = Module._load;
Module._load = function(name, ...args) { return name === '@supabase/supabase-js' ? { createClient } : originalLoad.call(this, name, ...args); };
const handler = require('../api/comunidad');
async function call(action, body, cookie, query = {}, host = 'ensenas.example.test', origin) {
  const req = { method: body ? 'POST' : 'GET', query: { action, ...query }, body: body ? { action, ...body } : undefined, headers: { host, cookie, ...(origin ? { origin } : {}) } };
  const res = { code: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, getHeader(key) { return this.headers[key]; }, status(code) { this.code = code; return this; }, json(data) { this.data = data; }, end() {} };
  await handler(req, res); return res;
}
function cookieOf(res) { return res.headers['Set-Cookie'].find(value => value.startsWith('ensenas_member_oauth=')).split(';')[0]; }
async function begin() {
  used = false;
  const res = await call('google', { alias: 'Mi alias', consent: true }, undefined, {}, undefined, ORIGIN);
  assert.equal(res.code, 200);
  const url = new URL(res.data.url);
  assert.equal(url.origin, process.env.SUPABASE_URL);
  assert.equal(url.searchParams.get('provider'), 'google');
  assert.equal(url.searchParams.get('redirect_to'), `${ORIGIN}/api/comunidad?action=google-callback`);
  assert.equal(url.searchParams.get('code_challenge_method'), 's256');
  challenge = url.searchParams.get('code_challenge'); assert.ok(challenge);
  assert.ok(res.headers['Set-Cookie'][0].includes('HttpOnly; SameSite=Lax'));
  assert.ok(res.headers['Set-Cookie'][0].includes('; Secure'));
  return cookieOf(res);
}
(async () => {
  let res = await call('config'); assert.equal(res.data.google, true); assert.equal(res.data.email_signup, false);
  res = await call('registro', { email: 'user@example.test', password: 'valid-password', alias: 'Alias', consent: true }); assert.equal(res.code, 503);
  res = await call('google', { alias: 'Alias', consent: false }); assert.equal(res.code, 400);
  res = await call('google', { alias: 'Alias', consent: true }, undefined, {}, undefined, 'https://evil.test'); assert.equal(res.code, 403);
  res = await call('google', { alias: 'Alias', consent: true }, undefined, {}, 'other-preview.vercel.app'); assert.equal(res.code, 400);
  let cookie = await begin();
  res = await call('google-callback', null, undefined, { code: 'single-use-code' });
  assert.equal(res.code, 303); assert.match(res.headers.Location, /google-error/); assert.equal(tokenCalls, 0);
  res = await call('google-callback', null, cookie + 'tampered', { code: 'single-use-code' }); assert.match(res.headers.Location, /google-error/); assert.equal(tokenCalls, 0);
  res = await call('google-callback', null, cookie, { error: 'access_denied' }); assert.match(res.headers.Location, /google-error/); assert.equal(tokenCalls, 0);
  const savedNow = Date.now; Date.now = () => savedNow() + 700000;
  res = await call('google-callback', null, cookie, { code: 'single-use-code' }); Date.now = savedNow;
  assert.match(res.headers.Location, /google-error/); assert.equal(tokenCalls, 0);
  res = await call('google-callback', null, cookie, { code: 'single-use-code' });
  assert.equal(res.code, 303); assert.equal(res.headers.Location, '/sube-tu-sena?acceso=google-ok');
  assert.deepEqual(profiles, [{ id: ID, alias: 'Mi alias' }]);
  assert.equal(res.headers['Set-Cookie'].length, 3, 'Borra estado PKCE y crea las dos cookies de sesión');
  assert.ok(res.headers['Set-Cookie'][0].includes('Max-Age=0'));
  assert.ok(res.headers['Set-Cookie'].slice(1).every(value => value.includes('HttpOnly') && value.includes('Secure')));
  assert.equal(res.data, undefined, 'No entrega tokens a JS');
  res = await call('google-callback', null, cookie, { code: 'single-use-code' }); assert.match(res.headers.Location, /google-error/, 'No se reutiliza el código');
  cookie = await begin(); verified = false;
  res = await call('google-callback', null, cookie, { code: 'single-use-code' }); assert.match(res.headers.Location, /google-error/); assert.equal(res.headers['Set-Cookie'].length, 1);
  verified = true; cookie = await begin();
  res = await call('google-callback', null, cookie, { code: 'single-use-code' }); assert.match(res.headers.Location, /google-ok/); assert.equal(profiles.length, 1, 'Conserva perfil al reingresar');
  process.env.COMMUNITY_GOOGLE_AUTH_ENABLED = 'false';
  res = await call('google', { alias: 'Alias', consent: true }); assert.equal(res.code, 503);
  console.log('OK: SDK Supabase real (PKCE), identidad, alias privado, cookies, cancelación, caducidad, manipulación, origen, reutilización y registro por correo desactivado. HTTP simulado, sin Google/base reales.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { Module._load = originalLoad; global.fetch = originalFetch; });
