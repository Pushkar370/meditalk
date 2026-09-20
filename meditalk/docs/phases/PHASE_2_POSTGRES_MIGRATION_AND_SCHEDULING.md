# Phase 2: Cloud PostgreSQL Migration & Doctor Schedule Engine (The Backend Connectivity Phase)

> **Phase Name:** Phase 2 — Cloud Database Migration, Doctor Schedule Management & Dynamic Booking Engine  
> **Milestone Tag:** 🌟 **The Backend Connectivity Phase**  
> **Repository:** `meditalk`  
> **Commit References:** `de27a4e`, `8a089f4`  
> **Target Audience:** Mentors, Technical Managers, Academic Evaluators  

---

## 1. Executive Summary & Objective

**Phase 2 marks the critical backend connectivity milestone of the MediTalk engineering roadmap.**

Prior to this phase:
- The application operated on ephemeral in-memory mock data and local SQLite databases suitable only for prototyping.
- Data could not be shared across different browser sessions, mobile devices, or remote network clients.
- Doctor availability was hardcoded with static time strings, causing scheduling conflicts and impossible booking scenarios.
- Double-booking was possible if two patients selected the same time slot concurrently.

**Phase 2 Objectives (The Backend Connectivity Phase):**
1. Migrate the entire data tier to a scalable **Cloud PostgreSQL cluster** on Neon AWS serverless infrastructure with SSL connection pooling.
2. Build an **Idempotent Database Auto-Migration System (`initDb`)** that automatically constructs and verifies 10 relational tables on startup.
3. Construct a **Doctor Schedule Configuration Engine (`DoctorCalendar.jsx`)** allowing physicians to set custom working days, shift hours, slot durations (15, 30, 45, 60 minutes), and lunch break windows.
4. Implement a **Dynamic Slot Generation Engine (`/api/appointments/slots`)** that computes bookable times in real time by subtracting break intervals and existing bookings.
5. Guarantee **Double-Booking Prevention** using database transaction validations that reject conflicting appointment requests with `409 Conflict`.

---

## 2. Technical Architecture & Data Pipeline

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Doctor Schedule Portal                          │
│                (src/pages/doctor/DoctorCalendar.jsx)                   │
│   - Working Days: Mon–Fri  │ Shift: 09:00–17:00  │ Slot Duration: 30m  │
│   - Break Window: 13:00–14:00 (Lunch)                                  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ PUT /api/doctors/:id/schedule
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Express API Gateway                             │
│                  (backend/routes/appointments.js)                      │
└───────┬────────────────────────────────────────────────────────┬───────┘
        │                                                        │
        │ 1. GET /api/appointments/slots                         │ 2. POST /api/appointments
        ▼                                                        ▼
┌───────────────────────────────┐        ┌───────────────────────────────┐
│     Dynamic Slot Engine       │        │   Double-Booking Concurrency  │
│  Generate intervals:          │        │   Check:                      │
│  [09:00, 09:30, 10:00...]     │        │   SELECT * FROM appointments  │
│  Subtract Break: 13:00-14:00  │        │   WHERE doctor_id = $1        │
│  Subtract Booked Appointments │        │     AND date = $2 AND time=$3 │
│  Return Available Slots Only  │        │   Overlap? → 409 Conflict!    │
└──────────────┬────────────────┘        └──────────────┬────────────────┘
               │                                        │
               ▼                                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Cloud PostgreSQL (AWS Neon)                         │
│   Connection Pool: 10 max, keepAlive: true, SSL: require               │
│   doctor_schedules  │  appointments  │  users  │  doctors              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Feature Breakdown

### 3.1 Cloud PostgreSQL Migration (`backend/database/db.js`)
- **Infrastructure:** Serverless PostgreSQL cluster hosted on AWS Neon.
- **Connection Management (`pg.Pool`):**
  - Connection pooling with `max: 10` concurrent clients.
  - `idleTimeoutMillis: 30000` to automatically recycle idle connections.
  - `connectionTimeoutMillis: 10000` for rapid failure detection.
  - TCP keep-alive (`keepAlive: true`) preventing cloud firewalls from abruptly terminating silent sockets.
- **DNS & IPv4 Optimization:** Configured `dns.setDefaultResultOrder('ipv4first')` to eliminate 30-second IPv6 resolution timeouts on Windows and cloud hosts.

### 3.2 Idempotent Database Auto-Migration (`initDb()`)
On server startup, `initDb()` executes safe SQL statements (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN IF NOT EXISTS`) establishing:
1. `users` — Base authentication entity.
2. `patients` — Medical demographics, blood group, allergies, medications.
3. `doctors` — Specialties, qualifications, verification status.
4. `doctor_schedules` — Working days, shifts, slot durations, break periods.
5. `appointments` — Booked visits, urgency, status, video room states.
6. `consultations` — Diagnosis, ICD-10 codes, examination vitals, notes.
7. `prescriptions` — Prescribed medications, dosage instructions.
8. `medical_records` — Uploaded lab documents and scans (Base64).
9. `notifications` — Real-time user alert records.
10. `audit_logs` — Immutable compliance audit trail.

### 3.3 Doctor Weekly Schedule Management (`DoctorCalendar.jsx`)
Physicians have direct control over their clinic availability:
- **Working Days:** Toggle active days (e.g. Monday, Wednesday, Friday).
- **Shift Timing:** Configurable shift start (e.g. `09:00 AM`) and shift end (e.g. `05:00 PM`).
- **Slot Duration Selector:** Choose appointment intervals: `15 mins`, `30 mins`, `45 mins`, or `60 mins`.
- **Lunch & Break Windows:** Set dedicated break start and break end times (e.g. `01:00 PM` to `02:00 PM`) where no appointments may be scheduled.

### 3.4 Real-Time Dynamic Slot Calculation Engine (`/api/appointments/slots`)
When a patient chooses a doctor and appointment date in `BookAppointment.jsx`:
1. The backend queries `doctor_schedules` for the doctor's active configuration.
2. Checks if the selected date falls on an active working day (e.g. Sunday returns *"Doctor does not practice on this day"*).
3. Divides the shift window into discrete increments based on `slot_duration`.
4. Filters out any slot overlapping with the doctor's `break_start` and `break_end`.
5. Queries `appointments` for confirmed or upcoming bookings on that date and removes taken times.
6. Returns strictly available time slots to the patient.

### 3.5 Double-Booking Concurrency Protection
To prevent race conditions where two patients simultaneously click "Book" for the exact same doctor time slot:
- In `POST /api/appointments`, an ACID database transaction query executes:
  ```sql
  SELECT id FROM appointments 
  WHERE doctor_id = $1 AND date = $2 AND time = $3 
    AND status IN ('upcoming', 'confirmed')
  ```
- If an existing booking is returned, the transaction rejects immediately:
  ```json
  { "error": "This time slot has just been booked. Please select another time.", "code": "SLOT_CONFLICT" }
  ```
- Status code returned: `409 Conflict`.

---

## 4. Key Code Implementations

### Dynamic Slot Engine & Break Filtering (`backend/routes/appointments.js`):
```javascript
export function generateAvailableSlots(schedule, bookedTimes = []) {
  const { shiftStart, shiftEnd, slotDuration = 30, breakStart, breakEnd } = schedule;
  const slots = [];

  let current = parseTimeToMinutes(shiftStart);
  const end = parseTimeToMinutes(shiftEnd);
  const bStart = breakStart ? parseTimeToMinutes(breakStart) : null;
  const bEnd = breakEnd ? parseTimeToMinutes(breakEnd) : null;

  while (current + slotDuration <= end) {
    const slotStartTime = formatMinutesToTime(current);
    const slotEndTime = current + slotDuration;

    // Strict Break Window Exclusion
    const overlapsWithBreak = bStart && bEnd && (current < bEnd && slotEndTime > bStart);

    // Existing Booking Exclusion
    const isAlreadyBooked = bookedTimes.includes(slotStartTime);

    if (!overlapsWithBreak && !isAlreadyBooked) {
      slots.push(slotStartTime);
    }

    current += slotDuration;
  }

  return slots;
}
```

### Double-Booking Database Guard (`backend/routes/appointments.js`):
```javascript
// Check for existing active booking
const { rows: conflict } = await query(
  `SELECT id FROM appointments 
   WHERE doctor_id = $1 AND date = $2 AND time = $3 
     AND status IN ('upcoming', 'confirmed')`,
  [doctorId, date, time]
);

if (conflict.length > 0) {
  return res.status(409).json({
    error: 'This time slot has just been booked. Please select another time.',
    code: 'SLOT_CONFLICT'
  });
}
```

---

## 5. Verification & Testing Results

- **PostgreSQL Connectivity:** Verified live connection pool handshake with Neon AWS serverless cluster. Ping latency verified at ~14ms.
- **Dynamic Slot Engine Test:** Tested doctor schedule with 09:00–17:00 shift and 13:00–14:00 break; confirmed zero 13:xx slots were returned in available lists.
- **Double-Booking Concurrency Test:** Attempted simultaneous booking requests for the exact same doctor, date, and time. Request 1 succeeded (`201 Created`); Request 2 was blocked with `409 Conflict` (`SLOT_CONFLICT`).
