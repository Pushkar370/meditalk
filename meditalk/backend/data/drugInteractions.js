// ─── MediTalk Clinical Drug Interaction & Allergy Safety Catalog ─────────────
// Deterministic rule engine — zero external API dependency.
// Used by POST /api/prescriptions/check-safety
// severity: 'critical' | 'warning' | 'info'

// ── Drug-Drug Interaction Pairs ───────────────────────────────────────────────
export const DRUG_INTERACTIONS = [
  // ── CRITICAL ─────────────────────────────────────────────────────────────
  {
    drug_a: ['warfarin', 'coumadin'],
    drug_b: ['ibuprofen', 'naproxen', 'diclofenac', 'aspirin', 'indomethacin', 'ketorolac', 'piroxicam'],
    severity: 'critical',
    mechanism: 'NSAIDs inhibit platelet aggregation and displace warfarin from protein binding, dramatically increasing anticoagulation effect.',
    effect: 'Severe risk of gastrointestinal hemorrhage, intracranial bleeding, or fatal blood loss.',
    alternatives: ['Paracetamol (Acetaminophen) — safe analgesic in anticoagulated patients at recommended doses'],
  },
  {
    drug_a: ['sildenafil', 'tadalafil', 'vardenafil'],
    drug_b: ['nitroglycerin', 'isosorbide mononitrate', 'isosorbide dinitrate', 'amyl nitrite', 'nitrates'],
    severity: 'critical',
    mechanism: 'Both drug classes cause vasodilation via different mechanisms; combined effect is synergistic and uncontrolled.',
    effect: 'Profound, potentially fatal hypotension, cardiovascular collapse.',
    alternatives: ['Alpha-blockers should be used with extreme caution; consult cardiology'],
  },
  {
    drug_a: ['methotrexate'],
    drug_b: ['ibuprofen', 'naproxen', 'diclofenac', 'aspirin', 'indomethacin', 'trimethoprim-sulfamethoxazole', 'co-trimoxazole'],
    severity: 'critical',
    mechanism: 'NSAIDs reduce methotrexate renal clearance; sulfonamides have additive antifolate action.',
    effect: 'Methotrexate toxicity — bone marrow suppression, mucositis, hepatotoxicity, pulmonary fibrosis.',
    alternatives: ['Paracetamol for analgesia; discuss with oncology/rheumatology before any NSAID'],
  },
  {
    drug_a: ['maois', 'phenelzine', 'tranylcypromine', 'isocarboxazid', 'selegiline'],
    drug_b: ['ssri', 'fluoxetine', 'sertraline', 'paroxetine', 'escitalopram', 'citalopram', 'fluvoxamine', 'tramadol', 'meperidine', 'pethidine', 'linezolid'],
    severity: 'critical',
    mechanism: 'Serotonergic drugs combined with MAO inhibitors prevent serotonin breakdown, causing massive serotonin accumulation.',
    effect: 'Serotonin syndrome — hyperthermia, seizures, rhabdomyolysis, death. Do NOT combine.',
    alternatives: ['Tricyclic antidepressants with extreme caution 14 days after MAOI washout period only'],
  },
  {
    drug_a: ['clopidogrel', 'ticagrelor', 'prasugrel'],
    drug_b: ['omeprazole', 'esomeprazole'],
    severity: 'warning',
    mechanism: 'Omeprazole/esomeprazole inhibit CYP2C19, reducing activation of clopidogrel to its active thiol metabolite.',
    effect: 'Significantly reduced antiplatelet efficacy — increased risk of stent thrombosis and cardiovascular events.',
    alternatives: ['Pantoprazole or rabeprazole — do not inhibit CYP2C19 significantly'],
  },
  {
    drug_a: ['digoxin'],
    drug_b: ['amiodarone', 'verapamil', 'diltiazem', 'clarithromycin', 'azithromycin', 'erythromycin'],
    severity: 'critical',
    mechanism: 'These drugs inhibit P-glycoprotein and reduce digoxin renal clearance, rapidly elevating digoxin plasma levels.',
    effect: 'Digoxin toxicity — bradycardia, heart block, ventricular arrhythmias, nausea, visual disturbances.',
    alternatives: ['Reduce digoxin dose by 50% when combining; monitor digoxin levels closely'],
  },
  {
    drug_a: ['lithium'],
    drug_b: ['ibuprofen', 'naproxen', 'diclofenac', 'indomethacin', 'lisinopril', 'enalapril', 'ramipril', 'furosemide', 'hydrochlorothiazide'],
    severity: 'critical',
    mechanism: 'NSAIDs and ACE inhibitors reduce renal lithium clearance; diuretics cause sodium depletion increasing lithium reabsorption.',
    effect: 'Lithium toxicity — tremors, ataxia, renal impairment, confusion, cardiac arrhythmias.',
    alternatives: ['Paracetamol is safe for analgesia; consult psychiatry before adding any interacting drug'],
  },

  // ── WARNING ────────────────────────────────────────────────────────────────
  {
    drug_a: ['ace inhibitors', 'lisinopril', 'enalapril', 'ramipril', 'perindopril', 'captopril'],
    drug_b: ['potassium', 'potassium chloride', 'spironolactone', 'eplerenone', 'amiloride', 'trimethoprim'],
    severity: 'warning',
    mechanism: 'ACE inhibitors increase potassium retention by reducing aldosterone; combining with potassium-sparing agents compounds this effect.',
    effect: 'Hyperkalemia — cardiac conduction abnormalities, ventricular fibrillation, sudden cardiac arrest.',
    alternatives: ['Monitor serum potassium and renal function closely if combination is clinically necessary'],
  },
  {
    drug_a: ['metformin'],
    drug_b: ['iodinated contrast', 'contrast agent', 'contrast media', 'iohexol', 'iopamidol'],
    severity: 'warning',
    mechanism: 'Contrast agents can cause acute kidney injury, reducing metformin excretion and allowing accumulation.',
    effect: 'Metformin-associated lactic acidosis (MALA) — potentially fatal metabolic emergency.',
    alternatives: ['Hold metformin 48 hours before contrast administration; resume after confirming normal renal function'],
  },
  {
    drug_a: ['ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'ofloxacin'],
    drug_b: ['antacids', 'aluminium hydroxide', 'magnesium hydroxide', 'calcium carbonate', 'iron supplements', 'zinc supplements'],
    severity: 'warning',
    mechanism: 'Divalent/trivalent cations chelate fluoroquinolones in the gastrointestinal tract, forming insoluble complexes.',
    effect: 'Significantly reduced fluoroquinolone bioavailability — up to 90% reduction — treatment failure risk.',
    alternatives: ['Space administration by ≥2 hours: take fluoroquinolone 2 hours before or 6 hours after the cation'],
  },
  {
    drug_a: ['ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'erythromycin', 'clarithromycin', 'azithromycin', 'amiodarone', 'sotalol', 'haloperidol', 'quetiapine'],
    drug_b: ['ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'erythromycin', 'clarithromycin', 'azithromycin', 'amiodarone', 'sotalol', 'haloperidol', 'quetiapine', 'ondansetron'],
    severity: 'warning',
    mechanism: 'Multiple drugs that prolong cardiac QT interval when combined produce additive QTc prolongation.',
    effect: 'Risk of Torsades de Pointes ventricular arrhythmia — potentially fatal.',
    alternatives: ['Select an alternative antibiotic or antiemetic with no QT prolongation risk'],
  },
  {
    drug_a: ['statins', 'simvastatin', 'atorvastatin', 'rosuvastatin', 'lovastatin'],
    drug_b: ['clarithromycin', 'erythromycin', 'azithromycin', 'fluconazole', 'itraconazole', 'cyclosporine', 'amiodarone', 'gemfibrozil'],
    severity: 'warning',
    mechanism: 'CYP3A4 or OATP1B1 inhibitors elevate statin plasma concentrations significantly.',
    effect: 'Severe myopathy, rhabdomyolysis, acute kidney failure.',
    alternatives: ['Temporarily suspend statin or use rosuvastatin/pravastatin (less CYP3A4-dependent) if antibiotic is essential'],
  },
  {
    drug_a: ['tramadol'],
    drug_b: ['ssri', 'fluoxetine', 'sertraline', 'paroxetine', 'escitalopram', 'citalopram', 'snri', 'venlafaxine', 'duloxetine'],
    severity: 'warning',
    mechanism: 'Tramadol has weak serotonergic activity; combined with SSRIs/SNRIs this can accumulate to toxic serotonin levels.',
    effect: 'Serotonin syndrome — agitation, hyperthermia, muscle rigidity, autonomic instability.',
    alternatives: ['Use Paracetamol or a weak opioid without serotonergic activity'],
  },
  {
    drug_a: ['insulin', 'insulin glargine', 'insulin aspart', 'insulin lispro', 'glibenclamide', 'glimepiride', 'sitagliptin', 'metformin'],
    drug_b: ['prednisolone', 'dexamethasone', 'hydrocortisone', 'methylprednisolone', 'betamethasone'],
    severity: 'warning',
    mechanism: 'Corticosteroids increase hepatic glucose production, peripheral insulin resistance, and promote gluconeogenesis.',
    effect: 'Significant hyperglycemia — loss of diabetes control, hyperglycemic crisis.',
    alternatives: ['Increase insulin dose and monitor blood glucose closely; review steroid indication'],
  },

  // ── INFO ───────────────────────────────────────────────────────────────────
  {
    drug_a: ['atenolol', 'metoprolol', 'bisoprolol', 'propranolol', 'carvedilol'],
    drug_b: ['verapamil', 'diltiazem'],
    severity: 'info',
    mechanism: 'Both beta-blockers and non-dihydropyridine calcium channel blockers slow AV node conduction independently.',
    effect: 'Additive bradycardia and AV block — risk of complete heart block at higher doses.',
    alternatives: ['Use dihydropyridine CCBs (amlodipine, nifedipine) as safer alternative if CCB is needed with beta-blocker'],
  },
  {
    drug_a: ['levothyroxine', 'thyroxine'],
    drug_b: ['calcium carbonate', 'iron supplements', 'antacids', 'cholestyramine'],
    severity: 'info',
    mechanism: 'These agents bind levothyroxine in the GI tract, forming non-absorbable complexes.',
    effect: 'Reduced levothyroxine absorption — hypothyroidism exacerbation.',
    alternatives: ['Take levothyroxine 30–60 minutes before breakfast and ≥4 hours apart from interacting agents'],
  },
];

// ── Allergy Cross-Reactivity Catalog ─────────────────────────────────────────
// Maps documented patient allergens to cross-reactive or directly contraindicated drugs
export const ALLERGY_CONTRAINDICATIONS = [
  {
    allergen_keywords: ['penicillin', 'amoxicillin', 'ampicillin', 'flucloxacillin', 'piperacillin', 'co-amoxiclav', 'augmentin'],
    contraindicated_drugs: ['amoxicillin', 'amoxicillin-clavulanate', 'augmentin', 'ampicillin', 'flucloxacillin', 'piperacillin-tazobactam', 'piperacillin'],
    cross_reactive: ['cephalexin', 'cefazolin', 'ceftriaxone', 'cefuroxime', 'cefpodoxime', 'cephalosporins'],
    severity: 'critical',
    reaction_note: 'Penicillin allergy may cause anaphylaxis to all beta-lactam antibiotics. 1–10% cross-reactivity with cephalosporins documented.',
    alternatives: ['Azithromycin', 'Clarithromycin', 'Erythromycin', 'Doxycycline', 'Clindamycin (for dental/skin)', 'Trimethoprim-Sulfamethoxazole (UTI)'],
  },
  {
    allergen_keywords: ['sulfa', 'sulfonamide', 'trimethoprim-sulfamethoxazole', 'co-trimoxazole', 'sulfamethoxazole'],
    contraindicated_drugs: ['trimethoprim-sulfamethoxazole', 'co-trimoxazole', 'sulfamethoxazole', 'sulfasalazine', 'sulfadiazine'],
    cross_reactive: ['furosemide', 'hydrochlorothiazide', 'thiazide diuretics'],
    severity: 'critical',
    reaction_note: 'Sulfonamide allergy — true allergy contraindicates all sulfonamide antibiotics. Possible cross-reactivity with thiazide diuretics (less established).',
    alternatives: ['Nitrofurantoin (UTI)', 'Ciprofloxacin', 'Cephalexin if no penicillin allergy'],
  },
  {
    allergen_keywords: ['nsaid', 'aspirin', 'ibuprofen', 'diclofenac', 'naproxen', 'indomethacin'],
    contraindicated_drugs: ['aspirin', 'ibuprofen', 'naproxen', 'diclofenac', 'indomethacin', 'ketorolac', 'mefenamic acid', 'piroxicam', 'meloxicam', 'celecoxib'],
    cross_reactive: [],
    severity: 'critical',
    reaction_note: 'NSAID/Aspirin hypersensitivity includes aspirin-exacerbated respiratory disease (AERD), urticaria, or anaphylaxis. All NSAIDs are contraindicated.',
    alternatives: ['Paracetamol (Acetaminophen) — safe in NSAID allergy for analgesia/fever', 'Opioids for severe pain under specialist supervision'],
  },
  {
    allergen_keywords: ['cephalosporin', 'cephalexin', 'ceftriaxone', 'cefuroxime', 'cefpodoxime'],
    contraindicated_drugs: ['cephalexin', 'ceftriaxone', 'cefuroxime', 'cefpodoxime', 'cefazolin', 'cefaclor', 'cefdinir'],
    cross_reactive: ['amoxicillin', 'ampicillin'],
    severity: 'critical',
    reaction_note: 'Cephalosporin allergy — all cephalosporins contraindicated. 1–2% cross-reactivity with penicillins.',
    alternatives: ['Azithromycin', 'Doxycycline', 'Clindamycin', 'Trimethoprim-Sulfamethoxazole'],
  },
  {
    allergen_keywords: ['contrast', 'iodine', 'iodinated contrast', 'shellfish iodine'],
    contraindicated_drugs: ['iohexol', 'iopamidol', 'iodinated contrast', 'contrast media'],
    cross_reactive: [],
    severity: 'warning',
    reaction_note: 'History of contrast reaction warrants premedication protocol (corticosteroids + antihistamines) before any re-administration.',
    alternatives: ['MRI without contrast or ultrasound when diagnostic alternative exists'],
  },
  {
    allergen_keywords: ['latex'],
    contraindicated_drugs: [],
    cross_reactive: ['banana', 'avocado', 'kiwi'],
    severity: 'info',
    reaction_note: 'Latex allergy — inform surgical and procedure teams. No direct drug contraindication, but cross-reactive foods noted.',
    alternatives: ['Latex-free medical supplies must be used for all procedures'],
  },
];

// ── Core Safety Check Function ────────────────────────────────────────────────
// @param {string[]} newMeds - Lowercase drug names being prescribed
// @param {string[]} currentMeds - Lowercase existing patient medications
// @param {string[]} allergies - Lowercase documented allergens
// @returns {Array} alerts
export function runDrugSafetyCheck({ newMeds = [], currentMeds = [], allergies = [] }) {
  const alerts = [];
  const allMeds = [...new Set([...newMeds, ...currentMeds])].map(m => m.toLowerCase().trim());
  const newMedsLower = newMeds.map(m => m.toLowerCase().trim());
  const allergiesLower = allergies.map(a => a.toLowerCase().trim());

  // ── 1. Drug-Drug Interaction Check ────────────────────────────────────────
  for (const rule of DRUG_INTERACTIONS) {
    const matchA = rule.drug_a.some(da => allMeds.some(m => m.includes(da)));
    const matchB = rule.drug_b.some(db => allMeds.some(m => m.includes(db)));
    // Only alert if at least one drug from new prescription is involved
    const newMedInvolved =
      rule.drug_a.some(da => newMedsLower.some(m => m.includes(da))) ||
      rule.drug_b.some(db => newMedsLower.some(m => m.includes(db)));

    if (matchA && matchB && newMedInvolved) {
      // Find the specific matching drug names for the alert message
      const involvedA = allMeds.find(m => rule.drug_a.some(da => m.includes(da))) || rule.drug_a[0];
      const involvedB = allMeds.find(m => rule.drug_b.some(db => m.includes(db))) || rule.drug_b[0];
      // Avoid duplicate alerts
      const key = [rule.drug_a[0], rule.drug_b[0]].sort().join('|');
      if (!alerts.find(a => a.key === key)) {
        alerts.push({
          type: 'drug_interaction',
          key,
          severity: rule.severity,
          drugA: involvedA,
          drugB: involvedB,
          title: `Drug Interaction: ${involvedA} + ${involvedB}`,
          mechanism: rule.mechanism,
          effect: rule.effect,
          alternatives: rule.alternatives,
        });
      }
    }
  }

  // ── 2. Allergy Contraindication Check ─────────────────────────────────────
  for (const rule of ALLERGY_CONTRAINDICATIONS) {
    const allergenMatch = rule.allergen_keywords.some(kw =>
      allergiesLower.some(a => a.includes(kw))
    );
    if (!allergenMatch) continue;

    for (const newMed of newMedsLower) {
      const isContraindicated = rule.contraindicated_drugs.some(d => newMed.includes(d) || d.includes(newMed));
      const isCrossReactive = rule.cross_reactive.some(d => newMed.includes(d) || d.includes(newMed));

      if (isContraindicated) {
        const matchedAllergen = allergiesLower.find(a =>
          rule.allergen_keywords.some(kw => a.includes(kw))
        ) || rule.allergen_keywords[0];
        alerts.push({
          type: 'allergy_contraindication',
          severity: rule.severity,
          drug: newMed,
          allergen: matchedAllergen,
          title: `Allergy Clash: ${newMed} (${matchedAllergen} allergy)`,
          mechanism: rule.reaction_note,
          effect: `Patient has documented ${matchedAllergen} allergy. This drug is directly contraindicated.`,
          alternatives: rule.alternatives,
        });
      } else if (isCrossReactive) {
        const matchedAllergen = allergiesLower.find(a =>
          rule.allergen_keywords.some(kw => a.includes(kw))
        ) || rule.allergen_keywords[0];
        alerts.push({
          type: 'allergy_cross_reactive',
          severity: 'warning',
          drug: newMed,
          allergen: matchedAllergen,
          title: `Cross-Reactivity Alert: ${newMed} (${matchedAllergen} sensitivity)`,
          mechanism: rule.reaction_note,
          effect: `Possible cross-reactivity between ${matchedAllergen} and ${newMed}. Use with caution and patient consent.`,
          alternatives: rule.alternatives,
        });
      }
    }
  }

  // Sort by severity (critical > warning > info)
  const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3));

  return alerts;
}
