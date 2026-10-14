/* Comunidad y LSC: cuentas independientes del panel Admin, videos privados. */
const { getSupabase } = require('./db');
const { verifyToken, isAdminUser } = require('./auth');
const MAX_BYTES = 25 * 1024 * 1024;
const BUCKET = 'ensenas-comunidad';
const MIMES = ['video/mp4', 'video/webm', 'video/quicktime'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function checked(result) {
  if (result.error) {
    if (/MAX_PENDIENTES|MAX_DIARIO/.test(result.error.message || '')) fail(429, 'Llegaste al límite: 5 aportes pendientes y 10 intentos diarios. Espera una revisión o inténtalo mañana.');
    console.error('Comunidad: operación persistente fallida', result.error.code || result.error.status || 'sin código');
    fail(503, 'No se pudo completar la operación. Comprueba la configuración de Comunidad en Supabase e inténtalo de nuevo.');
  }
  return result.data;
}
function text(value, min, max) {
  if (typeof value !== 'string') fail(400, 'Revisa los campos del formulario.');
  const clean = value.trim();
  if (clean.length < min || clean.length > max) fail(400, `El texto debe tener entre ${min} y ${max} caracteres.`);
  return clean;
}
function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0) out[part.slice(0, index).trim()] = part.slice(index + 1).trim();
  }
  return out;
}
function setSession(req, res, session) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', [
    `ensenas_member_access=${session?.access_token || ''}; HttpOnly; SameSite=Lax; Path=/api/comunidad; Max-Age=${session ? 3600 : 0}${secure}`,
    `ensenas_member_refresh=${session?.refresh_token || ''}; HttpOnly; SameSite=Lax; Path=/api/comunidad; Max-Age=${session ? 604800 : 0}${secure}`
  ]);
}
function authClient() {
  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) fail(503, 'Falta configurar Supabase Auth para la comunidad.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
async function member(sb, req, res) {
  const jar = cookies(req);
  let result = jar.ensenas_member_access ? await sb.auth.getUser(jar.ensenas_member_access) : null;
  if ((!result || result.error) && jar.ensenas_member_refresh) {
    const refreshed = await authClient().auth.refreshSession({ refresh_token: jar.ensenas_member_refresh });
    if (!refreshed.error && refreshed.data.session) {
      setSession(req, res, refreshed.data.session);
      result = await sb.auth.getUser(refreshed.data.session.access_token);
    }
  }
  const user = result?.data?.user;
  if (!user || result.error || !user.email_confirmed_at) fail(401, 'Inicia sesión con tu correo confirmado para participar.');
  // La identidad sale de Auth, no de un autor_id enviado por el navegador.
  let profile = checked(await sb.from('comunidad_perfiles').select('id,alias').eq('id', user.id).maybeSingle());
  if (!profile) {
    const alias = text(user.user_metadata?.alias || 'Participante', 2, 40);
    checked(await sb.from('comunidad_perfiles').upsert({ id: user.id, alias }, { onConflict: 'id', ignoreDuplicates: true }));
    profile = checked(await sb.from('comunidad_perfiles').select('id,alias').eq('id', user.id).single());
  }
  return profile;
}
function admin(req) {
  const user = verifyToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  if (!user || !isAdminUser(user)) fail(403, 'Solo el equipo administrador puede revisar y publicar contenido.');
  return user;
}
async function present(sb, rows, privateView = false) {
  if (!rows?.length) return [];
  const urls = checked(await sb.storage.from(BUCKET).createSignedUrls(rows.map(row => row.archivo), 3600));
  return rows.map((row, index) => ({
    id: row.id, significado: row.significado, descripcion: row.descripcion,
    autor: row.comunidad_perfiles?.alias || 'Participante', autor_id: row.autor_id,
    creado_en: row.creado_en, video_url: urls[index]?.signedUrl || null,
    ...(privateView ? { estado: row.estado, nota_revision: row.nota_revision } : {})
  }));
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); fail(405, 'Método no permitido.'); }
    if (req.method === 'POST' && req.headers.origin) {
      const origin = new URL(req.headers.origin);
      if (origin.host !== req.headers.host) fail(403, 'La solicitud debe enviarse desde EnSeñas.');
    }
    const sb = getSupabase();
    if (!sb) fail(503, 'Comunidad todavía no está configurada en Supabase.');
    const body = req.body || {};
    const action = req.method === 'GET' ? req.query?.action : body.action;
    if (req.method === 'GET') {
      if (action === 'interpretaciones') {
        const data = checked(await sb.from('lsc_interfaz').select('clave,etiqueta,video_url').eq('activo', true).limit(500));
        return res.json({ success: true, items: data });
      }
      if (action === 'interpretaciones-admin') {
        admin(req);
        return res.json({ success: true, items: checked(await sb.from('lsc_interfaz').select('*').order('clave').limit(500)) });
      }
      if (action === 'ranking') return res.json({ success: true, items: checked(await sb.rpc('comunidad_ranking')) });
      if (action === 'descubrir') {
        const rows = checked(await sb.rpc('comunidad_descubrir').select('*,comunidad_perfiles(alias)'));
        return res.json({ success: true, items: await present(sb, rows) });
      }
      if (action === 'sesion') return res.json({ success: true, user: await member(sb, req, res) });
      let query = sb.from('comunidad_senas').select('*,comunidad_perfiles(alias)', { count: 'exact' });
      if (action === 'mis-senas') {
        const user = await member(sb, req, res);
        query = query.eq('autor_id', user.id);
      } else if (action === 'moderacion') {
        admin(req);
        const state = ['pendiente', 'aprobado', 'rechazado'].includes(req.query.estado) ? req.query.estado : 'pendiente';
        query = query.eq('estado', state);
      } else if (action === 'senas') {
        query = query.eq('estado', 'aprobado');
        const search = String(req.query.q || '').trim().slice(0, 100).replace(/[%_\\]/g, '');
        if (search) query = query.ilike('significado', `%${search}%`);
      } else fail(400, 'Acción desconocida.');
      const page = Math.min(1000, Math.max(0, parseInt(req.query.page, 10) || 0));
      const result = await query.order('creado_en', { ascending: false }).range(page * 24, page * 24 + 23);
      const rows = checked(result);
      return res.json({ success: true, items: await present(sb, rows, action !== 'senas'), more: (page + 1) * 24 < result.count });
    }
    if (action === 'registro' || action === 'login') {
      const email = text(body.email, 5, 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Escribe un correo válido.');
      const password = typeof body.password === 'string' ? body.password : '';
      if (password.length < 10 || password.length > 128) fail(400, 'Usa una contraseña de 10 a 128 caracteres.');
      const client = authClient();
      if (action === 'registro') {
        if (body.consent !== true) fail(400, 'Debes aceptar las condiciones de participación.');
        const alias = text(body.alias, 2, 40);
        const options = { data: { alias } };
        if (process.env.PUBLIC_APP_URL) options.emailRedirectTo = `${process.env.PUBLIC_APP_URL.replace(/\/$/, '')}/sube-tu-sena`;
        const result = await client.auth.signUp({ email, password, options });
        if (result.error) fail(result.error.status === 429 ? 429 : 400, 'No se pudo crear la cuenta. Revisa los datos o espera antes de volver a intentarlo.');
        return res.json({ success: true, message: 'Revisa tu correo para confirmar la cuenta. Después vuelve e inicia sesión. Si ya tienes cuenta, entra con tu contraseña.' });
      }
      const result = await client.auth.signInWithPassword({ email, password });
      if (result.error || !result.data.user?.email_confirmed_at) fail(401, 'Correo o contraseña incorrectos, o correo pendiente de confirmar.');
      setSession(req, res, result.data.session);
      return res.json({ success: true });
    }
    if (action === 'logout') {
      const token = cookies(req).ensenas_member_access;
      if (token) await sb.auth.admin.signOut(token, 'local');
      setSession(req, res, null);
      return res.json({ success: true });
    }
    if (action === 'reservar') {
      const user = await member(sb, req, res);
      const significado = text(body.significado, 2, 100);
      const descripcion = text(body.descripcion || '', 0, 500);
      if (body.consent !== true) fail(400, 'Autoriza la revisión y publicación de tu aporte.');
      if (!MIMES.includes(body.mime) || !Number.isSafeInteger(body.bytes) || body.bytes < 1 || body.bytes > MAX_BYTES) fail(400, 'Selecciona MP4, WebM o MOV de hasta 25 MB.');
      let row = checked(await sb.rpc('comunidad_reservar', { p_autor: user.id, p_significado: significado, p_descripcion: descripcion, p_mime: body.mime, p_bytes: body.bytes }));
      if (Array.isArray(row)) row = row[0];
      const upload = await sb.storage.from(BUCKET).createSignedUploadUrl(row.archivo, { upsert: false });
      const slot = checked(upload);
      return res.json({ success: true, id: row.id, signedUrl: slot.signedUrl });
    }
    if (action === 'enviar') {
      const user = await member(sb, req, res);
      if (!UUID.test(body.id || '')) fail(400, 'Aporte inválido.');
      const row = checked(await sb.from('comunidad_senas').select('*').eq('id', body.id).eq('autor_id', user.id).maybeSingle());
      if (!row) fail(404, 'No se encontró tu aporte.');
      if (row.estado !== 'borrador') return res.json({ success: true, estado: row.estado });
      const [folder, filename] = row.archivo.split('/');
      const files = checked(await sb.storage.from(BUCKET).list(folder, { search: filename, limit: 10 }));
      const file = files.find(item => item.name === filename);
      if (!file || Number(file.metadata?.size) !== Number(row.bytes) || file.metadata?.mimetype !== row.mime) fail(409, 'El video aún no se ha guardado completo o no coincide con el archivo seleccionado. Reintenta la subida.');
      checked(await sb.from('comunidad_senas').update({ estado: 'pendiente' }).eq('id', row.id).eq('autor_id', user.id).eq('estado', 'borrador'));
      return res.json({ success: true, estado: 'pendiente' });
    }
    if (action === 'revisar') {
      admin(req);
      if (!UUID.test(body.id || '') || !['aprobado', 'rechazado'].includes(body.estado)) fail(400, 'Revisión inválida.');
      const nota = text(body.nota || '', body.estado === 'rechazado' ? 3 : 0, 500);
      const row = checked(await sb.from('comunidad_senas').select('estado').eq('id', body.id).maybeSingle());
      if (!row || row.estado === 'borrador') fail(404, 'Aporte no enviado.');
      checked(await sb.from('comunidad_senas').update({ estado: body.estado, nota_revision: nota, revisado_en: new Date().toISOString() }).eq('id', body.id).neq('estado', 'borrador'));
      return res.json({ success: true });
    }
    if (action === 'interpretacion') {
      admin(req);
      const clave = text(body.clave, 1, 100);
      if (!/^[a-z0-9_.-]+$/.test(clave)) fail(400, 'Usa una clave válida, por ejemplo nav.catalogo.');
      const etiqueta = text(body.etiqueta, 2, 160);
      const video_url = text(body.video_url, 1, 2000);
      let url;
      try { url = new URL(video_url); } catch (_) { fail(400, 'Usa la URL HTTPS del video.'); }
      if (url.protocol !== 'https:' || url.username || url.password) fail(400, 'Usa una URL HTTPS sin credenciales.');
      checked(await sb.from('lsc_interfaz').upsert({ clave, etiqueta, video_url, activo: body.activo !== false, actualizado_en: new Date().toISOString() }));
      return res.json({ success: true });
    }
    fail(400, 'Acción desconocida.');
  } catch (error) {
    if (!error.status) console.error('Comunidad: error inesperado', error.name);
    res.status(error.status || 503).json({ success: false, error: error.status ? error.message : 'Comunidad no está disponible en este momento. Inténtalo de nuevo.' });
  }
};
