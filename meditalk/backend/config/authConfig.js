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

export function getValidatedJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || !secret.trim()) {
    console.error('❌ FATAL: JWT_SECRET environment variable is missing.');
    console.error('   The server refuses to start without a valid JWT_SECRET.');
    console.error('   Generate a strong secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
  }
  const clean = secret.trim();
  if (KNOWN_WEAK.has(clean.toLowerCase()) || clean.length < 32) {
    console.error('❌ FATAL: JWT_SECRET is too weak (must be at least 32 characters and not a known default string).');
    console.error('   The server refuses to start with an insecure secret.');
    console.error('   Generate a strong secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
  }
  return clean;
}

export const JWT_SECRET = getValidatedJwtSecret();
