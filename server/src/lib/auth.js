// JWT issuing + role-based access middleware.
//
// Rule 4 in CLAUDE.md: scoping is enforced here and in route handlers using the
// identity on the *token*. A request body may never nominate whose records to
// read. `scopeOf(req)` is the only sanctioned way to learn who is asking.
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './db.js';

const SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
const TTL = '12h';

export const ROLES = { STUDENT: 'student', FACULTY: 'faculty', ADMIN: 'admin' };

export const hash = (plain) => bcrypt.hashSync(plain, 10);
export const verifyPassword = (plain, hashed) => bcrypt.compareSync(plain, hashed);

export function sign(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      name: user.name,
      branch: user.branch ?? null,
      semester: user.semester ?? null,
      department: user.department ?? null,
    },
    SECRET,
    { expiresIn: TTL },
  );
}

export function publicUser(user) {
  const { password, ...rest } = user;
  return rest;
}

export async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const claims = jwt.verify(token, SECRET);
    const user = await db.users.byId(claims.sub);
    if (!user) return res.status(401).json({ error: 'Account no longer exists' });
    req.user = publicUser(user);
    return next();
  } catch {
    return res.status(401).json({ error: 'Session expired — please sign in again' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Your role does not have access to this' });
    }
    return next();
  };
}

// The canonical scope object passed into retrieval and structured lookups.
export async function scopeOf(req) {
  const u = req.user;
  return {
    userId: u.id,
    role: u.role,
    name: u.name,
    branch: u.branch ?? null,
    semester: u.semester ?? null,
    department: u.department ?? null,
    subjectIds: u.role === ROLES.FACULTY
      ? (await db.subjects.find({ facultyId: u.id })).map((s) => s.id)
      : null,
  };
}
