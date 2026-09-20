# MediTalk — Full Project Engineering Report (Phase 1 to Phase 8)

> **Document Type:** Master Engineering & Architecture Report  
> **Project:** MediTalk — Intelligent Patient Health Record & Telehealth Platform  
> **Author / Presenter:** Pushkar Thakare  
> **Branch / Version:** `vercel-postgres-migration` (Production Ready)  
> **Date:** September 2026  

---

## 1. Executive Summary

**MediTalk** is a modern, enterprise-grade healthcare management and telehealth application designed to bridge patients, medical doctors, and clinic administrators into a unified, secure digital ecosystem. 

Starting from early prototype designs, the platform underwent eight comprehensive engineering phases. Key milestones include:
- Establishing strict **Role-Based Access Control (RBAC)**.
- Migrating from an ephemeral SQLite database to a **serverless cloud PostgreSQL** cluster (**The Backend Connectivity Phase**).
- Implementing **telehealth video rooms (Jitsi Meet)** with ICD-10 diagnostic coding.
- Creating a **clinical prescriptions engine** with automatic A4 PDF generation.
- Providing **real-time Server-Sent Events (SSE)**, admin doctor verification, and audit logs.
- Hardening against DDoS and brute-force attacks via **rate limiters and security headers**.
- Building an **AI Clinical Triage Engine** powered by Google Gemini 1.5/3.6 Flash with a zero-failure deterministic clinical matrix fallback.

---

## 2. System Architecture Overview

```
                          ┌──────────────────────────┐
                          │   Client Layer (React)   │
                          │ Vite + TailwindCSS + SPA │
                          └─────────────┬────────────┘
                                        │ HTTPS / WSS
                                        ▼
                          ┌──────────────────────────┐
                          │  Express.js API Gateway  │
                          │   Helmet + RateLimiters  │
                          └──────┬──────────┬────────┘
                                 │          │
        ┌────────────────────────┘          └────────────────────────┐
        ▼                                                            ▼
┌───────────────────────────────┐                  ┌────────────────────────────────┐
│   PostgreSQL (AWS Neon)       │                  │   External Integrations        │
│   Serverless Cloud Database   │                  │   - Google Gemini Generative AI│
│   Connection Pooling + Keep-  │                  │   - Jitsi Meet WebRTC Video    │
│   Alive + Auto Schema Migration│                 │   - Real-Time SSE Streams      │
└───────────────────────────────┘                  └────────────────────────────────┘
```

### Core Technology Stack
- **Frontend:** React 18, React Router v6, Tailwind CSS, Lucide Icons, jsPDF, html2canvas.
- **Backend API:** Node.js (ESM), Express.js, JWT (`jsonwebtoken`), bcryptjs, dotenvx.
- **Database:** PostgreSQL (Neon Serverless cloud instance with SSL & connection pooling).
- **Security:** Helmet HTTP security headers, express-rate-limit, Role-Based Access Control (RBAC).
- **AI Engine:** Google Generative AI (`gemini-3.6-flash` / `gemini-3.5-flash`), with built-in deterministic clinical triage matrix fallback.
- **Telehealth:** WebRTC Video (Jitsi Meet integration) with synchronized waiting rooms.

---

## 3. Phase-by-Phase Implementation Breakdown

---

### Phase 1: Security, Role-Based Access Control (RBAC) & Core Authentication
*Commit: `6cce3cf`*

#### Objectives
Establish a secure authentication perimeter with strict separation of duties across three distinct roles: `patient`, `doctor`, and `admin`.

#### Key Features & Implementation
- **JWT & Password Security:** Passwords hashed with `bcryptjs` (salt rounds: 10). Authentication tokens signed via `jsonwebtoken` with role payload and expiration.
- **Middleware Guard Rails (`backend/middleware/auth.js`):**
  - `requireAuth`: Verifies Bearer token, extracts user ID and role, injects `req.user`.
  - `requireRole(role)`: Blocks unauthorized access (e.g., patient attempting to access doctor consultations returns `403 Forbidden`).
- **Client Route Guards (`src/components/ProtectedRoute.jsx`):**
  - React Router outlet wrapping routes by role. Unauthenticated users are redirected to `/login`, and role mismatches redirect to `/access-denied`.
- **Cross-Role Layout Encapsulation:** Independent layouts (`PatientLayout`, `DoctorLayout`, `AdminLayout`) ensuring topbar and sidebar navigation strictly match user permissions.

---

### Phase 2: Doctor Schedule Management, Dynamic Booking & The Backend Connectivity Phase
*Commit: `8a089f4` & `de27a4e`*

> 🌟 **CRITICAL MILESTONE — THE BACKEND CONNECTIVITY PHASE:**  
> In this phase, the application transitioned from client-side mock data and local SQLite to a live, persistent **Cloud PostgreSQL database** on Neon AWS serverless infrastructure. This established true multi-user backend connectivity across the entire hospital network.

#### 1. PostgreSQL Database Architecture (`backend/database/db.js`)
- **Connection Pool:** Configured `pg.Pool` with SSL mode `verify-full` / `require`.
- **Cloud DNS & IPv6 Resolution:** Implemented `dns.setDefaultResultOrder('ipv4first')` to prevent timeout issues on Windows and AWS Neon IPv6 interfaces.
- **Idempotent Auto-Migrations:** `initDb()` automatically creates and alters tables on startup (`users`, `patients`, `doctors`, `appointments`, `doctor_schedules`, `consultations`, `prescriptions`, `medical_records`, `notifications`, `audit_logs`).

#### 2. Doctor Schedule Management (`DoctorCalendar.jsx`)
- Doctors configure their working days (e.g., Monday through Friday), shift start and end times, slot durations (15, 30, 45, or 60 minutes), and lunch/break periods.
- Persistent schedule storage in the `doctor_schedules` PostgreSQL table.

#### 3. Dynamic Slot Generator & Double-Booking Protection
- **Slot Engine (`/api/appointments/slots`):** Calculates available slots by taking the doctor's active schedule, subtracting break periods and already-booked appointments for that date.
- **Concurrency Protection:** In `POST /api/appointments`, database transactions check whether a doctor or patient already has an active appointment at that timestamp, rejecting overlapping requests with `409 Conflict (SLOT_CONFLICT)`.

---

### Phase 3: Telehealth Video Consultations, Clinical Workspace & ICD-10 Coding
*Commit: `8a089f4`*

#### Objectives
Provide remote telehealth video consultations with interactive clinical documentation and standardized diagnostic coding.

#### Key Features & Implementation
- **Jitsi Meet WebRTC Video Integration (`src/components/video/VideoRoom.jsx`):**
  - High-definition video, audio mute/unmute, tile view, and end call controls embedded directly within MediTalk.
  - Generates secure, collision-free room IDs based on appointment metadata.
- **Synchronized Video Waiting Room:**
  - Real-time states: `waiting`, `in_progress`, `ended`.
  - When a doctor begins a session, the patient's waiting room automatically updates to active call state.
- **ICD-10 Diagnostic Code Search (`src/data/icd10.js`):**
  - Searchable catalog of official WHO ICD-10 diagnostic codes and descriptions.
  - Autocomplete search box in `DoctorConsultation.jsx` lets doctors rapidly tag diagnoses (e.g., `I10 - Essential (primary) hypertension`).
- **Live Vitals Threshold Alerting:**
  - Inputs for Blood Pressure (BP), Heart Rate (HR), Temperature (°C), Oxygen Saturation (SpO₂), and Weight.
  - Real-time visual status badges: Normal (green), Elevated/Warning (amber), and Critical Alert (pulsing red) for abnormal readings (e.g., SpO₂ < 90% or systolic BP > 140).

---

### Phase 4: Prescriptions Engine, Drug Catalog & Medical Records Upload
*Commit: `8d2d631`*

#### Objectives
Digitize prescription generation with medical-grade PDF printing and patient document management.

#### Key Features & Implementation
- **Comprehensive Clinical Drug Catalog (`src/data/drugCatalog.js`):**
  - Over 60 medications categorized across 8 clinical specialties (Cardiology, Antibiotics, Analgesics, Endocrinology, Respiratory, Gastroenterology, Psychiatry, Supplements).
  - Quick-pick dosage buttons and frequency chips (OD - Once Daily, BD - Twice Daily, TDS - Thrice Daily, QDS, PRN).
- **Client-Side A4 PDF Generator (`src/utils/prescriptionPdf.js`):**
  - Generated via `jsPDF` with clinical branding, clinic letterhead, doctor registration number, patient demographic box, structured Rx table, doctor's digital signature block, and prescription validity disclaimer.
  - Instant auto-download for doctors upon saving and 1-click PDF download for patients in `PatientPrescriptions.jsx`.
- **Medical Records Document Management (`src/pages/patient/PatientRecords.jsx`):**
  - Drag-and-drop document uploader accepting PDF reports, lab results, and image scans (PNG, JPG, WEBP).
  - Stored in PostgreSQL with Base64 encoding.
  - Document viewing modal with embedded PDF iframe viewer and image lightbox.
  - Express payload limit expanded to 25MB (`express.json({ limit: '25mb' })`).

---

### Phase 5: Admin Oversight, Doctor Verification, Real-Time SSE & Broadcasts
*Commit: `20c1271`*

#### Objectives
Give hospital administrators operational oversight, verification authority over doctors, and real-time broadcast capabilities.

#### Key Features & Implementation
- **Doctor Credential Verification Workflow (`AdminDoctorVerification.jsx`):**
  - When doctors register, their verification status is set to `pending`.
  - Admin panel provides review of medical license, specialization, experience, and bio.
  - Actions: **Approve** (enables doctor to appear in directory and accept bookings) or **Reject** (with required clinical rejection notes explaining the denial).
- **Real-Time Server-Sent Events (SSE) Stream (`/api/notifications/stream`):**
  - Persistent HTTP SSE connection replacing heavy client polling.
  - Broadcasts appointment bookings, cancellations, and doctor approvals instantly to connected clients.
- **Hospital Broadcast Announcements (`AdminAnnouncements.jsx`):**
  - Admin announcement creator targeting all users, doctors only, or patients only.
  - Banner alerts on user dashboards with priority levels (Low, Medium, High).
- **Admin Appointment Intervention (`AdminAppointments.jsx`):**
  - Emergency admin rescheduling, reassignment to another physician, and cancellations with audit trail tracking.
- **Administrative PDF Analytics (`src/utils/analyticsPdf.js`):**
  - Generates executive hospital summary reports on patient volume, doctor utilization, and revenue statistics.

---

### Phase 6: Platform Security, Rate Limiting & Enterprise Audit Logging
*Commit: `1cc55a3`*

#### Objectives
Harden the application against automated attacks, brute-force exploits, and establish a tamper-evident compliance audit trail.

#### Key Features & Implementation
- **HTTP Security Headers (`helmet`):**
  - Configures CSP (Content Security Policy), HSTS, X-Content-Type-Options, and X-Frame-Options against clickjacking and XSS.
- **Layered Rate Limiting (`express-rate-limit`):**
  - **Auth Rate Limiter:** Maximum 10 failed login/register attempts per 15-minute window per IP to prevent credential stuffing.
  - **API Rate Limiter:** Maximum 300 general API requests per 15-minute window per IP to prevent denial of service.
- **Live Password Management (`src/pages/Settings.jsx`):**
  - Secure password update requiring verification of current password via bcrypt before committing new credentials.
- **Enterprise Audit Log Explorer (`AdminAuditLogs.jsx`):**
  - Immutable audit trail recording every significant system event (`AUTH_LOGIN`, `APPOINTMENT_CREATE`, `DOCTOR_VERIFY`, `PRESCRIPTION_CREATE`).
  - Searchable by actor, action type, IP address, and date range.
  - Export functionality to both CSV and JSON formats (`src/utils/auditExport.js`).

---

### The Bug Audit & Platform Stabilization Phase
*Commit: `d23cabd`*

During system testing, 8 critical bugs were audited, documented, and permanently resolved:

| # | Audited Bug | Root Cause | Engineering Solution |
|---|---|---|---|
| **1** | **PostgreSQL Connection Drops on Windows** | Node.js defaulted to IPv6, causing intermittent Neon AWS connection drops. | Forced IPv4 first: `dns.setDefaultResultOrder('ipv4first')` in `db.js` and `server.js`. |
| **2** | **Idle Connection Termination** | Neon drops idle serverless connections after inactivity. | Configured TCP keepAlive: `keepAlive: true`, `idleTimeoutMillis: 30000`, `max: 10`. |
| **3** | **Notification Foreign Key Violation** | Appointments passed doctor ID (`D-201`), but `notifications.user_id` references `users.id` (`U-301`). | Added `getUserId(roleId)` resolver in `notifications.js` to dynamically map role IDs to user IDs. |
| **4** | **Schedule Break Overlap Calculation** | Appointment slot engine generated slots that overlapped with doctor lunch breaks. | Added strict time-range exclusion logic checking if slot interval intersects doctor break window. |
| **5** | **Video Room Desynchronization** | Doctor setting status to `in_progress` did not consistently transition patient screen. | Centralized video status in `appointments.video_status` table column with live polling/SSE triggers. |
| **6** | **Unapproved Doctor Directory Leak** | Patients could see doctors whose verification was still pending. | Updated `GET /api/doctors` to enforce `WHERE verification_status = 'approved'` for patient requests. |
| **7** | **White Screen Crash on Render Error** | Unhandled React rendering errors caused complete white screen without user feedback. | Created global `ErrorBoundary.jsx` component catching runtime errors and providing a graceful reset button. |
| **8** | **Automated Test Validation** | Need for regression prevention across all workflows. | Created and ran automated test suite covering all 19 test cases — all 19 passed cleanly. |

---

### Phase 7: Production Hardening, System Diagnostics & Telemetry
*Commit: `d23cabd`*

#### Objectives
Ensure operational stability, health monitoring, and production-grade deployment readiness.

#### Key Features & Implementation
- **Deep Healthcheck & Telemetry Endpoint (`GET /api/health`):**
  - Real-time diagnostic reporting database connection status, query round-trip latency (ms), connection pool stats (active clients, idle clients, waiting clients), memory usage (RSS, heap used), and server uptime.
- **Graceful Shutdown Handlers:**
  - Implemented `SIGTERM` and `SIGINT` lifecycle hooks in `server.js` to cleanly close database pools and HTTP servers during redeployments.
- **Vite Production Optimization:**
  - Optimized chunking and asset minification, reducing bundle size and ensuring sub-second initial load times.

---

### Phase 8: AI Clinical Triage, Symptom Checker & Patient Health Vitals Intelligence
*Commit: `450a648`, `f00298c`, `d1c936c`*

#### Objectives
Provide intelligent clinical triage to guide patients to the appropriate medical specialist and equip consulting physicians with pre-consultation briefings.

#### Key Features & Implementation
- **AI Triage Backend Engine (`backend/routes/triage.js`):**
  - Integrated Google Generative AI (`gemini-3.6-flash`, with `gemini-3.5-flash` and `gemini-2.5-flash-lite` fallbacks) using `GEMINI_API_KEY`.
  - **Deterministic Clinical Matrix Fallback:** Rule-based medical decision logic detecting red flags (crushing chest pain, stroke signs, breathing difficulty) and recommending specialties even if external APIs or network connectivity fail.
- **Patient Symptom Checker Wizard (`/patient/triage`):**
  - 3-step symptom intake with quick condition chips, severity slider (1–10), duration selector, and accompanying symptom toggles.
  - Output displays Urgency Badge (*Emergency 🚨, Urgent ⚠️, Routine 🟢, Self-Care ℹ️*), Recommended Specialty, Differential Considerations, Questions for the Doctor, and Home Care Advice.
  - **1-Click Booking Handoff:** Pre-populates specialty in `BookAppointment.jsx` and persists triage data with the appointment.
- **Patient Dashboard Vitals Intelligence (`PatientDashboard.jsx`):**
  - Telemetry cards for Blood Pressure, Heart Rate, SpO₂, Temperature, and Weight with clinical status badges.
  - Historical consultation biometric trends log via `GET /api/patients/:id/vitals-history`.
- **Doctor Urgency Badges & Consultation Brief:**
  - `DoctorAppointments.jsx` displays urgency priority badges with pulsing alerts for emergency cases.
  - `DoctorConsultation.jsx` renders an expandable Pre-Consultation AI Triage Brief with a 1-click **"Import to Notes"** button.
- **UI & Accessibility Refinement:**
  - Polished Clinical Guidance Notice with high-contrast, accessible styling (`bg-amber-50`, dark ink text, bold red emergency numbers).
  - Restored crisp white **MediTalk** branding on login and landing page headers.

---

## 4. Complete Database Schema Reference

| Table Name | Primary Key | Key Columns | Relationships |
|---|---|---|---|
| `users` | `id` (VARCHAR) | `email`, `password`, `role`, `name`, `phone`, `created_at` | Root authentication entity |
| `patients` | `id` (VARCHAR) | `user_id`, `name`, `dob`, `gender`, `blood_group`, `allergies`, `current_medications`, `vitals` | FK to `users.id` |
| `doctors` | `id` (VARCHAR) | `user_id`, `name`, `specialty`, `experience`, `qualification`, `verification_status`, `rejection_notes`, `status` | FK to `users.id` |
| `doctor_schedules` | `id` (VARCHAR) | `doctor_id`, `working_days`, `shift_start`, `shift_end`, `slot_duration`, `break_start`, `break_end`, `is_active` | FK to `doctors.id` |
| `appointments` | `id` (VARCHAR) | `patient_id`, `doctor_id`, `date`, `time`, `type`, `status`, `reason`, `video_status`, `urgency`, `triage_summary` | FK to `patients.id`, `doctors.id` |
| `consultations` | `id` (VARCHAR) | `appointment_id`, `patient_id`, `doctor_id`, `date`, `diagnosis`, `diagnosis_code`, `vitals`, `observations`, `treatment_plan` | FK to `appointments.id` |
| `prescriptions` | `id` (VARCHAR) | `patient_id`, `doctor_id`, `date`, `diagnosis`, `medications` (JSONB), `instructions`, `status` | FK to `patients.id`, `doctors.id` |
| `medical_records` | `id` (VARCHAR) | `patient_id`, `doctor_id`, `date`, `type`, `description`, `file_data` (TEXT Base64), `file_name`, `file_type` | FK to `patients.id` |
| `notifications` | `id` (VARCHAR) | `user_id`, `title`, `message`, `type`, `read`, `created_at` | FK to `users.id` |
| `audit_logs` | `id` (VARCHAR) | `actor_id`, `actor_role`, `actor_name`, `action`, `details` (JSONB), `ip_address`, `timestamp` | Audit compliance entity |

---

## 5. API Endpoint Catalog

### Authentication & Security (`/api/auth`)
- `POST /api/auth/register` — Register new patient or doctor.
- `POST /api/auth/login` — Authenticate user, returns JWT and user profile (protected by rate limiter).
- `GET /api/auth/me` — Retrieve active authenticated session.
- `PATCH /api/auth/password` — Verify current password and update to new password via bcrypt.

### Doctor Schedules & Directory (`/api/doctors`)
- `GET /api/doctors` — Fetch approved active doctors (filtered by role).
- `GET /api/doctors/:id` — Fetch doctor profile.
- `GET /api/doctors/:id/schedule` — Fetch doctor working hours and slot durations.
- `PUT /api/doctors/:id/schedule` — Save doctor weekly availability schedule.

### Appointments & Slots (`/api/appointments`)
- `GET /api/appointments` — Fetch appointments (filtered by patient or doctor ID).
- `GET /api/appointments/:id` — Fetch appointment details including triage metadata.
- `GET /api/appointments/slots` — Dynamic slot calculation with break and booking exclusion.
- `POST /api/appointments` — Book appointment with double-booking transaction guard.
- `PATCH /api/appointments/:id/status` — Update appointment status (upcoming, confirmed, completed, cancelled).
- `PATCH /api/appointments/:id/video-status` — Synchronize video consultation waiting room.

### AI Clinical Triage & Vitals (`/api/triage` & `/api/patients`)
- `POST /api/triage/assess` — Multi-model symptom assessment (Gemini 3.6 Flash + clinical matrix fallback).
- `GET /api/patients/:id/vitals-history` — Retrieve historical consultation biometric telemetry.

### Prescriptions & Records (`/api`)
- `POST /api/prescriptions` — Create digital prescription with drug catalog linkage.
- `GET /api/prescriptions` — List prescriptions by patient or doctor.
- `POST /api/medical-records` — Upload medical document / lab test (supports up to 25MB Base64).
- `GET /api/medical-records/:patientId` — Retrieve patient medical record documents.

### Admin Operations & Audit (`/api/admin`)
- `GET /api/admin/doctors/pending` — List doctors awaiting verification.
- `PATCH /api/admin/doctors/:id/verify` — Approve or reject doctor credentials with notes.
- `GET /api/admin/audit-logs` — Query compliance audit logs with filtering and export.
- `POST /api/admin/announcements` — Publish system-wide broadcast notification.
- `GET /api/health` — Deep diagnostic telemetry (database latency, pool stats, memory).

---

## 6. Verification & Quality Assurance Summary

1. **Automated Regression Suite (`test_phase8.js`):**
   - Live Gemini 3.6 Flash API triage assessment — **PASSED**.
   - Red-flag cardiac emergency urgency detection — **PASSED**.
   - Dermatology routine specialty recommendation — **PASSED**.
   - Double-booking prevention — **PASSED**.
   - Doctor pre-consultation triage brief persistence — **PASSED**.
2. **Platform Bug Audit Suite:**
   - 19 out of 19 independent integration tests passed with zero failures.
3. **Build Integrity:**
   - `npm run build` generates optimized production bundles with 0 JSX/TypeScript/bundling errors.
4. **Browser Subagent Walkthrough:**
   - Visual inspection confirmed high-contrast Clinical Guidance Notice and prominent MediTalk branding across landing, login, dashboard, and video rooms.
