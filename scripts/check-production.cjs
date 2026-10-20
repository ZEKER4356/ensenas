/* Solo GET/HEAD públicos. No inicia sesiones ni publica/modifica datos reales. */
const assert = require('node:assert/strict');
const ORIGIN = new URL(process.env.ENSENAS_PRODUCTION_URL || 'https://ensenas.vercel.app').origin;
const failures = [];
async function request(url, options) {
  const response = await fetch(new URL(url, ORIGIN), { signal: AbortSignal.timeout(20000), ...options });
  assert.equal(new URL(response.url).origin, new URL(url, ORIGIN).origin, 'Redirección inesperada fuera del sitio');
  return response;
}
async function check(name, action) {
  try { await action(); console.log('OK: ' + name); }
  catch (error) { failures.push(name); console.error('FALLO: ' + name + ' — ' + error.message); }
}
async function json(action, status = 200) {
  const response = await request('/api/comunidad?action=' + action);
  assert.equal(response.status, status); assert.match(response.headers.get('content-type') || '', /application\/json/);
  return response.json();
}
(async () => {
  await check('landing y vista previa del enlace con logo', async () => {
    const response = await request('/'); assert.equal(response.status, 200);
    const html = await response.text(); assert.match(html, /id="welcome-video-backdrop"/);
    const image = /property="og:image" content="([^"]+)"/.exec(html)?.[1]; assert.ok(image);
    assert.equal(new URL(image).origin, ORIGIN);
    const asset = await request(image); assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type') || '', /image\/jpeg/);
    const bytes = new Uint8Array(await asset.arrayBuffer());
    assert.ok(bytes.length < 300 * 1024 && bytes[0] === 255 && bytes[1] === 216);
  });
  await Promise.all(['catalogo', 'sube-tu-sena', 'comunidad', 'leaderboard', 'colaboradores', 'admin', 'objeto?id=microbit'].map(page => check('página ' + page, async () => {
    const response = await request('/' + page); assert.equal(response.status, 200);
    const html = await response.text(); assert.match(html, /<html lang="es"/); assert.ok(!html.includes('<title>404'));
  })));
  await check('configuración pública de Google para producción', async () => {
    const config = await json('config'); assert.equal(config.success, true); assert.equal(config.google, true);
    assert.equal(config.app_url, ORIGIN, 'PUBLIC_APP_URL debe coincidir con el dominio público');
    assert.equal(config.email_signup, false, 'Mantener correo/contraseña cerrado mientras no haya SMTP');
  });
  await check('equipo, crédito del intérprete y curso de Bloque 10', async () => {
    const team = await (await request('/colaboradores')).text();
    assert.match(team, /id="pillars-title">Pilares/);
    assert.match(team, /id="developers-title">Desarrolladores/);
    const portraits = [...team.matchAll(/src="(assets\/images\/equipo\/[^\"]+\.webp)"/g)].map(match => match[1]);
    assert.equal(portraits.length, 8);
    await Promise.all([...portraits, 'assets/images/curso-lsc-cultura-sorda.webp'].map(async image => {
      const response = await request('/' + image); assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') || '', /image\/webp/);
      assert.ok((await response.arrayBuffer()).byteLength > 1000);
    }));
    const landing = await (await request('/')).text();
    assert.match(landing, /Profesor Edward Ignacio Rojas Díaz/);
    const navigation = await (await request('/assets/js/site-navigation.js')).text();
    assert.match(navigation, /https:\/\/bloque10\.unimagdalena\.edu\.co\/courses\/lsc-y-cultura-sorda\//);
    assert.match(navigation, /site-course-inline/);
  });
  await check('catálogo y recursos de objetos', async () => {
    const response = await request('/api/objetos'); assert.equal(response.status, 200);
    const objects = await response.json(); assert.ok(Array.isArray(objects) && objects.length > 0);
    for (const item of objects.filter(item => item.activo !== false)) {
      for (const key of ['modelo_3d_url', 'archivo_audio_url', 'video_lsc_url']) {
        if (!item[key]) continue;
        const resource = await request(item[key], { method: 'HEAD' });
        assert.equal(resource.status, 200, `Recurso ${key} de ${item.id} no disponible`);
      }
    }
  });
  await check('videos de navegación', async () => {
    const data = await json('interpretaciones'); assert.equal(data.success, true);
    for (const key of ['nav.catalogo', 'nav.sube-tu-sena', 'nav.comunidad', 'nav.leaderboard', 'nav.equipo']) {
      const source = data.items.find(row => row.clave === key); assert.ok(source?.video_url, 'Falta ' + key);
      const response = await request(source.video_url, { method: 'HEAD' }); assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') || '', /video\//);
    }
  });
  await check('comunidad pública y clasificación', async () => {
    for (const action of ['senas', 'ranking']) { const data = await json(action); assert.equal(data.success, true); assert.ok(Array.isArray(data.items)); }
  });
  await check('privacidad de sesión y revisión administrativa', async () => {
    await json('sesion', 401);
    const response = await request('/api/comunidad?action=moderacion'); assert.ok([401, 403].includes(response.status));
  });
  if (failures.length) { console.error(`${failures.length} comprobación(es) pendiente(s).`); process.exitCode = 1; }
  else console.log('Producción comprobada por HTTP. Falta la prueba humana de entrada Google y cámara/RA en dispositivo físico.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
