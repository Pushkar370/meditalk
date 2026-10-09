import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config();

const KNOWN_WEAK = new Set([
  'meditalk_dev_secret_2026',
  'secret',
  'jwt_secret',
  'changeme',
  'password',
  '12345678',
  'supersecret',
  'defaultsecret',
]);

let fallbackSecret = null;

export function getValidatedJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || !secret.trim()) {
    if (!fallbackSecret) {
      fallbackSecret = crypto.randomBytes(32).toString('hex');
      console.warn('⚠️ [Auth Warning] JWT_SECRET environment variable is missing.');
      console.warn('   Generated a secure random 256-bit secret for this process session.');
      console.warn('   To persist user sessions across server reboots, set JWT_SECRET in your environment.');
    }
    return fallbackSecret;
  }

  const clean = secret.trim();
  if (KNOWN_WEAK.has(clean.toLowerCase()) || clean.length < 32) {
    console.warn('⚠️ [Auth Warning] JWT_SECRET is weaker than recommended (under 32 chars or a known default).');
    console.warn('   For maximum security in production, set a 64-character secret generated with:');
    console.warn('   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    // Allow boot with the configured secret instead of halting deploy with process.exit(1)
    return clean;
  }

  return clean;
}

export const JWT_SECRET = getValidatedJwtSecret();
