# MediTalk: Setup and Installation Guide

This guide walks you through setting up and running **MediTalk** on your local machine, configuring environment variables, running the database, and executing the automated test suite.

---

## 1. Prerequisites

Before installing MediTalk, make sure you have the following installed on your computer:

- **Node.js**: Version 18 or higher (Version 20+ or 24+ recommended).
  - Check your version in terminal: `node -v`
- **npm**: Version 9 or higher (comes bundled with Node.js).
  - Check your version: `npm -v`
- **PostgreSQL Database**:
  - You can use a free cloud-hosted PostgreSQL database from [Neon](https://neon.tech) (recommended for ease of setup), or a local PostgreSQL instance running on your computer.
- **Git**: To clone and manage the repository.

---

## 2. Cloning the Repository

Open your terminal or command prompt and clone the repository:

```bash
git clone https://github.com/Pushkar370/meditalk.git
cd meditalk/meditalk
```

---

## 3. Installing Dependencies

MediTalk is configured with a unified root setup that installs dependencies for both the frontend and backend:

```bash
npm install
```

This installs all required packages, including React, Vite, Express 5, PostgreSQL driver (`pg`), background job queue (`pg-boss`), styling tools (`tailwindcss`), and PDF generation tools (`jspdf`).

---

## 4. Environment Configuration (`.env`)

In the project root directory, create a `.env` file (you can copy the provided `.env.example` file):

```bash
cp .env.example .env
```

Open `.env` in any text editor and configure your environment variables:

```env
# Port on which the backend server will run
PORT=3001

# Cloud or Local PostgreSQL connection string with SSL
DATABASE_URL=postgresql://username:password@your-postgres-host.neon.tech/neondb?sslmode=require

# Secret string used to sign and verify JSON Web Tokens (JWT) for secure login (min 32 characters)
JWT_SECRET=meditalk_super_secret_production_key_2026_minimum_32_characters

# Google Gemini API Key (Used for AI Symptom Intake & SOAP drafting)
# If left empty, MediTalk automatically falls back to its built-in deterministic clinical rule matrix!
GEMINI_API_KEY="your-gemini-api-key"

# Resend API Key (Used for automated transactional appointment emails)
# If left empty, the server automatically switches to email simulation mode!
RESEND_API_KEY=your_resend_api_key

# Default sender address for outgoing transactional emails
EMAIL_FROM=MediTalk <onboarding@resend.dev>

# Frontend URL (Used for CORS permissions)
FRONTEND_URL=http://localhost:5173
```

> **Note on Resilient Defaults:** 
> MediTalk is engineered so that if you do not have external API keys for Gemini or Resend, the application **does not crash**. It automatically uses deterministic clinical rules for symptom triage and logs appointment emails to the server console.

---

## 5. Database Setup & Seeding

Once your `DATABASE_URL` is set in `.env`, run the database initialization and seeding script:

```bash
npm run seed
```

You should see:
```text
🐘 Connected to PostgreSQL
📋 Database schema initialized
🌱 Seeding default users, doctors, and sample appointments...
✅ Seeding completed successfully!
```

---

## 6. Running the Application Locally

You can run both the frontend and backend simultaneously using a single command:

```bash
npm run dev
```

This starts:
1. **Frontend Dev Server (Vite):** Accessible in your browser at `http://localhost:5173`
2. **Backend API Server (Express):** Accessible at `http://localhost:3001` (Health check at `http://localhost:3001/api/health`)

### Running Services Separately (Optional)
If you prefer running the frontend and backend in separate terminal windows:
- **Terminal 1 (Backend Server only):**
  ```bash
  npm run server
  ```
- **Terminal 2 (Frontend Client only):**
  ```bash
  npm run client
  ```

---

## 7. Demo Credentials for Testing

All test accounts are pre-seeded in the database with the default password `password`:

| Role | Role Tab on Login | Email | Password | User Name |
| :--- | :--- | :--- | :--- | :--- |
| **Patient** | `Patient` | `patient@meditalk.com` | `password` | Aarav Sharma |
| **Doctor** | `Doctor` | `doctor@meditalk.com` | `password` | Dr. Sneha Menon (General Medicine) |
| **Doctor (Specialist)** | `Doctor` | `arjun.patel@meditalk.com` | `password` | Dr. Arjun Patel (Cardiology) |
| **Nurse** | `Nurse` | `nurse@meditalk.com` | `password` | Nurse Clara Barton |
| **Receptionist** | `Receptionist` | `receptionist@meditalk.com` | `password` | Sarah Jenkins (Reception) |
| **Administrator** | `Administrator` | `admin@meditalk.com` | `password` | Admin User |

> *Tip: On the login page (`/login`), click the role button corresponding to the account before signing in.*

---

## 8. Testing & Quality Assurance

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

## 9. Building for Production

To create an optimized, minified production build of the frontend:

```bash
npm run build
```

This compiles React components into the `dist/` folder, ready for deployment to any static host or reverse proxy.
