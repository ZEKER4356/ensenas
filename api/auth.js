/**
 * api/auth.js - Servicio de autenticación y sesiones de administración
 * compatible con Serverless Vercel
 */

const crypto = require('crypto');
const { getPgPool } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'ensenas_jwt_secret_key_2026_educacion_inclusiva_secure';
const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_DEFAULT_EMAIL || 'admin@ensenas.edu.co';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'EnsenasAdmin2026!';

/**
 * Generar Token JWT seguro
 */
function createToken(payload) {
  try {
    const jwt = require('jsonwebtoken');
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  } catch (e) {
    // Fallback HMAC-SHA256 si jsonwebtoken no está instalado
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + (7 * 86400) })).toString('base64url');
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
  }
}

/**
 * Verificar Token JWT
 */
function verifyToken(token) {
  if (!token) return null;
  try {
    const jwt = require('jsonwebtoken');
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    // Verificación manual fallback HMAC
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;

    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
      return payload;
    } catch {
      return null;
    }
  }
}

/**
 * Validar credenciales de usuario contra PostgreSQL o credenciales maestras
 */
async function authenticateUser(email, password) {
  if (!email || !password) return null;

  // 1. Validar contra base de datos PostgreSQL si está conectada
  const pool = getPgPool();
  if (pool) {
    try {
      const res = await pool.query(
        'SELECT id, email, password_hash, nombre, rol, activo FROM administradores WHERE email = $1 AND activo = true LIMIT 1',
        [email.toLowerCase().trim()]
      );
      if (res.rows.length > 0) {
        const user = res.rows[0];
        let match = false;
        try {
          const bcrypt = require('bcryptjs');
          match = await bcrypt.compare(password, user.password_hash);
        } catch {
          match = user.password_hash === password;
        }

        if (match) {
          await pool.query('UPDATE administradores SET ultimo_acceso = NOW() WHERE id = $1', [user.id]);
          return {
            id: user.id,
            email: user.email,
            nombre: user.nombre,
            rol: user.rol
          };
        }
      }
    } catch (err) {
      console.warn('Error en auth de PostgreSQL:', err.message);
    }
  }

  // 2. Validar contra credenciales de entorno o predeterminadas
  if (
    email.toLowerCase().trim() === DEFAULT_ADMIN_EMAIL.toLowerCase().trim() &&
    password === DEFAULT_ADMIN_PASSWORD
  ) {
    return {
      id: '00000000-0000-0000-0000-000000000001',
      email: DEFAULT_ADMIN_EMAIL,
      nombre: 'Administrador enseñas',
      rol: 'superadmin'
    };
  }

  return null;
}

/**
 * Handler Serverless Vercel
 */
module.exports = async function handler(req, res) {
  // Manejo de CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = req.query.action || (req.body && req.body.action) || (req.url && req.url.includes('/login') ? 'login' : 'verify');

  if (req.method === 'POST' && (action === 'login' || !req.query.action)) {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Debes ingresar email y contraseña.' });
    }

    const user = await authenticateUser(email, password);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu correo y contraseña.' });
    }

    const token = createToken({
      sub: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol
    });

    return res.status(200).json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      user
    });
  }

  // Verificación de token
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '') || req.query.token;

  if (!token) {
    return res.status(401).json({ authenticated: false, error: 'Token no proporcionado.' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ authenticated: false, error: 'Token expirado o inválido.' });
  }

  return res.status(200).json({
    authenticated: true,
    user: {
      id: decoded.sub,
      email: decoded.email,
      nombre: decoded.nombre,
      rol: decoded.rol
    }
  });
};

module.exports.verifyToken = verifyToken;
