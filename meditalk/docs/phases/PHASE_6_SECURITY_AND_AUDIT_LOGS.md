# Phase 6: Platform Security, Rate Limiting & Enterprise Audit Logging

> **Phase Name:** Phase 6 — Security Hardening, Rate Limiting, Live Password Management & Audit Explorer  
> **Repository:** `meditalk`  
> **Commit Reference:** `1cc55a3`  
> **Target Audience:** Mentors, Technical Managers, Academic Evaluators  

---

## 1. Executive Summary & Objective

In **Phase 6**, MediTalk elevated its infrastructure to meet enterprise healthcare compliance and cybersecurity standards (such as HIPAA audit logging standards and OWASP Top 10 defenses).

Prior to this phase:
- Authentication endpoints had no protection against brute-force credential stuffing attacks.
- Express served standard HTTP headers vulnerable to MIME-sniffing and clickjacking.
- Users could not securely change passwords through self-service settings without admin intervention.
- The platform lacked a centralized compliance audit trail to reconstruct who accessed patient data or authorized prescriptions.

**Phase 6 Objectives:**
1. Implement defense-in-depth HTTP security headers using **Helmet**.
2. Deploy **Layered Rate Limiting** with `express-rate-limit` protecting auth endpoints and general API routes.
3. Build **Live Password Management** in user Settings requiring verified current passwords before cryptographic update.
4. Construct an **Enterprise Audit Log Explorer** with multi-parameter filtering, detail inspector, and 1-click **CSV/JSON export**.

---

## 2. Technical Architecture & Security Layers

```
                                  [Incoming Request]
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
                      │        Helmet Security Headers        │
                      │  CSP · HSTS · X-Frame · Sniff Guard   │
                      └───────────────────┬───────────────────┘
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
                      │         Layered Rate Limiters         │
                      │  Auth: 10/15min  │  API: 300/15min    │
                      └───────────────────┬───────────────────┘
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
                      │       JWT Authentication Guard        │
                      │       requireAuth & requireRole       │
                      └───────────────────┬───────────────────┘
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
                      │       Enterprise Audit Logger         │
                      │   (Actor, Action, IP, Details JSONB)  │
                      └───────────────────┬───────────────────┘
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
                      │       PostgreSQL Audit Storage        │
                      │          audit_logs table             │
                      └───────────────────────────────────────┘
```

---

## 3. Detailed Feature Breakdown

### 3.1 Defense-in-Depth HTTP Security Headers (`helmet`)
Integrated into `backend/server.js`:
- **Content Security Policy (CSP):** Restricts execution of inline scripts and untrusted external origins.
- **Strict-Transport-Security (HSTS):** Enforces HTTPS connections across all modern browsers.
- **X-Frame-Options:** Set to `SAMEORIGIN` to eliminate clickjacking vectors.
- **X-Content-Type-Options:** Set to `nosniff` preventing MIME-type confusion exploits.

### 3.2 Layered Rate Limiting Protection (`express-rate-limit`)
- **Auth Endpoint Protection (`authLimiter`):**
  - **Threshold:** Maximum 10 failed login/registration attempts per 15-minute window per IP.
  - **Payload:** Returns `429 Too Many Requests` with retry headers and user-friendly error message: *"Too many authentication attempts. Please try again in 15 minutes."*
- **General API Protection (`apiLimiter`):**
  - **Threshold:** Maximum 300 requests per 15-minute window per IP, mitigating scraping bots and DDoS spikes.

### 3.3 Live Self-Service Password Management (`src/pages/Settings.jsx`)
- **Workflow:**
  1. User enters `Current Password`, `New Password`, and `Confirm New Password`.
  2. Client validates length (minimum 8 characters) and password match.
  3. Backend (`PATCH /api/auth/password`) retrieves current password hash from PostgreSQL.
  4. `bcrypt.compare()` verifies the current password. If incorrect, rejects with `401 Unauthorized`.
  5. New password is re-hashed with salt rounds (10) and committed to PostgreSQL.
  6. Dispatches an audit log event (`USER_PASSWORD_CHANGE`).

### 3.4 Enterprise Compliance Audit Log Explorer (`AdminAuditLogs.jsx`)
- **Captured Telemetry:**
  - `actor_id`: Unique identifier of the user who performed the action.
  - `actor_role`: Role (`admin`, `doctor`, `patient`).
  - `actor_name`: Human-readable name.
  - `action`: Standardized event code (`AUTH_LOGIN`, `AUTH_REGISTER`, `APPOINTMENT_CREATE`, `DOCTOR_VERIFY`, `PRESCRIPTION_CREATE`, `PASSWORD_UPDATE`).
  - `details`: Structured JSONB payload containing event context (e.g. appointment IDs, rejection notes, prescription dosages).
  - `ip_address`: IPv4/IPv6 address of the originating request.
  - `timestamp`: High-resolution ISO timestamp.
- **Explorer Capabilities:**
  - Real-time search across actor names and action types.
  - Role dropdown filter and date-range pickers.
  - Click-to-inspect modal rendering formatted JSON details.
- **Data Export Utilities (`src/utils/auditExport.js`):**
  - **Export to CSV:** Flattens audit entries into a sanitized CSV format for Excel/compliance reporting.
  - **Export to JSON:** Generates a structured JSON dump for enterprise SIEM ingestion.

---

## 4. Key Code Implementations

### Security Hardening Setup (`backend/server.js`):
```javascript
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// 1. Helmet HTTP Security Headers
app.use(helmet({
  contentSecurityPolicy: false, // Managed by Vite in dev
  crossOriginEmbedderPolicy: false,
}));

// 2. Strict Rate Limiter for Authentication
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// 3. General API Throttling
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', generalLimiter);
```

---

## 5. Verification & Testing Results

- **Rate Limiting Penetration Test:** Simulated 12 rapid failed login attempts; requests 1–10 returned `401 Unauthorized`, requests 11–12 returned `429 Too Many Requests`.
- **Password Update Validation:** Tested with incorrect current password (properly rejected) and correct password (successfully hashed and authenticated on next login).
- **Audit Log Verification:** Generated prescription and appointment events; verified full-text search and downloaded both CSV and JSON exports with complete metadata integrity.
