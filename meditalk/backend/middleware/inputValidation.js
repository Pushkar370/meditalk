/**
 * Input Size & Depth Enforcement Middleware
 * Protects against unbounded payloads, memory bloat, and ReDoS/CPU attacks.
 */

export const FIELD_LIMITS = {
  email: 255,
  name: 200,
  patientName: 200,
  doctorName: 200,
  phone: 30,
  password: 128,
  specialty: 100,
  type: 100,
  date: 30,
  time: 30,
  reason: 1000,
  symptoms: 5000,
  diagnosis: 2000,
  treatmentPlan: 5000,
  notes: 10000,
  instructions: 5000,
  message: 5000,
  customText: 2000,
  status: 50,
};

export function validateInputSizes(req, res, next) {
  if (!req.body || typeof req.body !== 'object') return next();

  const stack = [{ obj: req.body, prefix: '' }];
  while (stack.length > 0) {
    const { obj, prefix } = stack.pop();
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string') {
        // Special case: fileData base64 attachments in medical records OCR
        if (key === 'fileData' || key === 'base64') continue;

        const limit = FIELD_LIMITS[key] || 15000;
        if (val.length > limit) {
          return res.status(400).json({
            error: `Input validation failed: field '${prefix}${key}' exceeds maximum permitted length of ${limit} characters.`,
            field: `${prefix}${key}`,
            maxLength: limit,
            currentLength: val.length,
          });
        }
      } else if (val && typeof val === 'object' && !Array.isArray(val)) {
        stack.push({ obj: val, prefix: `${prefix}${key}.` });
      } else if (Array.isArray(val)) {
        if (val.length > 100) {
          return res.status(400).json({
            error: `Input validation failed: array '${prefix}${key}' exceeds maximum permitted limit of 100 items.`,
          });
        }
        for (let i = 0; i < val.length; i++) {
          if (val[i] && typeof val[i] === 'object') {
            stack.push({ obj: val[i], prefix: `${prefix}${key}[${i}].` });
          } else if (typeof val[i] === 'string' && val[i].length > 5000) {
            return res.status(400).json({
              error: `Input validation failed: item in array '${prefix}${key}' exceeds maximum length of 5000 characters.`,
            });
          }
        }
      }
    }
  }

  next();
}
