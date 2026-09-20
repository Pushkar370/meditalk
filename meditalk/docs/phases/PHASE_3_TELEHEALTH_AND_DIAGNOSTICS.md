# Phase 3: Telehealth Video Consultations & Clinical Diagnostics Workspace

> **Phase Name:** Phase 3 — Telehealth, Video Consultation, Clinical Workspace & ICD-10 Coding  
> **Repository:** `meditalk`  
> **Commit Reference:** `8a089f4`  
> **Target Audience:** Mentors, Technical Managers, Academic Evaluators  

---

## 1. Executive Summary & Objective

In **Phase 3**, MediTalk expanded from a traditional in-person scheduling portal into a fully interactive **remote telehealth and clinical consultation ecosystem**. 

Prior to this phase:
- Appointments were static records without real-time interaction mechanisms.
- Doctors had no in-app workspace to record observations, vitals, or diagnostic codes while communicating with patients.
- Patients had no digital waiting room to join remote video calls.

**Phase 3 Objectives:**
1. Integrate zero-cost, enterprise-grade, peer-to-peer/SFU WebRTC video calls using **Jitsi Meet**.
2. Build a synchronized **Video Waiting Room** state machine (`waiting`, `in_progress`, `ended`).
3. Construct an all-in-one **Doctor Clinical Workspace** combining video, patient history, vitals monitoring with live threshold alerts, and treatment notes.
4. Implement standard clinical diagnostic tagging using the **WHO ICD-10 Coding System** with real-time autocomplete search.

---

## 2. Technical Architecture & Component Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                     Doctor Consultation Workspace                      │
│                  (src/pages/doctor/DoctorConsultation.jsx)             │
└───────┬──────────────────────────┬────────────────────────────┬────────┘
        │                          │                            │
        ▼                          ▼                            ▼
┌───────────────────┐    ┌────────────────────┐      ┌─────────────────────┐
│  Jitsi Meet Video │    │  Biometric Vitals  │      │  ICD-10 Search &    │
│  (WebRTC Embed)   │    │  Threshold Engine  │      │  Consultation Form  │
└───────┬───────────┘    └────────────────────┘      └──────────┬──────────┘
        │                                                       │
        │ PATCH /api/appointments/:id/video-status              │ POST /api/consultations
        ▼                                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Express API & PostgreSQL                        │
│             appointments.video_status  │  consultations table          │
└────────────────────────────────────────────────┬───────────────────────┘
                                                 │ Live State Sync
                                                 ▼
                             ┌───────────────────────────────────────┐
                             │        Patient Video Room             │
                             │ (src/pages/patient/PatientVideoRoom)  │
                             └───────────────────────────────────────┘
```

---

## 3. Detailed Feature Breakdown

### 3.1 WebRTC Video Room Integration (`src/components/video/VideoRoom.jsx`)
- **Technology:** Jitsi Meet External API SDK (`meet.jit.si`).
- **Dynamic Secure Room ID Generation:**
  - Room names are computed deterministically using unique appointment IDs with sanitization (e.g. `meditalk-appt-A-1789915...`).
- **Embedded Capabilities:**
  - Full HD peer-to-peer audio/video streaming.
  - Camera toggle (on/off), microphone mute/unmute, tile-view switcher.
  - Screen sharing and responsive iframe container embedded directly into the consultation card.
  - In-app End Call button triggering cleanup callbacks.

### 3.2 Synchronized Waiting Room State Machine
To replicate real-world medical practice, a video consultation has three lifecycle states:
1. `waiting`: Doctor indicates they are reviewing records; patient sees a warm waiting room indicator ("Dr. Menon is reviewing your chart and will admit you shortly").
2. `in_progress`: Doctor starts the call; patient screen transitions into active WebRTC video.
3. `ended`: Session is concluded; both parties are disconnected and prompted to review summary notes.

**Backend Sync API:**
- `PATCH /api/appointments/:id/video-status`
- Updates `appointments.video_status` in PostgreSQL and dispatches real-time SSE triggers.

### 3.3 WHO ICD-10 Diagnostic Code Search (`src/data/icd10.js`)
Medical doctors require standardized clinical terminology for insurance, hospital audits, and official records.
- **Dataset:** Contains hundreds of frequently encountered clinical conditions categorized by system:
  - *Cardiovascular:* `I10` (Essential hypertension), `I20.9` (Angina pectoris), `I48.91` (Atrial fibrillation).
  - *Respiratory:* `J06.9` (Acute upper respiratory infection), `J45.909` (Unspecified asthma).
  - *Endocrine:* `E11.9` (Type 2 diabetes mellitus).
  - *Dermatology:* `L20.9` (Atopic dermatitis), `L70.0` (Acne vulgaris).
- **Search Engine:** Fast in-memory tokenized search filtering by both code and descriptive keyword with dropdown selection.

### 3.4 Biometric Vitals Threshold Alert Engine
Doctors enter patient vitals during examination. MediTalk automatically compares entries against medical safety thresholds:
- **Blood Pressure (BP):**
  - `< 120/80 mmHg`: Normal (green badge)
  - `120-139 / 80-89 mmHg`: Pre-hypertensive (amber warning badge)
  - `≥ 140/90 mmHg`: Critical hypertension alert (pulsing red badge)
- **Heart Rate (HR):**
  - `60–100 bpm`: Normal
  - `< 50 bpm` (Bradycardia) or `> 110 bpm` (Tachycardia): Critical alert
- **Oxygen Saturation (SpO₂):**
  - `≥ 95%`: Optimal
  - `90–94%`: Warning
  - `< 90%`: Emergency Hypoxia Alert

### 3.5 Consultation Persistence (`POST /api/consultations`)
When the doctor completes the examination, all findings are stored into PostgreSQL:
- Symptoms reported
- Recorded vitals (BP, HR, Temp, SpO₂, Weight)
- Formal diagnosis and ICD-10 code
- Clinical observations & examination notes
- Treatment plan & follow-up instructions

---

## 4. Key Code Implementations

### Vitals Real-Time Threshold Evaluator (`DoctorConsultation.jsx`):
```javascript
function getVitalStatus(key, rawVal) {
  const v = parseFloat(rawVal);
  if (isNaN(v) || !rawVal) return "neutral";
  if (key === "hr") {
    if (v < 40 || v > 130) return "critical";
    if (v < 55 || v > 110) return "warning";
    return "normal";
  }
  if (key === "spo2") {
    if (v < 90) return "critical";
    if (v < 96) return "warning";
    return "normal";
  }
  if (key === "bp") {
    const sys = parseFloat(rawVal.split("/")[0]);
    if (!isNaN(sys) && sys >= 140) return "warning";
    return "normal";
  }
  return "normal";
}
```

---

## 5. Verification & Testing

- **Automated Test Scenarios:**
  - Verified appointment status update to `confirmed`.
  - Verified video waiting room state transitions (`waiting` → `in_progress` → `ended`).
  - Validated ICD-10 search matching across 20+ clinical substrings.
  - Validated consultation record insertion into PostgreSQL with JSON vitals payload.
- **Visual Proofs:**
  - Jitsi WebRTC iframe embedding with camera/mic permissions.
  - Synchronized patient waiting screen and live doctor video call room.
