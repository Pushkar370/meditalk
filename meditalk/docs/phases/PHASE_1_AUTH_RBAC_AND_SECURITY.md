# Phase 1: Security, Role-Based Access Control (RBAC) & Core Authentication

> **Phase Name:** Phase 1 — Security, Role-Based Access Control (RBAC) & Core Authentication Enforcement  
> **Repository:** `meditalk`  
> **Commit Reference:** `6cce3cf`  
> **Target Audience:** Mentors, Technical Managers, Academic Evaluators  

---

## 1. Executive Summary & Objective

In **Phase 1**, MediTalk laid the architectural foundation of the entire system: **Identity, Authentication, and Access Control**. 

In any medical management software handling Protected Health Information (PHI), access security is non-negotiable. Patients must never view clinical records belonging to others, doctors must have authorized write access to clinical charts, and administrators must maintain governance privileges without compromising clinical confidentiality.

**Phase 1 Objectives:**
1. Design and enforce strict **Role-Based Access Control (RBAC)** across three distinct system actors: `patient`, `doctor`, and `admin`.
2. Implement industry-standard cryptographic password hashing using **`bcryptjs`** (salt factor 10) to prevent credential exposure.
3. Establish stateless, secure authentication using **JSON Web Tokens (JWT)** with verifiable role claims and expiration windows.
4. Build dual-layer routing guards:
   - **Backend Guard Rails:** Express middleware (`requireAuth`, `requireRole`) protecting all private API endpoints.
   - **Frontend Navigation Guards:** React Router `<ProtectedRoute />` components blocking unauthorized view rendering.
5. Create role-encapsulated layout containers ensuring sidebars, topbars, and navigation strictly match authorized privileges.

---

## 2. Technical Architecture & Authentication Pipeline

```
                              [User Credentials]
                           (Email, Password, Role)
                                     │
                                     ▼
                           POST /api/auth/login
                                     │
                                     ▼
                ┌──────────────────────────────────────────┐
                │      Express Authentication Handler      │
                │        (backend/routes/auth.js)          │
                └────────────────────┬─────────────────────┘
                                     │
                                     ▼
                ┌──────────────────────────────────────────┐
                │      bcrypt.compare(password, hash)      │
                └────────────────────┬─────────────────────┘
                                     │ Pass?
                      ┌──────────────┴──────────────┐
                      ▼                             ▼
                 [401 Reject]             [Generate Signed JWT]
                                          { id, role, email }
                                                    │
                                                    ▼
                                          Return Token to Client
                                                    │
                      ┌─────────────────────────────┴────────────────────────────┐
                      ▼                                                          ▼
      ┌───────────────────────────────┐                          ┌───────────────────────────────┐
      │  Frontend Route Guard         │                          │  Backend Middleware Guard     │
      │  (src/components/             │                          │  (backend/middleware/auth.js) │
      │   ProtectedRoute.jsx)         │                          │                               │
      │  - Verify token in storage    │                          │  - Bearer Token Verification  │
      │  - Match route allowed role   │                          │  - Inject req.user context    │
      │  - Render or redirect         │                          │  - 403 Forbidden on mismatch  │
      └───────────────────────────────┘                          └───────────────────────────────┘
```

---

## 3. Detailed Feature Breakdown

### 3.1 Cryptographic Password Security (`bcryptjs`)
- **Hashing Algorithm:** Passwords are never stored in plaintext. Upon registration (`POST /api/auth/register`), passwords are processed through `bcrypt.hash(password, 10)`.
- **Authentication Verification:** During login, `bcrypt.compare(inputPassword, storedHash)` evaluates the cryptographic hash in constant time, defending against timing attacks.

### 3.2 Stateless JWT Token Architecture (`jsonwebtoken`)
- **Signed Claims:** Tokens contain user identity (`id`), email, and authorization level (`role`).
- **Signature Secret:** Cryptographically signed using a strong server-side secret (`JWT_SECRET`).
- **Token Delivery:** Transmitted in JSON response and attached by client services in the `Authorization: Bearer <token>` header for all subsequent API requests.

### 3.3 Backend Authorization Middleware (`backend/middleware/auth.js`)
Two composable middleware functions protect all server routes:
1. **`requireAuth(req, res, next)`**:
   - Extracts the Bearer token from the `Authorization` header.
   - Calls `jwt.verify(token, JWT_SECRET)`.
   - Injects the authenticated user payload into `req.user`.
   - Returns `401 Unauthorized` if token is absent, invalid, or expired.
2. **`requireRole(...allowedRoles)`**:
   - Higher-order middleware evaluating `allowedRoles.includes(req.user.role)`.
   - If an authenticated patient attempts to hit `/api/consultations` or `/api/admin/doctors`, the request is immediately aborted with `403 Forbidden`.

### 3.4 Frontend Route Protection (`src/components/ProtectedRoute.jsx`)
- Built using React Router v6 `<Outlet />` patterns.
- Evaluates `isAuthenticated` and `user.role` from `AuthContext`.
- **Redirection Logic:**
  - Unauthenticated visitor attempting to access private routes → redirected to `/login`.
  - Authenticated user attempting to access another role's dashboard (e.g. Doctor visiting `/admin/audit-logs`) → redirected to `/access-denied`.

### 3.5 Role-Encapsulated Layout System
- Dedicated layout wrappers:
  - `PatientLayout.jsx`: Injects patient navigation (Appointments, Health Records, Prescriptions, AI Triage).
  - `DoctorLayout.jsx`: Injects clinical staff navigation (Doctor Appointments, Patient Records, Calendar Shifts, Prescriptions).
  - `AdminLayout.jsx`: Injects hospital governance navigation (Doctor Verification, System Analytics, Audit Logs, Announcements).

---

## 4. Key Code Implementations

### Authorization Middleware (`backend/middleware/auth.js`):
```javascript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'meditalk-default-dev-secret';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
}
```

### React Route Guard (`src/components/ProtectedRoute.jsx`):
```javascript
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ role }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role && user?.role !== role) return <Navigate to="/access-denied" replace />;

  return <Outlet />;
}
```

---

## 5. Verification & Quality Assurance

- **Penetration & RBAC Testing:**
  - Tested accessing `/api/admin/doctors` using a patient token → accurately returned `403 Forbidden`.
  - Tested accessing private endpoints without Authorization header → accurately returned `401 Unauthorized`.
- **Credential Security:**
  - Confirmed database inspection reveals only salted bcrypt hashes (`$2a$10$...`) for user records, with zero plaintext passwords.
- **Client Flow Validation:**
  - Validated role-based redirection: logging in as a Doctor lands on `/doctor/dashboard`, Patient on `/patient/dashboard`, Admin on `/admin/dashboard`.
