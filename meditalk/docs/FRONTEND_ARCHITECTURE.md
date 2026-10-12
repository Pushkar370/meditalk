# MediTalk: Frontend Architecture Guide

This document explains how the frontend of **MediTalk** is built, how its pages and components are structured across all five clinical portals, and how the user interface interacts with the backend.

---

## 1. Overview & Technology Stack

The frontend is a modern **Single Page Application (SPA)** designed for clinical speed, accessibility, and zero-latency user feedback. It is built with:

- **React 18**: The industry-standard library for building component-driven user interfaces with concurrent rendering.
- **Vite**: A next-generation frontend build tool providing near-instant development startup and optimized production bundling.
- **React Router DOM (v6)**: Handles client-side navigation between pages with nested layouts and role-based route guards.
- **Tailwind CSS**: A utility-first styling system customized with a soothing, professional healthcare color palette.
- **Lucide React**: Clean, accessible vector icons for clinical actions, navigation, and indicators.
- **jsPDF & html2canvas**: Generates standardized, downloadable PDF prescriptions and clinical summaries directly in the browser.

---

## 2. Design System & User Experience

Healthcare applications can often feel cold, intimidating, or visually cluttered. MediTalk was intentionally designed with a warm, calming aesthetic:

- **Color Palette:**
  - **Sage & Emerald:** Calming greens representing wellness, health, and verified actions.
  - **Cream & Soft Slate:** Gentle background tones that reduce eye strain during extended clinical shifts.
  - **Midnight Ink:** High-contrast, legible typography for medical review and clinical charts.
  - **Amber & Coral:** Clear warning and emergency badges for urgent medical triage and contraindication warnings.
- **Accessibility & Responsiveness:** All views adapt cleanly across desktop monitors, tablets, and mobile screens. Collapsible menus, responsive video control bars, and readable font sizes ensure high usability for both young tech-savvy patients and elderly users.

---

## 3. The Five Clinical Portals

MediTalk provides five completely distinct workspaces tailored to the operational needs of each healthcare role:

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

### A. The Patient Portal (`/patient/*`)
Focused on self-service, clarity, and proactive health tracking:
1. **AI Symptom Intake Wizard:** Patients describe symptoms in everyday words. The AI analyzes urgency (Routine, Urgent, Emergency), advises next steps, and filters doctor search results to the appropriate medical specialty.
2. **Interactive Doctor Catalog & Booking:** Displays verified doctors with photos, specialties, ratings, and real-time open slots.
3. **Universal Video Consultation Room:** Patients enter remote video calls directly in their browser—no downloads or third-party meeting links required.
4. **Prescription Vault:** Instant access to all current and past prescriptions with a single click to download verified, printable PDFs.
5. **Vitals Tracker:** Patients log blood pressure, resting heart rate, blood glucose, and body temperature, visualized in historical trend charts.
6. **Active Medication Routines:** Tracks medication adherence with timing schedules (Morning, Afternoon, Evening, Bedtime).

### B. The Doctor Portal (`/doctor/*`)
Focused on clinical efficiency, reducing documentation burden, and patient safety:
1. **Today's Live Waiting Room Queue:** Shows the physician their daily patient queue in chronological order, displaying check-in statuses, visit reasons, and direct links to enter the video room.
2. **Schedule & Availability Manager:** Doctors set their standard working days, clinic hours, break intervals, and block out vacation/leave dates so appointments are never double-booked.
3. **Clinical Consultation Workspace:** During a visit, doctors have a split view with the patient’s past history on one side and clinical note-taking on the other.
4. **Drug Allergy & Interaction Safety Guard:** When prescribing medication, the system automatically checks the proposed drug against the patient's recorded allergies and active medications, highlighting dangerous interactions before the prescription is issued.
5. **Automated AI SOAP Note Drafter:** Transforms consultation points into structured medical documentation (**S**ubjective complaint, **O**bjective examination, **A**ssessment, **P**lan) with one click.

### C. The Administrator Portal (`/admin/*`)
Focused on clinic governance, regulatory compliance, and platform stability:
1. **Doctor Credential Verification Queue:** Every newly registered doctor is held in pending review until clinic administrators inspect their medical license and credentials.
2. **Appointment Intervention Radar:** Clinic managers can view all upcoming consultations across every department, with the ability to reassign or cancel appointments in an emergency.
3. **Live Broadcast Announcements:** Push urgent notifications (e.g., clinic closures, emergency alerts) to all connected users in real time via Server-Sent Events.
4. **Cryptographic Audit Log Explorer:** Searchable, permanent records of every system event with IP addresses, user agents, timestamps, and an interactive **"Verify Log Integrity"** modal that recalculates the full SHA-256 blockchain hash chain back to Genesis.
5. **System Health & Telemetry:** Real-time visibility into database connection pool utilization, query response latency in milliseconds, Node.js memory consumption, and process uptime.

### D. The Nurse Portal (`/nurse/*`)
Focused on pre-consultation patient intake and triage readiness:
1. **Pre-Consultation Vitals Recording Queue:** Nurses view today's incoming patient queue and record vital signs:
   - Blood Pressure (Systolic / Diastolic)
   - Heart Rate (BPM)
   - Blood Oxygen Saturation (SpO2 %)
   - Body Temperature (°C / °F)
   - Blood Glucose (mg/dL)
2. **Instant Doctor Synchronization:** Once recorded, vitals are immediately attached to the scheduled consultation record so the doctor sees them in their consultation workspace.

### E. The Receptionist Portal (`/receptionist/*`)
Focused on physical check-in coordination and front-desk logistics:
1. **Patient Check-in Queue:** Receptionists manage today's schedule, mark patients as arrived, and direct them to waiting rooms or virtual queues.
2. **Privacy-Preserving Redaction:** Under zero-trust privacy rules, sensitive medical triage summaries, clinical diagnoses, and consultation notes are strictly redacted from front-desk views.

---

## 4. Modern Landing Page (`/`)

The public landing page (`src/pages/Landing.jsx`) acts as the front door to the platform:
- **Hero Presentation:** Clear value proposition highlighting virtual consultations, AI triage, and zero-wait queues.
- **Intelligent Session Awareness:** Detects authenticated sessions and provides a direct "Go to Dashboard" button routing to the user's specific portal.
- **Emergency Circuit-Breaker Banner:** Direct hotline guidance (`112 / 911 / 108`) for acute emergencies.
- **Portal Showcase:** Visual breakdown of the five clinical portals and key system capabilities.

---

## 5. Routing & Role-Based Route Guards

Client-side routing is organized in [`src/App.jsx`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/src/App.jsx). 

To prevent unauthorized access across all five portals:
- **`<ProtectedRoute>` Component:** Checks if the user is authenticated. If no valid token exists, the user is automatically redirected to the login page with their intended destination preserved.
- **`<RoleRoute>` Component:** Verifies that the user's role matches the required permission level. If a patient attempts to access `/admin/dashboard` or `/doctor/queue`, they are politely redirected to their appropriate portal with a toast alert.

---

## 6. State Management & Real-Time Data Flow

Instead of heavyweight state libraries that add unnecessary complexity, MediTalk uses a clean, predictable architecture:

1. **`AuthContext` (`src/context/AuthContext.jsx`):**
   - Stores current user information (`id`, `name`, `email`, `role`).
   - Handles login, logout, and token persistence in `localStorage`.
   - Synchronizes state immediately whenever a user updates their profile details.

2. **`NotificationContext` (`src/context/NotificationContext.jsx`):**
   - Connects to the backend's persistent SSE stream (`/api/notifications/stream`) only when authenticated.
   - Pushes live notifications into the notification bell badge across all portals.

3. **React Error Boundary (`src/components/ErrorBoundary.jsx`):**
   - Wraps the top-level application and major layout trees.
   - Catches unexpected rendering crashes and displays a clean recovery screen with a "Refresh" button rather than breaking into an unresponsive white screen.
