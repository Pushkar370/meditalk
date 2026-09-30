# MediTalk: Modern Telehealth & Clinical Care Platform

> A unified, trust-first virtual clinic platform connecting patients, doctors, and clinic administrators into a single digital healthcare journey.

[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen)]()
[![Automated Tests](https://img.shields.io/badge/Tests-36%20Passed-brightgreen)]()
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20(Neon)-blue)]()
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61dafb)]()
[![Node](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express%205-green)]()

---

## Table of Contents

- [The Problem MediTalk Solves](#the-problem-meditalk-solves)
- [The Three Portals](#the-three-portals)
- [Key Features](#key-features)
- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
- [Documentation Directory](#documentation-directory)
- [Testing & Quality Assurance](#testing--quality-assurance)

---

## The Problem MediTalk Solves

Modern healthcare is often fragmented and frustrating:
- **Patients** deal with phone holds, confusing paperwork, uncertainty about which medical specialist they need, and lost paper prescriptions.
- **Doctors** spend hours on repetitive documentation, checking drug allergies by hand, and struggling to access past patient history during remote consultations.
- **Clinic Administrators** lack unified real-time visibility into doctor availability, daily patient queues, and compliance audit trails.

**MediTalk** brings all three groups together under one digital roof. From the moment a patient describes a symptom to the moment they receive their verified digital prescription and take their medication, every step happens inside MediTalk with genuine clinical data and real security.

---

## The Three Portals

MediTalk provides dedicated, role-isolated workspaces:

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

1. **Patient Portal:** AI symptom intake, doctor booking, in-browser video calls, downloadable PDF prescriptions, vitals tracking, and medication routines.
2. **Doctor Portal:** Daily live waiting room queue, availability schedule manager, in-call clinical notes, drug allergy and interaction safety checks, and instant prescription issuing.
3. **Administrator Portal:** Doctor license verification queue, appointment intervention, real-time push announcements, audit log explorer, and live system telemetry.

---

## Key Features

- **AI Clinical Triage:** Evaluates symptoms in plain language to categorize urgency (Routine, Urgent, Emergency) and suggest appropriate specialists. Backed by a deterministic clinical rule matrix for guaranteed reliability.
- **Atomic Double-Booking Prevention:** Database-level slot validation ensures no two patients can ever book the same doctor at the same time.
- **Universal Telehealth Video Rooms:** In-browser encrypted video consultation rooms with camera, microphone, and screen-sharing controls—no external apps required.
- **Drug Allergy & Interaction Safety Guard:** Cross-checks proposed prescriptions against patient allergies and concurrent medications before issuance to prevent adverse drug events.
- **Automated AI SOAP Notes:** Converts consultation points into standard medical documentation (**S**ubjective, **O**bjective, **A**ssessment, **P**lan) with one click.
- **Instant Verified PDF Prescriptions:** Generates standardized, downloadable PDF prescriptions with clinical letterhead and digital verification seals using `jspdf`.
- **Zero-Cost WhatsApp & Calendar Sync:** Delivers RFC 5545 `.ics` calendar invites for Google/Apple/Outlook calendars, and pre-formatted WhatsApp deep links (`wa.me`) for instant patient notifications and late-patient video room alerts.
- **Zero-Trust Clinical Privacy:** Enforces strict clinical relationship scoping. Doctors can only access medical records for patients under their direct care. Unauthorized cross-patient lookups return `403 Forbidden`.

---

## Architecture Overview

MediTalk is built with a clean, decoupled client-server architecture:

```text
Frontend (React 18, Vite, Tailwind CSS, Lucide Icons)
       │
       ▼ HTTPS REST API + Server-Sent Events (SSE)
Backend (Node.js, Express 5, JWT Auth, RBAC, Rate Limiting)
       │
       ▼ Connection Pool (pg)
Database (Cloud PostgreSQL on Neon, pg-boss Job Queue)
```

For complete technical deep dives, explore our dedicated guides:
- [Codebase & Architecture Walkthrough](docs/CODEBASE_EXPLANATION.md)
- [Frontend Architecture Guide](docs/FRONTEND_ARCHITECTURE.md)
- [Backend Architecture Guide](docs/BACKEND_ARCHITECTURE.md)
- [Setup and Installation Guide](docs/SETUP_AND_INSTALLATION.md)
- [Complete Project History & Changelog](docs/PROJECT_HISTORY_AND_CHANGELOG.md)

---

## Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/Pushkar370/meditalk.git
cd meditalk/meditalk
npm install
```

### 2. Configure Environment (`.env`)
Create a `.env` file in the project root:
```env
PORT=3001
DATABASE_URL=postgresql://username:password@your-postgres-host.neon.tech/neondb?sslmode=require
JWT_SECRET=your_jwt_secret_key
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

## Documentation Directory

| Document | Purpose |
| :--- | :--- |
| **[Codebase Walkthrough](docs/CODEBASE_EXPLANATION.md)** | File-by-file breakdown of frontend, backend, routes, database, and clinical flow. |
| **[Setup & Installation](docs/SETUP_AND_INSTALLATION.md)** | Step-by-step local setup, environment variables, database seeding, and production builds. |
| **[Frontend Architecture](docs/FRONTEND_ARCHITECTURE.md)** | Guide to React components, the three user portals, routing guards, and design system. |
| **[Backend Architecture](docs/BACKEND_ARCHITECTURE.md)** | Deep dive into Express middleware, security, zero-trust privacy, SSE, and background jobs. |
| **[Project History & Changelog](docs/PROJECT_HISTORY_AND_CHANGELOG.md)** | Complete chronological story of the project from commit 1 to the present day, with challenges and solutions. |

---

## Testing & Quality Assurance

MediTalk includes an automated end-to-end regression test suite covering all 8 clinical domains:

```bash
npm test
```

```text
========================================
Results: 36 Passed, 0 Failed
========================================
```

All 36 test assertions pass, validating database connectivity, authentication, doctor availability, appointment queues, clinical safety checks, WhatsApp deep links, and patient privacy protections.
