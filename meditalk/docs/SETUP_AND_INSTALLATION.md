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

This installs all required packages, including React, Vite, Express, PostgreSQL driver (`pg`), background job queue (`pg-boss`), styling tools (`tailwindcss`), and PDF generation tools (`jspdf`).

---

## 4. Environment Configuration (`.env`)

In the project root directory, create a `.env` file (you can copy the provided `.env.example` file if present):

```bash
cp .env.example .env
```

Open `.env` in any text editor and fill in your configuration values:

```env
# Port on which the backend server will run
PORT=3001

# Cloud or Local PostgreSQL connection string with SSL
DATABASE_URL=postgresql://username:password@your-postgres-host.neon.tech/neondb?sslmode=require

# Secret string used to sign and verify JSON Web Tokens (JWT) for secure login
JWT_SECRET=meditalk_super_secret_production_key_2026

# Google Gemini API Key (Used for AI Symptom Intake & SOAP drafting)
# If left empty, MediTalk automatically falls back to its built-in clinical rule matrix!
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
> MediTalk is built so that if you do not have external API keys for Gemini or Resend, the application **does not crash**. It automatically uses deterministic clinical rules for symptom triage and logs appointment emails to the server console.

---

## 5. Database Setup & Seeding

Once your `DATABASE_URL` is set in `.env`, run the database initialization script. This creates all necessary tables (users, doctors, patients, appointments, prescriptions, audit logs) and seeds sample doctors and accounts:

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

## 7. Running the Automated Test Suite

MediTalk includes an end-to-end automated test suite (`test_suite.mjs`) that tests database health, login authentication, doctor availability, appointment queues, clinical safety checks, WhatsApp deep links, and patient privacy protections:

```bash
npm test
```

This runs 36 assertions across 8 core test suites. All 36 tests should pass with green checkmarks:
```text
========================================
Results: 36 Passed, 0 Failed
========================================
```

---

## 8. Building for Production

To create an optimized, minified production build of the frontend:

```bash
npm run build
```

This compiles all React components into static production assets in the `dist/` directory.

To start the production server:

```bash
npm start
```

---

## 9. Common Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| `ECONNREFUSED 127.0.0.1:5432` | Local PostgreSQL is not running or `DATABASE_URL` is incorrect. | Ensure your cloud PostgreSQL URL in `.env` is correct and has `?sslmode=require`. |
| `Port 3001 already in use` | Another process is already running on port 3001. | Terminate the existing node process or change `PORT=3002` in `.env`. |
| `Vite build warning: chunks > 500 kB` | Normal bundle warning for rich libraries (`jspdf`, `html2canvas`). | Safe to ignore; the application uses Vite code splitting for production. |
| Test suite reports port conflict | A previous test instance or dev server is holding port 3005. | Close running background node processes and re-run `npm test`. |
