# MediTalk: Frontend Architecture Guide

This document explains how the frontend of **MediTalk** is built, how its pages and components are structured, and how the user interface interacts with the backend.

---

## 1. Overview & Technology Stack

The frontend is a modern **Single Page Application (SPA)** designed for speed, clarity, and ease of use. It is built with:

- **React 18**: The industry-standard library for building component-driven user interfaces.
- **Vite**: A next-generation frontend build tool providing near-instant development startup and optimized production bundling.
- **React Router DOM (v6)**: Handles client-side navigation between pages without reloading the whole browser.
- **Tailwind CSS**: A utility-first styling system customized with a soothing, professional healthcare color palette.
- **Lucide React**: Clean, accessible vector icons for clinical actions, navigation, and indicators.
- **jsPDF & html2canvas**: Generates standardized, downloadable PDF prescriptions and clinical summaries directly in the patient's browser.

---

## 2. Design System & User Experience

Healthcare applications can often feel cold, intimidating, or visually cluttered. MediTalk was intentionally designed with a warm, calming aesthetic:

- **Color Palette:**
  - **Sage & Emerald:** Calming greens representing wellness, health, and verified actions.
  - **Cream & Soft Slate:** Gentle background tones that reduce eye strain during extended use.
  - **Midnight Ink:** High-contrast, legible typography for clinical reading.
  - **Amber & Coral:** Clear warning and emergency badges for urgent medical triage.
- **Accessibility & Responsiveness:** All views adapt cleanly across desktop monitors, tablets, and mobile screens. Collapsible menus, responsive video control bars, and readable font sizes ensure high usability for both young tech-savvy patients and elderly users.

---

## 3. The Three User Portals

MediTalk provides three completely distinct workspaces tailored to the needs of each role:

```
                         ┌────────────────────┐
                         │   Authentication   │
                         │    (Role Check)    │
                         └─────────┬──────────┘
           ┌───────────────────────┼───────────────────────┐
           ▼                       ▼                       ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│   PATIENT PORTAL    │ │    DOCTOR PORTAL    │ │    ADMIN PORTAL     │
│ • AI Symptom Triage │ │ • Today's Queue     │ │ • Doctor Vetting    │
│ • Doctor Search     │ │ • Availability Mgr  │ │ • Appointment Radar │
│ • Booking Wizard    │ │ • In-Call Room      │ │ • Announcements     │
│ • Video Room        │ │ • Drug Safety Guard │ │ • Audit Log View    │
│ • My Prescriptions  │ │ • SOAP Note Drafter │ │ • System Telemetry  │
│ • Vitals Tracking   │ │ • Prescription Pub  │ │                     │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

### A. The Patient Portal (`/patient/*`)
Focused on self-service, clarity, and proactive health tracking:
1. **AI Symptom Intake Wizard:** Patients describe their symptoms in everyday words. The AI analyzes urgency (Routine, Urgent, Emergency), advises next steps, and filters doctor search results to the appropriate medical specialty.
2. **Interactive Doctor Catalog & Booking:** Displays verified doctors with photos, specialties, ratings, and real-time open slots.
3. **Universal Video Consultation Room:** Patients enter remote video calls directly in their browser—no downloads or third-party meeting links required.
4. **Prescription Vault:** Instant access to all current and past prescriptions with a single click to download verified, printable PDFs.
5. **Vitals Tracker:** Patients log blood pressure, resting heart rate, blood glucose, and body temperature, visualized in historical trend charts.
6. **Active Medication Routines:** Tracks medication adherence with timing schedules (Morning, Afternoon, Evening, Bedtime).

### B. The Doctor Portal (`/doctor/*`)
Focused on clinical efficiency, reducing typing burden, and patient safety:
1. **Today's Live Waiting Room Queue:** Shows the physician their daily patient queue in chronological order, displaying check-in statuses, visit reasons, and direct links to enter the video room.
2. **Schedule & Availability Manager:** Doctors set their standard working days, clinic hours, break intervals, and block out vacation/leave dates so appointments are never double-booked.
3. **Clinical Consultation Workspace:** During a visit, doctors have a split view with the patient’s past history on one side and clinical note-taking on the other.
4. **Drug Allergy & Interaction Safety Guard:** When prescribing medication, the system automatically checks the proposed drug against the patient's recorded allergies and active medications, highlighting dangerous interactions before the prescription is issued.
5. **Automated AI SOAP Note Drafter:** Transforms consultation points into structured medical documentation (**S**ubjective complaint, **O**bjective examination, **A**ssessment, **P**lan) with one click.

### C. The Administrator Portal (`/admin/*`)
Focused on clinic governance, compliance, and platform stability:
1. **Doctor Credential Verification Queue:** Every newly registered doctor is held in pending review until clinic administrators inspect their medical license and credentials.
2. **Appointment Intervention Radar:** Clinic managers can view all upcoming consultations across every department, with the ability to reassign or cancel appointments in an emergency.
3. **Live Broadcast Announcements:** Push urgent notifications (e.g., clinic closures, emergency alerts) to all connected users in real time.
4. **Immutable Audit Log Explorer:** Searchable, permanent records of every system event—logins, password changes, appointment status changes, and prescription issuances—complete with IP addresses and timestamps.
5. **System Health & Telemetry:** Real-time visibility into database connection pool utilization, query response latency in milliseconds, Node.js memory consumption, and process uptime.

---

## 4. Routing & Role-Based Route Guards

Client-side routing is organized in [`src/App.jsx`](file:///c:/Users/ASUS/OneDrive/Desktop/meditalk/meditalk/src/App.jsx). 

To prevent unauthorized access (e.g., a patient trying to open the Admin Dashboard or a doctor attempting to open another doctor's portal):
- **`<ProtectedRoute>` Component:** Checks if the user is authenticated. If no valid token exists, the user is automatically redirected to the login page with their intended destination preserved.
- **`<RoleRoute>` Component:** Verifies that the user's role matches the required permission level. If a patient attempts to access `/admin/dashboard`, they are politely redirected to `/patient/dashboard` with a toast alert.

---

## 5. State Management & Real-Time Data Flow

Instead of heavyweight state libraries that add unnecessary complexity, MediTalk uses a clean, predictable architecture:

1. **`AuthContext` (`src/context/AuthContext.jsx`):**
   - Stores current user information (`id`, `name`, `email`, `role`).
   - Handles login, logout, and token persistence in `localStorage`.
   - Synchronizes state immediately whenever a user updates their profile details.

2. **Server-Sent Events (SSE) Listener:**
   - Active portal views connect to the backend's persistent SSE stream (`/api/notifications/stream`).
   - When the backend broadcasts a new appointment, prescription update, or clinic announcement, the UI updates automatically without the user having to refresh the page.

3. **React Error Boundary (`src/components/ErrorBoundary.jsx`):**
   - Wraps the top-level application and major layout trees.
   - If an unexpected error occurs during component rendering, the Error Boundary catches the crash and displays a helpful recovery screen with a "Refresh" button rather than breaking the application into an unresponsive white screen.
