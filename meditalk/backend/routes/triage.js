import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Triage endpoint requires authentication
router.use(requireAuth);

// ── Built-in Clinical Matrix Rules Engine (Deterministic Fallback) ─────────────
function runRuleBasedTriage({ symptoms = '', duration = '', severity = 5, accompanyingSymptoms = [], age, gender }) {
  const text = `${symptoms} ${accompanyingSymptoms.join(' ')}`.toLowerCase();

  // 1. Critical Red Flags Check (Immediate Emergency)
  const redFlagKeywords = [
    'crushing chest pain', 'chest pain', 'radiating to arm', 'radiating to jaw',
    'difficulty breathing', 'shortness of breath', 'cannot breathe', 'severe dyspnea',
    'sudden numbness', 'facial droop', 'slurred speech', 'stroke',
    'vomiting blood', 'coughing blood', 'severe anaphylaxis', 'throat swelling',
    'loss of consciousness', 'fainting', 'worst headache of life', 'thunderclap headache'
  ];

  const matchedRedFlags = redFlagKeywords.filter(kw => text.includes(kw));
  const isEmergency = matchedRedFlags.length > 0 && severity >= 7;

  // 2. Specialty Mapping Engine
  let recommendedSpecialty = 'General Medicine';
  let specialtyReason = 'A general physician can conduct an initial diagnostic evaluation and recommend targeted treatment or specialized care.';

  if (text.includes('chest') || text.includes('heart') || text.includes('palpitation') || text.includes('high blood pressure') || text.includes('bp') || text.includes('cardio')) {
    recommendedSpecialty = 'Cardiology';
    specialtyReason = 'Cardiovascular symptoms warrant clinical assessment by a heart specialist.';
  } else if (text.includes('skin') || text.includes('rash') || text.includes('itch') || text.includes('eczema') || text.includes('acne') || text.includes('mole') || text.includes('hives') || text.includes('dermat')) {
    recommendedSpecialty = 'Dermatology';
    specialtyReason = 'Dermatological symptoms benefit from visual examination and diagnostic dermatoscopy.';
  } else if (text.includes('child') || text.includes('baby') || text.includes('infant') || text.includes('toddler') || (age && age < 18)) {
    recommendedSpecialty = 'Pediatrics';
    specialtyReason = 'Pediatric specialists are best equipped to manage pediatric physical and developmental health.';
  } else if (text.includes('bone') || text.includes('joint') || text.includes('knee') || text.includes('fracture') || text.includes('back pain') || text.includes('spine') || text.includes('sprain') || text.includes('ortho')) {
    recommendedSpecialty = 'Orthopedics';
    specialtyReason = 'Musculoskeletal pain and joint restrictions are best evaluated by an orthopedic specialist.';
  } else if (text.includes('headache') || text.includes('migraine') || text.includes('dizziness') || text.includes('vertigo') || text.includes('seizure') || text.includes('numbness') || text.includes('tingling')) {
    recommendedSpecialty = 'Neurology';
    specialtyReason = 'Neurological symptoms including persistent headaches and nerve sensations require neurological evaluation.';
  }

  // 3. Urgency Scoring
  let urgency = 'routine';
  let urgencyLabel = 'Routine Consultation';
  let urgencyReason = 'Your symptoms appear stable. A scheduled appointment within a few days is appropriate.';

  if (isEmergency) {
    urgency = 'emergency';
    urgencyLabel = 'Emergency Care Required 🚨';
    urgencyReason = 'Reported symptoms contain critical red-flag indicators. Please seek immediate emergency medical care or visit the nearest ER.';
  } else if (severity >= 7 || matchedRedFlags.length > 0 || duration.includes('month') || text.includes('fever') && severity >= 6) {
    urgency = 'urgent';
    urgencyLabel = 'Urgent Clinical Attention ⚠️';
    urgencyReason = 'Elevated severity or acute symptoms warrant a consultation within 24–48 hours.';
  } else if (severity <= 3 && (duration.includes('day') || duration.includes('hours'))) {
    urgency = 'self_care';
    urgencyLabel = 'Mild / Self-Care Monitoring ℹ️';
    urgencyReason = 'Mild symptoms that may be monitored at home. If symptoms worsen or persist, book an appointment.';
  }

  // 4. Questions & Home Care Tips
  const suggestedQuestions = [
    `What tests or diagnostics do you recommend for these symptoms?`,
    `Are there specific triggers or activities I should avoid?`,
    `What warning signs should prompt me to seek urgent care?`,
    `Could my current medications or lifestyle be contributing?`,
  ];

  const homeCareTips = [
    'Stay well hydrated with clean water and electrolyte fluids.',
    'Keep a daily symptom and temperature/blood pressure log.',
    'Ensure adequate rest and avoid strenuous physical exertion.',
    'Seek immediate medical care if you experience sudden worsening or red-flag signs.',
  ];

  return {
    urgency,
    urgencyLabel,
    urgencyReason,
    recommendedSpecialty,
    recommendedSpecialtyReason: specialtyReason,
    possibleConditions: [
      `Symptom cluster associated with ${recommendedSpecialty.toLowerCase()} pathology`,
      'Non-specific inflammatory or functional response',
      'Clinical evaluation required to exclude secondary causes'
    ],
    suggestedQuestions,
    homeCareTips,
    redFlags: matchedRedFlags.length > 0 ? matchedRedFlags : ['Sudden severe worsening', 'High fever (>102°F / 38.9°C)', 'Difficulty breathing or swallowing', 'Severe dizziness or fainting'],
    clinicalSummary: `Patient presents with ${symptoms} of duration ${duration || 'unspecified'} with self-rated severity ${severity}/10. Priority level: ${urgency.toUpperCase()}. Primary triage destination: ${recommendedSpecialty}.`,
    source: 'clinical_matrix',
    clinicalDisclaimer: 'MediTalk AI Triage is an algorithmic clinical decision-support tool. It does not provide medical diagnoses or replace emergency medical services.',
  };
}

// ── Gemini LLM Triage Function ────────────────────────────────────────────────
async function callGeminiTriage({ symptoms, duration, severity, accompanyingSymptoms = [], age, gender }) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;

  const prompt = `You are MediTalk Clinical Triage Assistant, an advanced medical decision-support AI.
Analyze the following patient-reported symptoms and return an objective clinical triage assessment:

Patient Details:
- Chief Complaint / Symptoms: "${symptoms}"
- Duration: "${duration || 'Not specified'}"
- Severity Score: ${severity}/10
- Accompanying Symptoms: ${accompanyingSymptoms.join(', ') || 'None specified'}
- Age: ${age || 'Adult'}
- Gender: ${gender || 'Not specified'}

Available Medical Specialties in MediTalk:
["Cardiology", "Dermatology", "Pediatrics", "General Medicine", "Neurology", "Orthopedics"]

Respond ONLY with valid JSON matching this schema:
{
  "urgency": "emergency" | "urgent" | "routine" | "self_care",
  "urgencyLabel": "Brief user-friendly title (e.g. Emergency Care Required 🚨)",
  "urgencyReason": "Concise clinical rationale for this urgency tier",
  "recommendedSpecialty": "One of the available specialties listed above",
  "recommendedSpecialtyReason": "Why this specialty is best suited",
  "possibleConditions": ["Condition 1", "Condition 2", "Condition 3"],
  "suggestedQuestions": ["Question 1", "Question 2", "Question 3"],
  "homeCareTips": ["Tip 1", "Tip 2", "Tip 3"],
  "redFlags": ["Warning sign 1", "Warning sign 2"],
  "clinicalSummary": "2-sentence objective medical brief for the consulting doctor"
}`;

  const modelsToTry = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        console.warn(`[Gemini API - ${model}] HTTP ${response.status}: ${await response.text()}`);
        continue;
      }

      const data = await response.json();
      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateText) continue;

      const parsed = JSON.parse(candidateText);
      return {
        ...parsed,
        source: 'gemini_ai',
        clinicalDisclaimer: 'MediTalk AI Triage is an algorithmic clinical decision-support tool. It does not provide medical diagnoses or replace emergency medical services.',
      };
    } catch (err) {
      console.warn(`[Gemini API - ${model}] Error:`, err.message);
    }
  }

  return null;
}

// POST /api/triage/assess — process symptom triage assessment
router.post('/assess', async (req, res) => {
  const { symptoms, duration, severity = 5, accompanyingSymptoms = [], age, gender } = req.body;

  if (!symptoms || !symptoms.trim()) {
    return res.status(400).json({ error: 'Symptoms description is required.' });
  }

  const payload = {
    symptoms: symptoms.trim(),
    duration: duration ? duration.trim() : '',
    severity: Math.min(10, Math.max(1, parseInt(severity, 10) || 5)),
    accompanyingSymptoms: Array.isArray(accompanyingSymptoms) ? accompanyingSymptoms : [],
    age: age ? parseInt(age, 10) : null,
    gender,
  };

  try {
    // 1. Try Gemini LLM triage first if configured
    let result = await callGeminiTriage(payload);

    // 2. Fall back to deterministic clinical matrix if Gemini is unavailable
    if (!result) {
      result = runRuleBasedTriage(payload);
    }

    res.json(result);
  } catch (err) {
    console.error('[Triage Error]', err);
    // Absolute safety net: always return a safe rule-based assessment
    res.json(runRuleBasedTriage(payload));
  }
});

export default router;
