# MediTalk: Comprehensive Codebase & Architecture Guide

This document is a complete, file-by-file walkthrough of the **MediTalk** codebase. It explains how the project is organized, what each directory and file does, how the frontend and backend communicate, and how clinical safety and privacy are enforced at the code level.

---

## Table of Contents

1. [Architecture Overview & Data Flow](#1-architecture-overview--data-flow)
2. [Project Root & Configuration Files](#2-project-root--configuration-files)
3. [Frontend Architecture (`src/`)](#3-frontend-architecture-src)
   - [Application Entry & Core (`src/`)](#application-entry--core-src)
   - [Layouts (`src/layouts/`)](#layouts-srclayouts)
   - [State & Context (`src/context/`)](#state--context-srccontext)
   - [UI Components & Design System (`src/components/`)](#ui-components--design-system-srccomponents)
   - [Pages & User Portals (`src/pages/`)](#pages--user-portals-srcpages)
   - [API Client Services (`src/services/`)](#api-client-services-srcservices)
   - [Utilities & Clinical Data (`src/utils/` & `src/data/`)](#utilities--clinical-data-srcutils--srcdata)
4. [Backend Architecture (`backend/`)](#4-backend-architecture-backend)
   - [Server Entry (`backend/server.js`)](#server-entry-backendserverjs)
   - [Database Layer (`backend/database/`)](#database-layer-backenddatabase)
   - [Security & Middleware (`backend/middleware/`)](#security--middleware-backendmiddleware)
   - [API Routes (`backend/routes/`)](#api-routes-backendroutes)
   - [Background Services (`backend/services/`)](#background-services-backendservices)
   - [Clinical Data (`backend/data/`)](#clinical-data-backenddata)
5. [End-to-End Clinical Data Flow Walkthrough](#5-end-to-end-clinical-data-flow-walkthrough)
6. [Automated Regression Test Suite (`test_suite.mjs`)](#6-automated-regression-test-suite-test_suitemjs)

---

## 1. Architecture Overview & Data Flow

MediTalk is structured as a decoupled client-server web application:

```text
[Browser: React 18 + Vite]
       │
       │  HTTPS / REST API (Bearer JWT) + Server-Sent Events (SSE)
       ▼
[Server: Node.js + Express 5]
  ├── Security: Helmet, Rate Limiters, JWT & RBAC
  ├── Privacy: Zero-Trust Clinical Relationship Scoping
  ├── Engines: AI Triage (Gemini + Matrix), Drug Safety Guard
  └── Automation: pg-boss Background Jobs, Resend Email
       │
       │  TCP Connection Pool (pg)
       ▼
[Database: Cloud PostgreSQL on Neon]
  ├── Tables: users, patients, doctors, appointments, prescriptions, audit_logs
  └── State: pg-boss job queue tables
```

### The Communication Lifecycle
1. **Frontend Requests:** The React frontend uses helper functions in `src/services/apiClient.js` to dispatch asynchronous `fetch` requests with JSON payloads.
2. **Authentication:** The user's JSON Web Token (stored in `localStorage`) is attached to the `Authorization: Bearer <token>` HTTP header.
3. **Route & Role Verification:** Express routes check the token using `requireAuth` and verify permissions using `requireRole('doctor' | 'admin')`.
4. **Clinical Relationship Check:** If a doctor attempts to access patient medical records, the `verifyDoctorPatientRelationship` middleware checks PostgreSQL to ensure the doctor has treated that patient.
5. **Database Execution:** Queries execute against Cloud PostgreSQL through a persistent connection pool (`backend/database/db.js`).
6. **Real-Time Push:** When appointments are booked or announcements are broadcast, the server pushes notifications directly to open client streams via Server-Sent Events (`backend/routes/notifications.js`).

---

## 2. Project Root & Configuration Files

| File | Purpose |
| :--- | :--- |
| **`package.json`** | Defines project dependencies, metadata, and scripts: `dev` (runs frontend and backend concurrently), `client` (Vite dev server), `server` (Express API server), `seed` (database seeding), `test` (runs test suite), and `build` (compiles production bundle). |
| **`package-lock.json`** | Records exact dependency versions for reproducible builds across all environments. |
| **`vite.config.js`** | Configures the Vite build tool, loading the `@vitejs/plugin-react` plugin and setting up local development server ports and proxies. |
| **`tailwind.config.js`** | Configures the Tailwind CSS design system with custom medical color tokens: `sage` (healing green), `cream` (soft background), `ink` (charcoal typography), and `accent` (emerald highlight). |
| **`postcss.config.js`** | Enables PostCSS plugins (`tailwindcss` and `autoprefixer`) to ensure CSS compatibility across all modern web browsers. |
| **`.env` / `.env.example`** | Environment configuration file containing `PORT`, `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `RESEND_API_KEY`, and `EMAIL_FROM`. |
| **`render.yaml`** | Deployment descriptor for cloud hosting on Render, configuring web services and environment variables. |
| **`vercel.json`** | Configuration for Vercel cloud deployment, specifying routing rules and build commands. |
| **`index.html`** | Single-page application HTML entrypoint, mounting the root React component at `<div id="root">`. |

---

## 3. Frontend Architecture (`src/`)

The frontend is located entirely inside the [`src/`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/src) directory.

### Application Entry & Core (`src/`)

- **[`main.jsx`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/src/main.jsx):** The JavaScript entrypoint. Initializes the React root DOM, wraps the application in the `ToastProvider`, and mounts `App.jsx`.
- **[`App.jsx`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/src/App.jsx):** The central routing coordinator. Defines all public and private routes using `react-router-dom`, enclosing protected sections in `<ProtectedRoute>` and `<RoleRoute>` guards.
- **[`index.css`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/src/index.css):** Global styling file importing Tailwind CSS directives and setting base font styles (Inter/Outfit).
- **[`constants.js`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/src/constants.js):** Global application constants, including role definitions (`ROLES.PATIENT`, `ROLES.DOCTOR`, `ROLES.ADMIN`), appointment statuses, and API base URL resolvers.

---

### Layouts (`src/layouts/`)

Layout components provide the persistent visual shell (navigation bars, sidebars, and topbars) for authenticated users:

- **[`PatientLayout.jsx`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/src/layouts/PatientLayout.jsx):** Wraps all `/patient/*` routes. Provides the patient navigation header (Dashboard, Book Visit, Prescriptions, Records, Vitals), profile menu, and in-app notification bell.
- **[`DoctorLayout.jsx`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/src/layouts/DoctorLayout.jsx):** Wraps all `/doctor/*` routes. Features the doctor's sidebar (Waiting Room Queue, Schedule Manager, Patient Roster, Clinical Analytics).
- **[`AdminLayout.jsx`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/src/layouts/AdminLayout.jsx):** Wraps all `/admin/*` routes. Displays clinic administrative controls (Doctor Verification Queue, Appointment Radar, Live Broadcast Console, Audit Logs, System Health).

---

### State & Context (`src/context/`)

- **[`AuthContext.jsx`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/src/context/AuthContext.jsx):** Manages user session state (`user`, `token`, `role`, `loading`). Persists the JWT in browser `localStorage`, handles `login()` and `logout()`, and provides immediate state synchronization when users update their profile names or avatars.
- **[`NotificationContext.jsx`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/src/context/NotificationContext.jsx):** Manages the in-app notification list and unread count badge. Listens to Server-Sent Events (SSE) to display incoming alerts in real time.
- **[`ToastContext.jsx`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/src/context/ToastContext.jsx):** Provides a global toast alert system (`toast.success()`, `toast.error()`, `toast.warning()`) to give users immediate feedback on actions without intrusive modal popups.

---

### UI Components & Design System (`src/components/`)

- **`src/components/ui/`:** Reusable building blocks ensuring visual consistency:
  - `Button.jsx`: Primary, secondary, danger, and outline buttons with built-in loading spinners.
  - `Input.jsx` & `Select.jsx`: Standardized form inputs with floating labels and error state formatting.
  - `Card.jsx`: Surface card containers with subtle borders and shadows.
  - `Modal.jsx` & `ConfirmationModal.jsx`: Accessible dialog modals with backdrop blur.
  - `DataTable.jsx`: Tabular data display with sorting and empty-state handling.
  - `StatusBadge.jsx`: Color-coded status pills (Confirmed, Completed, Pending, Cancelled, Emergency).
  - `StatCard.jsx`: Metric display cards used across doctor and admin analytics.
  - `EmptyState.jsx` & `LoadingState.jsx`: User feedback screens when data is loading or no records exist.
- **`src/components/cards/`:** Domain-specific summary cards:
  - `AppointmentCard.jsx`: Displays consultation time, doctor/patient info, and video launch buttons.
  - `DoctorCard.jsx`: Shows doctor photo, specialty, experience, rating, and booking shortcut.
  - `PrescriptionCard.jsx`: Displays medication details, dosage instructions, and PDF download triggers.
  - `MedicalRecordCard.jsx`: Visualizes uploaded lab reports, imaging files, and diagnostic notes.
- **`src/components/video/VideoRoom.jsx`:** The universal in-browser telehealth consultation suite. Provides camera toggle, microphone mute/unmute, screen-sharing controls, call duration timers, and end-call wrap-up buttons.
- **`src/components/ErrorBoundary.jsx`:** A React Error Boundary that catches runtime rendering errors in any component and displays a polite recovery card with a reload button rather than crashing to a white screen.

---

### Pages & User Portals (`src/pages/`)

#### 1. Public & Onboarding Pages
- **`Landing.jsx`:** The homepage showcasing the platform's features, specialties, patient testimonials, and login/register calls-to-action.
- **`Login.jsx`:** The secure authentication page featuring role selection (Patient, Doctor, Administrator), email and password fields, and password recovery links.
- **`Register.jsx`:** Patient self-registration form.
- **`ForgotPassword.jsx` & `ResetPassword.jsx`:** Password recovery flow.
- **`Settings.jsx`:** Account preferences and live password update with bcrypt re-hashing.
- **`NotFound.jsx` & `AccessDenied.jsx`:** Friendly 404 and 403 error screens.

#### 2. Patient Portal (`src/pages/patient/`)
- **`PatientDashboard.jsx`:** Central overview showing the next upcoming visit, quick links to AI triage and doctor search, active prescriptions, and recent vitals.
- **`PatientTriage.jsx`:** Interactive AI symptom intake wizard that classifies urgency and recommends specialists.
- **`BookAppointment.jsx`:** Dynamic scheduling wizard where patients choose a specialty, select a verified doctor, pick an open time slot, and confirm booking.
- **`PatientAppointments.jsx`:** Comprehensive history of past and upcoming appointments with cancellation and rescheduling options.
- **`PatientPrescriptions.jsx`:** The prescription vault where patients can view medications, track active routines, and download verified PDF prescriptions.
- **`PatientRecords.jsx`:** Repository where patients upload external medical files, blood test results, and imaging scans.
- **`PatientProfile.jsx`:** Personal health profile storing blood group, recorded allergies, and emergency contacts.
- **`PatientVideoRoom.jsx`:** Telehealth meeting room for patients.

#### 3. Doctor Portal (`src/pages/doctor/`)
- **`DoctorDashboard.jsx`:** Doctor's landing screen highlighting today's appointments, pending tasks, and practice metrics.
- **`DoctorAppointments.jsx`:** The daily queue of patient visits with status filters and one-click video room access.
- **`DoctorCalendar.jsx`:** Schedule configuration interface where doctors set working hours, break periods, and block out vacation dates.
- **`DoctorConsultation.jsx`:** In-call clinical workspace featuring patient medical history, AI triage summaries, clinical note drafting, and the AI SOAP note generator.
- **`DoctorPatients.jsx` & `DoctorPatientDetails.jsx`:** Patient roster scoped strictly to patients who have active clinical relationships with this doctor.
- **`DoctorPrescriptions.jsx`:** Digital prescription writer with integrated drug catalog and the drug allergy & interaction safety guard.
- **`DoctorAnalytics.jsx`:** Practice metrics visualizing patient volume and top clinical diagnoses.

#### 4. Administrator Portal (`src/pages/admin/`)
- **`AdminDashboard.jsx`:** Clinic operational hub showing real-time platform statistics, pending doctor verifications, and system alerts.
- **`AdminDoctors.jsx`:** Credential vetting queue where administrators verify medical license numbers and approve new doctor accounts.
- **`AdminAppointments.jsx`:** Clinic-wide appointment radar with emergency reassignment and cancellation tools.
- **`AdminAnnouncements.jsx`:** Push announcement console broadcasting clinic-wide alerts via Server-Sent Events (SSE).
- **`AdminAuditLogs.jsx`:** Searchable audit trail displaying an immutable record of all logins, clinical actions, and record edits.
- **`AdminAnalytics.jsx`:** Aggregated health metrics across all clinic departments.

---

### API Client Services (`src/services/`)

The frontend abstracts all backend network communication through service modules:
- **`apiClient.js`:** Central HTTP helper wrapping native `fetch`. Automatically attaches JWT tokens, formats JSON requests, and standardizes error responses.
- **`authService.js`:** Handles login, registration, and session verification.
- **`appointmentService.js`:** Manages slot queries, booking creation, cancellations, and queue retrieval.
- **`doctorService.js`:** Fetches doctor profiles, working hours, and practice analytics.
- **`patientService.js`:** Queries patient histories, vitals logs, and uploaded files.
- **`prescriptionService.js`:** Communicates with the prescription engine and triggers safety checks.
- **`triageService.js`:** Sends symptom descriptions to the AI triage engine.
- **`adminService.js`:** Handles doctor verification, announcements, and audit log exploration.

---

### Utilities & Clinical Data (`src/utils/` & `src/data/`)

- **`prescriptionPdf.js`:** Uses `jspdf` to render and download official medical prescription documents bearing clinic letterhead, doctor credentials, and digital verification seals.
- **`calendarSync.js`:** Formats and triggers download of RFC 5545 compliant `.ics` calendar invitation files for Google Calendar, Apple Calendar, and Outlook.
- **`auditExport.js`:** Exports administrative audit logs to CSV format.
- **`drugCatalog.js`:** Standardized catalog of common medications, forms, dosages, and contraindications.
- **`icd10.js`:** Standard ICD-10 medical diagnostic codes for structured clinical documentation.

---

## 4. Backend Architecture (`backend/`)

The backend source code resides inside the [`backend/`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/backend) directory.

### Server Entry (`backend/server.js`)

`server.js` boots the Express 5 server:
1. Loads environment variables from `.env`.
2. Connects to PostgreSQL and verifies schema integrity (`initDb()`).
3. Starts the `pg-boss` background job queue (`initJobQueue()`).
4. Mounts global middleware: CORS, Helmet security headers, JSON body parsers, and rate limiters.
5. Mounts domain routers under `/api/*`.
6. Provides an active `/api/health` diagnostic endpoint.
7. Registers graceful shutdown handlers (`SIGTERM`, `SIGINT`) to close database pools and SSE streams cleanly.

---

### Database Layer (`backend/database/`)

- **[`db.js`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/backend/database/db.js):** Configures the `pg.Pool` connection pool connecting to Neon Cloud PostgreSQL. Exposes `query()` for executing SQL, `pingDb()` for latency monitoring, and `closePool()` for shutdowns.
- **[`schema.sql`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/backend/database/schema.sql):** The relational database schema:
  - `users`: Core authentication table (email, hashed password, role).
  - `patients`: Patient profiles (date of birth, gender, blood group, allergies).
  - `doctors`: Doctor profiles (specialty, license number, experience, verification status).
  - `doctor_schedules`: Working hours, break intervals, and slot durations.
  - `doctor_unavailability`: Blocked leave and vacation dates.
  - `appointments`: Booking records (patient_id, doctor_id, date, time_slot, status).
  - `prescriptions` & `prescription_items`: Structured medication records.
  - `medication_routines`: Active adherence tracking schedules.
  - `medical_records`: Patient document uploads.
  - `audit_logs`: Immutable security audit trail.
- **[`seed.js`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/backend/database/seed.js):** Idempotent database seeder that populates verified physicians (e.g., Dr. Arjun Patel, Cardiology) and sample patients for testing and evaluation.

---

### Security & Middleware (`backend/middleware/`)

- **[`auth.js`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/backend/middleware/auth.js):**
  - `requireAuth`: Validates incoming JWT tokens and injects `req.user`.
  - `requireRole(role)`: Blocks requests if the user's role does not match permissions.
  - `verifyDoctorPatientRelationship`: The **Zero-Trust Clinical Scoping** engine. If a doctor queries a patient's records, this middleware verifies whether an appointment exists between that doctor and patient. If not, it blocks access with `403 Forbidden`. Administrators bypass this check for clinic-wide governance.
- **`security.js`:**
  - `authLimiter`: Limits login attempts to 30 requests per 15 minutes per IP.
  - `apiLimiter`: General API rate limiter (300 requests per minute).

---

### API Routes (`backend/routes/`)

- **`auth.js`:** Handles user login, registration, password hashing (`bcrypt`), and profile password updates.
- **`doctors.js`:** Provides doctor listings, real-time available time-slot calculation (`/api/doctors/:id/available-slots`), leave management, and practice analytics.
- **`patients.js`:** Manages patient records, vitals logging, and medical history retrieval under strict relationship scoping.
- **`appointments.js`:** Handles appointment booking with atomic slot validation to prevent double-booking, daily waiting room queue retrieval (`/api/appointments/queue/today`), cancellation, and rescheduling.
- **`prescriptions.js`:** Houses the prescription builder and the **Drug Allergy & Interaction Safety Guard** (`/api/prescriptions/check-safety`).
- **`triage.js`:** Implements AI symptom intake using Google Gemini AI, backed by the deterministic medical rule matrix and emergency red-flag circuit breakers.
- **`messaging.js`:** Generates formatted WhatsApp deep links (`wa.me`) for appointment confirmations and late-patient video room pings, and serves RFC 5545 `.ics` calendar files.
- **`notifications.js`:** Manages the Server-Sent Events (SSE) stream (`/api/notifications/stream`), keeping open HTTP connections to push live updates to browsers.
- **`pharmacy.js`:** Manages active medication routines and timing schedules, with deduplication guards to prevent duplicate routine provisioning.
- **`admin.js`:** Houses administrative controls: doctor verification queue, appointment radar, clinic-wide announcements, audit log explorer, and system telemetry metrics (`/api/admin/system-health`).

---

### Background Services (`backend/services/`)

- **`jobQueue.js`:** Configures `pg-boss` to run background jobs natively inside PostgreSQL. Manages scheduled reminder jobs without requiring external Redis servers.
- **`emailService.js`:** Transactional email delivery powered by Resend. Includes an automatic fallback to email simulation mode if no API key is present in development.
- **`messagingService.js`:** Formats WhatsApp clinical notification URLs and calendar `.ics` data.

---

### Clinical Data (`backend/data/`)

- **`drugInteractions.js`:** A clinical interaction matrix containing drug-allergy contraindications and adverse drug-drug interaction pairs (e.g., Warfarin + Aspirin bleeding risks, Penicillin allergy cross-reactions).

---

## 5. End-to-End Clinical Data Flow Walkthrough

Here is how a real clinical scenario flows through the files in this codebase:

```text
1. INTAKE:
   Patient describes symptoms in PatientTriage.jsx
   ↳ Calls triageService.js
   ↳ POST /api/triage (routes/triage.js)
   ↳ Analyzed by Gemini AI (or fallback clinical matrix)
   ↳ Returns urgency: "Urgent", specialty: "Cardiology"

2. SCHEDULING:
   Patient chooses Dr. Arjun Patel in BookAppointment.jsx
   ↳ GET /api/doctors/:id/available-slots (routes/doctors.js)
   ↳ Calculates slots excluding booked slots & doctor leave dates
   ↳ Patient confirms slot -> POST /api/appointments (routes/appointments.js)
   ↳ Atomic SQL validation prevents double-booking
   ↳ Inserts appointment with status 'confirmed'
   ↳ Queues reminder job in pg-boss (services/jobQueue.js)
   ↳ Triggers calendarSync.js to generate appointment.ics

3. CONSULTATION:
   Doctor logs in -> Views Today's Queue in DoctorAppointments.jsx
   ↳ Both doctor and patient enter VideoRoom.jsx (/video/:appointmentId)
   ↳ WebRTC media streams connect audio, video, and screen sharing
   ↳ Doctor views patient past vitals and triage summary in DoctorConsultation.jsx
   ↳ Doctor drafts notes -> AI SOAP note drafter structures clinical documentation

4. PRESCRIPTION & WRAP-UP:
   Doctor adds medication in DoctorPrescriptions.jsx
   ↳ POST /api/prescriptions/check-safety (routes/prescriptions.js)
   ↳ Evaluates allergies and drug interactions (data/drugInteractions.js)
   ↳ Doctor issues prescription -> Saved to database
   ↳ Medication routine automatically provisioned (routes/pharmacy.js)
   ↳ Patient downloads official PDF prescription rendered by prescriptionPdf.js
```

---

## 6. Automated Regression Test Suite (`test_suite.mjs`)

The project includes an end-to-end automated test runner located in [`test_suite.mjs`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/test_suite.mjs). It executes 36 automated assertions across 8 core sections:

1. **Database Connectivity:** Verifies PostgreSQL ping latency and table population.
2. **Server Process Boot:** Spawns a dedicated test server instance on port 3005.
3. **Health & Auth:** Validates `/api/health`, rejects invalid logins (401), and authenticates patients, doctors, and admins.
4. **Doctor Schedules & Analytics:** Tests slot calculation, leave management, and practice analytics.
5. **Waiting Room Queue:** Tests today's live patient queue retrieval.
6. **Clinical Decision Support:** Verifies the allergy/interaction safety matrix, AI SOAP note drafting, and refill requests.
7. **Messaging & Calendar:** Validates WhatsApp link generation and RFC 5545 `.ics` formatting.
8. **Security & Clinical Scoping:** Enforces that unauthorized doctors receive `403 Forbidden` when attempting to access records of patients not under their care, while confirming admin oversight remains intact.

To run the test suite:
```bash
npm test
```
All 36 tests execute automatically and output clean pass/fail statuses.
