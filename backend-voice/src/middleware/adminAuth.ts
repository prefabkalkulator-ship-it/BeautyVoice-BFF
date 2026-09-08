import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const SUPERADMIN_SECRET = process.env.SUPERADMIN_SECRET || 'bv_sec_98f4a7c1b2e3d4f5a6b7c8d9e0f1a2b3';
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dni ważności sesji

/**
 * Generuje bezpieczny podpisany kryptograficznie token dla zalogowanego SuperAdmina.
 */
export function createAdminToken(): string {
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac('sha256', SUPERADMIN_SECRET)
    .update(`admin:${timestamp}`)
    .digest('hex');
  
  return `${timestamp}.${signature}`;
}

/**
 * Weryfikuje podpis i czas ważności tokenu SuperAdmina.
 */
export function verifyAdminToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [timestampStr, signature] = parts;
  const timestamp = parseInt(timestampStr, 10);

  if (isNaN(timestamp)) return false;

  // Sprawdzenie czy token nie wygasł (7 dni)
  const now = Date.now();
  if (now < timestamp || now - timestamp > TOKEN_MAX_AGE_MS) {
    return false;
  }

  // Obliczenie oczekiwanego podpisu HMAC
  const expectedSignature = crypto
    .createHmac('sha256', SUPERADMIN_SECRET)
    .update(`admin:${timestampStr}`)
    .digest('hex');

  // Porównanie odporne na ataki czasowe (timing attacks)
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  } catch {
    return false;
  }
}

/**
 * Express Middleware zabezpieczający trasy administracyjne.
 */
export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-admin-token']) {
    token = String(req.headers['x-admin-token']).trim();
  }

  // Opcjonalny fallback dla skryptów developerskich / CLI
  const directPin = req.headers['x-admin-pin'];
  const configuredPin = process.env.SUPERADMIN_PIN || '5742';
  if (directPin && directPin === configuredPin) {
    return next();
  }

  if (token && verifyAdminToken(token)) {
    return next();
  }

  return res.status(401).json({
    error: 'Brak autoryzacji SuperAdmina. Sesja wygasła lub podano nieprawidłowy token.'
  });
}
