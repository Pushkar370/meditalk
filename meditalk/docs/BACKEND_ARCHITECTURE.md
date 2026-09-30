# MediTalk: Backend Architecture Guide

This document details how the backend of **MediTalk** is built, how data flows through the system, how security and privacy are enforced, and how background tasks and clinical safety engines operate.

---

## 1. Overview & Technology Stack

The backend is an enterprise-grade RESTful API server built on:

- **Node.js**: Asynchronous JavaScript runtime environment.
- **Express 5**: Fast, minimal web application framework handling HTTP routing and middleware.
- **PostgreSQL (Neon Cloud)**: Relational database providing transactional guarantees, foreign key integrity, and durable storage.
- **pg (node-postgres)**: High-performance PostgreSQL client utilizing connection pooling and SSL encryption.
- **pg-boss**: Transactional background job queue running natively on PostgreSQL to process scheduled tasks and notifications.
- **JSON Web Tokens (JWT) & bcrypt**: Cryptographic tools for session signing and irreversible password hashing.
- **Helmet & express-rate-limit**: Defense-in-depth security layers against brute-force attacks and web vulnerabilities.
- **Resend**: Transactional email API for appointment confirmations and 24-hour reminders.
- **Google Gemini API**: Artificial intelligence engine for natural language symptom triage and SOAP note drafting, paired with a deterministic clinical fallback matrix.

---

## 2. Directory Structure

The backend source code is organized by clinical domain inside the [`backend/`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/backend) directory:

```text
backend/
├── database/
│   ├── db.js             # PostgreSQL connection pool, health check ping, query helpers
│   ├── schema.sql        # Relational schema (tables, foreign keys, indexes)
│   └── seed.js           # Seeding script with verified demo physicians & sample records
├── middleware/
│   ├── auth.js           # JWT verification, RBAC guards, clinical relationship scoping
│   └── security.js       # Rate limiters and security headers
├── routes/
│   ├── auth.js           # Login, registration, password updates
│   ├── doctors.js        # Doctor directory, schedule availability, analytics
│   ├── patients.js       # Patient records, vitals history, profile management
│   ├── appointments.js   # Slot booking, live queue, rescheduling, cancellation
│   ├── prescriptions.js  # Prescription builder, PDF generation, safety check
│   ├── triage.js         # AI symptom intake & emergency detection engine
│   ├── messaging.js      # WhatsApp deep link formatting & RFC 5545 .ics calendar generation
│   ├── notifications.js  # Server-Sent Events (SSE) push stream
│   ├── pharmacy.js       # Active medication routines & schedule management
│   └── admin.js          # Doctor vetting, audit log explorer, clinic announcements
├── services/
│   ├── jobQueue.js       # pg-boss background worker configuration
│   └── email.js          # Resend transactional email client (with simulation mode)
└── server.js             # Application entrypoint, route mounting, graceful shutdown
```

---

## 3. Security, Authorization & Privacy Architecture

Healthcare systems handle private health information (PHI). MediTalk implements security at multiple layers:

### A. Token-Based Authentication (JWT)
1. When a user submits valid credentials, the server verifies the password using `bcrypt.compare()` against the stored cryptographic hash.
2. The server signs a JSON Web Token containing the user's ID, email, and role, expiring in 7 days.
3. Protected endpoints verify this token using the `requireAuth` middleware before executing any clinical logic.

### B. Role-Based Access Control (RBAC)
Endpoints are protected by role checks (`requireRole('doctor')`, `requireRole('admin')`). If a patient attempts to call an administrative endpoint such as verifying a doctor or broadcasting a clinic-wide announcement, the server immediately halts the request and returns a `403 Forbidden` response.

### C. Zero-Trust Clinical Relationship Scoping
One of the most critical privacy protections in MediTalk is **clinical scoping**:
- In standard applications, any doctor could query any patient's records.
- In MediTalk, a doctor can **only** view medical histories, vitals, and consultation records for patients who currently have, or have had, an active appointment with that specific doctor.
- The middleware executes a verification query:
  ```sql
  SELECT EXISTS (
    SELECT 1 FROM appointments 
    WHERE doctor_id = $1 AND patient_id = $2
  )
  ```
- If no clinical relationship exists, the request is rejected with `403 Forbidden: You do not have an active clinical relationship with this patient`.
- Clinic administrators retain clinic-wide oversight for compliance, billing, and patient safety interventions.

### D. Rate Limiting & Protection
- Authentication routes are capped at 30 requests per 15-minute window (`authLimiter`) to block automated password-guessing bots.
- General API routes are protected by `apiLimiter` (300 requests per minute).
- HTTP headers are hardened using `helmet` to mitigate Cross-Site Scripting (XSS) and clickjacking.

---

## 4. Real-Time Updates via Server-Sent Events (SSE)

Instead of forcing client browsers to repeatedly query the database every few seconds (which drains device batteries and places heavy load on the database), MediTalk uses **Server-Sent Events (SSE)** via [`/api/notifications/stream`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/backend/routes/notifications.js):

1. When a user logs in, their browser opens an SSE connection.
2. The server maintains active client response streams in memory, categorized by user ID and role.
3. When an event occurs (e.g., an appointment is booked, a doctor is verified, or an admin broadcasts an announcement), the server formats a lightweight JSON packet and pushes it down the open stream.
4. If a connection drops, the browser automatically reconnects.

---

## 5. Clinical Safety & Decision Support Engines

### A. The Drug Allergy & Interaction Safety Guard
Located in [`backend/routes/prescriptions.js`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/backend/routes/prescriptions.js), this engine executes before a prescription is issued:
- It checks the proposed medication against the patient's recorded allergies (e.g., flagging Amoxicillin if the patient has a Penicillin allergy).
- It evaluates the medication against the patient's existing active medications for adverse interactions (e.g., dangerous bleeding risks when combining anticoagulants with high-dose NSAIDs).
- If risks are detected, the system generates structured clinical warnings with recommended alternative actions.

### B. AI Symptom Triage with Deterministic Fallback
Located in [`backend/routes/triage.js`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/backend/routes/triage.js):
- Analyzes patient symptom descriptions using Google Gemini AI to assess urgency (Routine, Urgent, Emergency) and suggest the right specialty.
- **Deterministic Clinical Matrix:** If the external AI API is unreachable, times out, or rate-limited, the system seamlessly activates an internal medical keyword matrix. The patient's triage assessment is never delayed or interrupted.
- **Emergency Circuit-Breaker:** Critical red flags (chest tightness, severe breathlessness, stroke symptoms) immediately trigger emergency hotline instructions and halt routine online booking.

---

## 6. Background Processing & Email Automation

MediTalk utilizes **`pg-boss`**, an enterprise job queue that runs natively inside PostgreSQL:
- **No Extra Infrastructure:** Unlike traditional job queues that require Redis or RabbitMQ servers, `pg-boss` uses PostgreSQL’s transactional locking mechanisms.
- **Scheduled Reminders:** When an appointment is scheduled, background jobs are queued to trigger email reminders 24 hours prior to the visit.
- **Resilient Email Delivery:** Integrated with Resend. If no API key is configured in development, the system logs the full email content to the console in simulation mode rather than throwing an error.

---

## 7. Database Connection Resilience

The database layer in [`backend/database/db.js`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/backend/database/db.js) is engineered for cloud reliability:
- Maintains a pool of reusable database connections.
- Automatically handles connection dropouts and cloud database "cold starts" with automatic retries.
- Exposes a health check function `pingDb()` that measures database query latency in milliseconds, monitored live by the Administrator Telemetry dashboard.
