# MediTalk: Modern Telehealth & Clinical Care Platform

> A unified, trust-first virtual clinic platform connecting patients, doctors, nurses, receptionists, and clinic administrators into a single digital healthcare journey.

[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen)]()
[![Automated Tests](https://img.shields.io/badge/Tests-108%20Passed%20(100%25)-brightgreen)]()
[![Audit Logs](https://img.shields.io/badge/Audit%20Logs-SHA--256%20Tamper--Resistant-blueviolet)]()
[![Security](https://img.shields.io/badge/Security-Zero--Trust%20RBAC-teal)]()
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20(Neon)-blue)]()
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61dafb)]()
[![Node](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express%205-green)]()

---

## Table of Contents

- [The Problem MediTalk Solves](#the-problem-meditalk-solves)
- [The Five Clinical Portals](#the-five-clinical-portals)
- [Key Features](#key-features)
- [Architecture Overview](#architecture-overview)
- [Cryptographic Audit Log & Verification](#cryptographic-audit-log--verification)
- [Quick Start](#quick-start)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Documentation Directory](#documentation-directory)

---

## The Problem MediTalk Solves

Modern healthcare is often fragmented and frustrating:
- **Patients** deal with phone holds, confusing paperwork, uncertainty about which medical specialist they need, and lost paper prescriptions.
- **Doctors** spend hours on repetitive documentation, checking drug allergies by hand, and struggling to access past patient history during remote consultations.
- **Nurses & Receptionists** lack structured queues to record pre-consultation vitals or coordinate daily check-ins without risking unauthorized exposure of private medical notes.
- **Clinic Administrators** lack unified real-time visibility into doctor availability, daily patient queues, and legally compliant, unalterable audit trails.

**MediTalk** brings all five groups together under one digital roof. From the moment a patient describes a symptom to the moment they receive their verified digital prescription and take their medication, every step happens inside MediTalk with genuine clinical data, zero-trust privacy, and cryptographic audit integrity.

---

## The Five Clinical Portals

MediTalk provides dedicated, role-isolated workspaces:

```text
                               ┌────────────────────┐
                               │   Authentication   │
                               │    (Role Guard)    │
                               └─────────┬──────────┘
           ┌─────────────────┬───────────┼───────────┬─────────────────┐
           ▼                 ▼           ▼           ▼                 ▼
 ┌──────────────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────────┐
 │  PATIENT PORTAL  │ │  DOCTOR   │ │   ADMIN   │ │   NURSE   │ │RECEPTIONIST │
 │• AI Symptom Intake│ │• Live Queue│ │• Licensing│ │• Vitals   │ │• Check-in   │
 │• Booking Wizard  │ │• Video Rm │ │• Telemetry│ │  Recording│ │  Queue     │
 │• In-Call Video   │ │• SOAP Note│ │• Broadcast│ │• Pre-Call │ │• Redacted   │
 │• PDF Rx Download │ │• Rx Writer│ │• Audit Log│ │  Queue    │ │  Schedules  │
 │• Vitals Tracking │ │• Safety Chk│ │  Explorer│ │           │ │             │
 └──────────────────┘ └───────────┘ └───────────┘ └───────────┘ └─────────────┘
```

1. **Patient Portal:** AI symptom intake, doctor booking, in-browser video visits, downloadable PDF prescriptions, vitals tracking, and medication routines.
2. **Doctor Portal:** Daily live waiting room queue, availability schedule manager, in-call clinical notes, drug allergy and interaction safety checks, and instant prescription issuing.
3. **Administrator Portal:** Doctor license verification queue, appointment intervention, real-time push announcements, live system telemetry, and cryptographic audit log explorer.
4. **Nurse Portal:** Pre-consultation vitals recording queue (BP, HR, SpO2, Temperature, Blood Sugar) with automatic attachment to scheduled physician consultations.
5. **Receptionist Portal:** Patient check-in queue and physical schedule coordination, with sensitive triage summaries and clinical consultation notes strictly redacted.

---

## Key Features

- **AI Clinical Triage:** Evaluates symptoms in plain language to categorize urgency (Routine, Urgent, Emergency) and suggest appropriate specialists. Backed by a deterministic clinical rule matrix for guaranteed reliability during cloud AI API downtime.
- **Emergency Red-Flag Circuit Breaker:** Critical symptoms (severe chest pain, stroke symptoms, acute breathlessness) halt routine booking and immediately display emergency hotline numbers (`112 / 911 / 108`).
- **Atomic Double-Booking Prevention:** Database-level slot validation via PostgreSQL unique indexes ensures no two patients can ever book the same doctor at the same time.
- **Universal Telehealth Video Rooms:** In-browser encrypted video consultation rooms with camera, microphone, and screen-sharing controls—no external apps or accounts required.
- **Drug Allergy & Interaction Safety Guard:** Cross-checks proposed prescriptions against patient allergies and concurrent medications before issuance to prevent adverse drug events.
- **Automated AI SOAP Notes:** Converts consultation points into standard clinical documentation (**S**ubjective, **O**bjective, **A**ssessment, **P**lan) with one click.
- **Instant Verified PDF Prescriptions:** Generates standardized, downloadable PDF prescriptions with clinical letterhead and digital verification seals using `jspdf`.
- **Zero-Cost WhatsApp & Calendar Sync:** Delivers RFC 5545 `.ics` calendar invites for Google/Apple/Outlook calendars, and pre-formatted WhatsApp deep links (`wa.me`) for instant patient notifications and late-patient video room alerts.
- **Zero-Trust Clinical Privacy:** Enforces strict clinical relationship scoping (`hasClinicalRelationship`). Doctors can only access medical records for patients under their direct care. Unauthorized cross-patient lookups return `403 Forbidden`.
- **Cryptographic Tamper-Resistant Audit Log:** PostgreSQL engine triggers preventing `UPDATE`, `DELETE`, and `TRUNCATE` operations on audit rows, combined with SHA-256 hash chaining back to Genesis.
- **Clinical Read Access Auditing:** Automatically logs Who, What, When, and From Where (IP address & User-Agent) on all views of patient charts, vitals history, prescriptions, and clinical notes.

---

## Architecture Overview

MediTalk is built with a clean, decoupled client-server architecture:

```text
Frontend (React 18, Vite, Tailwind CSS, Lucide Icons)
       │
       ▼ HTTPS REST API + Server-Sent Events (SSE)
Backend (Node.js 24, Express 5, JWT Auth, RBAC, Rate Limiting)
       │
       ▼ Connection Pool (pg) with Advisory Transaction Locks
Database (Cloud PostgreSQL on Neon, pg-boss Job Queue)
```

---

## Cryptographic Audit Log & Verification

MediTalk features an enterprise-grade, cryptographically chained audit logging system compliant with HIPAA and GDPR audit specifications:

### 1. Database Engine Immutability
A PostgreSQL trigger (`trg_protect_audit_logs BEFORE UPDATE OR DELETE`) aborts any attempt to modify or delete audit rows with an engine-level exception:
```sql
RAISE EXCEPTION 'Audit logs are immutable and tamper-resistant: UPDATE and DELETE operations are forbidden.';
```
A table rule (`no_audit_log_truncate`) also prevents table truncation.

### 2. SHA-256 Blockchain Hash Chaining
Every audit log row computes a SHA-256 hash over its immutable fields chained to the previous row's hash:
```text
SHA-256( prev_hash | timestamp | user_id | user_name | role | action | entity_type | entity_id | ip_address | status )
```
Row #1 is chained to the canonical `GENESIS_HASH` (`0000...0000`). If any past row is altered, the entire mathematical chain breaks, pinpointing the exact row ID and sequence index of tampering.

### 3. Non-Blocking Async Queue
Audit events are pushed to an in-memory sequential promise queue (`writeQueue`) with PostgreSQL advisory transaction locks (`pg_advisory_xact_lock`), delivering **0ms database blocking latency** to HTTP route handlers.

### 4. Three Admin Verification Methods
- **Admin UI Explorer:** Navigate to **Admin Dashboard &rarr; Audit Intelligence Explorer** and click **"Verify Log Integrity"** to view live chain status and the head SHA-256 hash.
- **Admin REST API:** `GET /api/admin/audit-logs/verify` (requires Admin Bearer token).
- **Admin CLI Script:** Run directly in the terminal:
  ```bash
  node backend/scripts/verify_audit_logs.mjs
  ```

---

## Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/Pushkar370/meditalk.git
cd meditalk/meditalk
npm install
```

### 2. Configure Environment (`.env`)
Create a `.env` file in `meditalk/` (or copy from `.env.example`):
```env
PORT=3001
DATABASE_URL=postgresql://username:password@your-postgres-host.neon.tech/neondb?sslmode=require
JWT_SECRET=your_jwt_secret_key_minimum_32_characters
GEMINI_API_KEY="optional-gemini-key"
RESEND_API_KEY=optional_resend_key
EMAIL_FROM=MediTalk <onboarding@resend.dev>
FRONTEND_URL=http://localhost:5173
```

### 3. Initialize & Seed Database
```bash
npm run seed
```

### 4. Run Locally
```bash
npm run dev
```
- **Frontend App:** Open `http://localhost:5173`
- **Backend API:** Running at `http://localhost:3001` (Health check: `/api/health`)

---

## Testing & Quality Assurance

MediTalk includes three automated test suites containing **108 passed assertions (100% Green)** across security, access control, clinical workflows, and cryptographic integrity:

```bash
# 1. End-to-End Clinical Lifecycle Suite (36 Tests)
npm test

# 2. Zero-Trust Access Control & Clinical Scoping Suite (37 Tests)
node test_access_control.mjs

# 3. Tamper-Resistant Audit Log & Read Auditing Suite (35 Tests)
node test_audit_hardening.mjs

# 4. Standalone Audit Chain Verification CLI
node backend/scripts/verify_audit_logs.mjs
```

### Test Suite Summary:
- **`test_suite.mjs` (36 Passed):** Validates database connectivity, authentication, doctor availability, appointment queues, clinical safety checks, WhatsApp deep links, and patient privacy protections.
- **`test_access_control.mjs` (37 Passed):** Proves doctors cannot view patient records without a confirmed appointment (`403 Forbidden`), patients can only self-book, nurses can record vitals but cannot view clinical notes, and receptionists see schedule info with triage summaries stripped.
- **`test_audit_hardening.mjs` (35 Passed):** Proves database engine rejects `UPDATE` and `DELETE` on audit rows, validates SHA-256 chain linkage, verifies the tamper detection algorithm, proves read access auditing on charts, vitals, prescriptions, and notes, and verifies sub-millisecond dispatch overhead.

---

## Documentation Directory

| Document | Purpose |
| :--- | :--- |
| **[Codebase Walkthrough](docs/CODEBASE_EXPLANATION.md)** | File-by-file breakdown of frontend, backend, routes, database, and clinical flow. |
| **[Setup & Installation](docs/SETUP_AND_INSTALLATION.md)** | Step-by-step local setup, environment variables, database seeding, and production builds. |
| **[Frontend Architecture](docs/FRONTEND_ARCHITECTURE.md)** | Guide to React components, the user portals, routing guards, and design system. |
| **[Backend Architecture](docs/BACKEND_ARCHITECTURE.md)** | Deep dive into Express middleware, security, zero-trust privacy, SSE, and background jobs. |
| **[Project History & Changelog](docs/PROJECT_HISTORY_AND_CHANGELOG.md)** | Complete chronological story of the project from commit 1 to the present day, with challenges and solutions. |

---

## License

This project is licensed under the MIT License.
