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

// ── Brand Names, Aliases & Synonyms Dictionary ──────────────────────────────
export const BRAND_TO_GENERIC_MAP = {
  // NSAIDs & Analgesics
  'advil': 'ibuprofen',
  'motrin': 'ibuprofen',
  'nurofen': 'ibuprofen',
  'brufen': 'ibuprofen',
  'combiflam': 'ibuprofen',
  'ibuprom': 'ibuprofen',
  'aleve': 'naproxen',
  'naprosyn': 'naproxen',
  'anaprox': 'naproxen',
  'voltaren': 'diclofenac',
  'cataflam': 'diclofenac',
  'voveran': 'diclofenac',
  'dynapar': 'diclofenac',
  'voltarol': 'diclofenac',
  'zipsor': 'diclofenac',
  'disprin': 'aspirin',
  'ecosprin': 'aspirin',
  'bayer': 'aspirin',
  'bufferin': 'aspirin',
  'asa': 'aspirin',
  'acetylsalicylic acid': 'aspirin',
  'toradol': 'ketorolac',
  'ketorol': 'ketorolac',
  'indocin': 'indomethacin',
  'feldene': 'piroxicam',
  'mobic': 'meloxicam',
  'celebrex': 'celecoxib',

  // Anticoagulants & Antiplatelets
  'coumadin': 'warfarin',
  'jantoven': 'warfarin',
  'marevan': 'warfarin',
  'plavix': 'clopidogrel',
  'clopilet': 'clopidogrel',
  'deplatt': 'clopidogrel',
  'brilinta': 'ticagrelor',
  'effient': 'prasugrel',

  // ED & Pulmonary Vasodilators / Nitrates
  'viagra': 'sildenafil',
  'revatio': 'sildenafil',
  'silagra': 'sildenafil',
  'penegra': 'sildenafil',
  'cialis': 'tadalafil',
  'adcirca': 'tadalafil',
  'tadacip': 'tadalafil',
  'levitra': 'vardenafil',
  'staxyn': 'vardenafil',
  'nitrostat': 'nitroglycerin',
  'nitrolingual': 'nitroglycerin',
  'nitro-bid': 'nitroglycerin',
  'nitro-dur': 'nitroglycerin',
  'sorbitrate': 'isosorbide dinitrate',
  'isordil': 'isosorbide dinitrate',
  'imdur': 'isosorbide mononitrate',
  'monoket': 'isosorbide mononitrate',

  // Antibiotics — Beta-Lactams & Cephalosporins
  'augmentin': 'amoxicillin',
  'amoxil': 'amoxicillin',
  'moxikind': 'amoxicillin',
  'clavam': 'amoxicillin',
  'novamox': 'amoxicillin',
  'omnipen': 'ampicillin',
  'unasyn': 'ampicillin',
  'zosyn': 'piperacillin',
  'tazocin': 'piperacillin',
  'pen-vk': 'penicillin',
  'bicillin': 'penicillin',
  'keflex': 'cephalexin',
  'phexin': 'cephalexin',
  'sporidex': 'cephalexin',
  'rocephin': 'ceftriaxone',
  'monocef': 'ceftriaxone',
  'ceftum': 'cefuroxime',
  'zinacef': 'cefuroxime',
  'ceftin': 'cefuroxime',
  'ancef': 'cefazolin',
  'kefzol': 'cefazolin',
  'omnicef': 'cefdinir',
  'vantin': 'cefpodoxime',
  'cepodem': 'cefpodoxime',

  // Antibiotics — Macrolides, Fluoroquinolones, Sulfas
  'zithromax': 'azithromycin',
  'z-pak': 'azithromycin',
  'azithral': 'azithromycin',
  'azee': 'azithromycin',
  'biaxin': 'clarithromycin',
  'claribid': 'clarithromycin',
  'erythrocin': 'erythromycin',
  'althrocin': 'erythromycin',
  'cipro': 'ciprofloxacin',
  'ciplox': 'ciprofloxacin',
  'ciprolet': 'ciprofloxacin',
  'levaquin': 'levofloxacin',
  'levomac': 'levofloxacin',
  'avelox': 'moxifloxacin',
  'moxicip': 'moxifloxacin',
  'bactrim': 'trimethoprim-sulfamethoxazole',
  'septra': 'trimethoprim-sulfamethoxazole',
  'septran': 'trimethoprim-sulfamethoxazole',

  // Antidiabetic
  'glucophage': 'metformin',
  'fortamet': 'metformin',
  'glumetza': 'metformin',
  'glycomet': 'metformin',

  // Acid suppression (PPIs)
  'prilosec': 'omeprazole',
  'omez': 'omeprazole',
  'losec': 'omeprazole',
  'nexium': 'esomeprazole',
  'esomac': 'esomeprazole',
  'protonix': 'pantoprazole',
  'pantocid': 'pantoprazole',
  'pantodac': 'pantoprazole',

  // Statins
  'lipitor': 'atorvastatin',
  'atorva': 'atorvastatin',
  'atorglip': 'atorvastatin',
  'crestor': 'rosuvastatin',
  'rosuvas': 'rosuvastatin',
  'zocor': 'simvastatin',
  'simvotin': 'simvastatin',

  // Cardiovascular
  'lanoxin': 'digoxin',
  'digitek': 'digoxin',
  'cordarone': 'amiodarone',
  'pacerone': 'amiodarone',
  'norvasc': 'amlodipine',
  'calan': 'verapamil',
  'isoptin': 'verapamil',
  'cardizem': 'diltiazem',
  'tenormin': 'atenolol',
  'lopressor': 'metoprolol',
  'toprol': 'metoprolol',
  'betaloc': 'metoprolol',
  'coreg': 'carvedilol',
  'inderal': 'propranolol',

  // Analgesics & Antipyretics
  'tylenol': 'paracetamol',
  'panadol': 'paracetamol',
  'calpol': 'paracetamol',
  'dolo': 'paracetamol',
  'crocin': 'paracetamol',
  'febrinil': 'paracetamol',
  'acetaminophen': 'paracetamol',
  'ultram': 'tramadol',
  'ultracet': 'tramadol',
  'tramazac': 'tramadol',

  // Psych & Neuro
  'prozac': 'fluoxetine',
  'zoloft': 'sertraline',
  'daxid': 'sertraline',
  'lexapro': 'escitalopram',
  'cipralex': 'escitalopram',
  'nexito': 'escitalopram',
  'celexa': 'citalopram',
  'paxil': 'paroxetine',
  'eskalith': 'lithium',
  'lithobid': 'lithium',
  'trexall': 'methotrexate',
  'rheumatrex': 'methotrexate',
};

// ── Common Spelling Variations & Typos ───────────────────────────────────────
export const SPELLING_VARIATIONS_MAP = {
  // Commonwealth & phonetic variations
  'amoxycillin': 'amoxicillin',
  'amoxicilin': 'amoxicillin',
  'amoxacillin': 'amoxicillin',
  'amoxicilline': 'amoxicillin',
  'penicilin': 'penicillin',
  'pencillin': 'penicillin',
  'penicilline': 'penicillin',
  'ibprofen': 'ibuprofen',
  'ibuprophen': 'ibuprofen',
  'ibrufen': 'ibuprofen',
  'ibupofen': 'ibuprofen',
  'asprin': 'aspirin',
  'aspiren': 'aspirin',
  'paracetemol': 'paracetamol',
  'paracetomol': 'paracetamol',
  'paracitamol': 'paracetamol',
  'acetominophen': 'paracetamol',
  'acetaminofen': 'paracetamol',
  'warfrin': 'warfarin',
  'warfarine': 'warfarin',
  'ciprofloxicin': 'ciprofloxacin',
  'ciproflaxin': 'ciprofloxacin',
  'ciprofloxacine': 'ciprofloxacin',
  'azithromicin': 'azithromycin',
  'azitromycin': 'azithromycin',
  'clarithromicin': 'clarithromycin',
  'erythromicin': 'erythromycin',
  'metaformin': 'metformin',
  'metfomin': 'metformin',
  'clopidogril': 'clopidogrel',
  'clopidigrel': 'clopidogrel',
  'declofenac': 'diclofenac',
  'diclofenic': 'diclofenac',
  'omeprazol': 'omeprazole',
  'pantoprazol': 'pantoprazole',
  'atorvastin': 'atorvastatin',
  'sildenifil': 'sildenafil',
  'nitroglycerine': 'nitroglycerin',
  'nitroglicerin': 'nitroglycerin',
  'levothyroxin': 'levothyroxine',
  'thyroxine': 'levothyroxine',
  'cefalexin': 'cephalexin',
  'ceftriaxone': 'ceftriaxone',
};

// Known canonical drug names list for fuzzy edit-distance fallback
const ALL_CANONICAL_DRUGS = [
  'warfarin', 'ibuprofen', 'naproxen', 'diclofenac', 'aspirin', 'indomethacin',
  'ketorolac', 'piroxicam', 'sildenafil', 'tadalafil', 'vardenafil', 'nitroglycerin',
  'methotrexate', 'fluoxetine', 'sertraline', 'paroxetine', 'escitalopram', 'citalopram',
  'tramadol', 'clopidogrel', 'omeprazole', 'esomeprazole', 'pantoprazole', 'digoxin',
  'amiodarone', 'verapamil', 'diltiazem', 'clarithromycin', 'azithromycin', 'erythromycin',
  'lithium', 'lisinopril', 'enalapril', 'ramipril', 'metformin', 'ciprofloxacin',
  'levofloxacin', 'moxifloxacin', 'atorvastatin', 'rosuvastatin', 'simvastatin',
  'paracetamol', 'amoxicillin', 'ampicillin', 'penicillin', 'cephalexin', 'ceftriaxone',
  'cefuroxime', 'cefazolin', 'furosemide', 'spironolactone', 'atenolol', 'metoprolol'
];

function levenshteinDistance(s1, s2) {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;
  const row = [];
  for (let j = 0; j <= s2.length; j++) row[j] = j;
  for (let i = 1; i <= s1.length; i++) {
    let prev = i;
    for (let j = 1; j <= s2.length; j++) {
      let val;
      if (s1[i - 1] === s2[j - 1]) val = row[j - 1];
      else val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      row[j - 1] = prev;
      prev = val;
    }
    row[s2.length] = prev;
  }
  return row[s2.length];
}

/**
 * Normalizes a drug or allergen name to its canonical identifier and aliases
 * Handles dosage removal, brand lookup, spelling variations, and fuzzy typo correction
 */
export function normalizeDrugName(rawName) {
  if (!rawName || typeof rawName !== 'string') return '';
  let cleaned = rawName.toLowerCase().trim();

  // Strip dosages, formulations and packaging: "500mg", "10 ml", "tab", "capsule", "duo", "sr", etc.
  cleaned = cleaned
    .replace(/\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|tablets?|caps?|tabs?|capsules?|syrup|inj|drops?|duo|ds|sr|cr|xl|xr)\b/gi, ' ')
    .replace(/[,\/\\\(\)\-\+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Try direct match on full phrase
  if (BRAND_TO_GENERIC_MAP[cleaned]) return BRAND_TO_GENERIC_MAP[cleaned];
  if (SPELLING_VARIATIONS_MAP[cleaned]) return SPELLING_VARIATIONS_MAP[cleaned];

  // Try first primary token (e.g., "augmentin 625" -> "augmentin")
  const tokens = cleaned.split(' ').filter(Boolean);
  for (const token of tokens) {
    if (BRAND_TO_GENERIC_MAP[token]) return BRAND_TO_GENERIC_MAP[token];
    if (SPELLING_VARIATIONS_MAP[token]) return SPELLING_VARIATIONS_MAP[token];
  }

  // Fuzzy match against canonical drugs if length >= 5
  const primaryToken = tokens[0] || cleaned;
  if (primaryToken.length >= 5) {
    const maxDist = primaryToken.length >= 7 ? 2 : 1;
    let closestMatch = null;
    let minDistance = maxDist + 1;
    for (const canon of ALL_CANONICAL_DRUGS) {
      const dist = levenshteinDistance(primaryToken, canon);
      if (dist <= maxDist && dist < minDistance) {
        minDistance = dist;
        closestMatch = canon;
      }
    }
    if (closestMatch) return closestMatch;
  }

  return primaryToken;
}

/**
 * Resolves a drug string to a set of search keywords (raw, normalized, brand, and class)
 */
function resolveDrugKeywords(drugName) {
  const raw = (drugName || '').toLowerCase().trim();
  const normalized = normalizeDrugName(raw);
  const keywords = new Set([raw, normalized]);

  // If normalized to a generic, add drug classes if applicable
  if (['amoxicillin', 'ampicillin', 'piperacillin'].includes(normalized)) {
    keywords.add('penicillin');
    keywords.add('beta-lactam');
  }
  if (['ibuprofen', 'naproxen', 'diclofenac', 'indomethacin', 'ketorolac', 'piroxicam', 'meloxicam', 'celecoxib'].includes(normalized)) {
    keywords.add('nsaid');
    keywords.add('nsaids');
  }
  if (['cephalexin', 'ceftriaxone', 'cefuroxime', 'cefazolin', 'cefdinir', 'cefpodoxime'].includes(normalized)) {
    keywords.add('cephalosporin');
    keywords.add('cephalosporins');
  }
  if (['nitroglycerin', 'isosorbide mononitrate', 'isosorbide dinitrate'].includes(normalized)) {
    keywords.add('nitrates');
    keywords.add('nitrate');
  }
  if (['fluoxetine', 'sertraline', 'paroxetine', 'escitalopram', 'citalopram'].includes(normalized)) {
    keywords.add('ssri');
  }

  return Array.from(keywords).filter(Boolean);
}

// ── Core Safety Check Function ────────────────────────────────────────────────
// @param {string[]} newMeds - Drug names being prescribed (supports brands & spelling variations)
// @param {string[]} currentMeds - Existing patient medications
// @param {string[]} allergies - Documented allergens
// @returns {Array} alerts
export function runDrugSafetyCheck({ newMeds = [], currentMeds = [], allergies = [] }) {
  const alerts = [];

  // Build resolved keywords map for each new medication
  const newMedsResolved = newMeds.map(m => {
    const raw = (typeof m === 'string' ? m : m?.medicine || '').trim();
    return {
      raw,
      normalized: normalizeDrugName(raw),
      keywords: resolveDrugKeywords(raw),
    };
  }).filter(item => item.raw.length > 0);

  // Build resolved keywords list for all current medications
  const currentMedsKeywords = currentMeds.flatMap(m => {
    const raw = (typeof m === 'string' ? m : m?.medicine || m?.name || '').trim();
    return resolveDrugKeywords(raw);
  }).filter(Boolean);

  // Build resolved keywords list for all documented allergies
  const allergiesKeywords = allergies.flatMap(a => {
    const raw = (typeof a === 'string' ? a : a?.allergen || a?.name || '').trim();
    return resolveDrugKeywords(raw);
  }).filter(Boolean);

  // Combined pool of all medications in play
  const allMedsKeywords = [
    ...newMedsResolved.flatMap(item => item.keywords),
    ...currentMedsKeywords,
  ];

  // Helper matching function
  const listMatchesAny = (searchList, targetKeywords) => {
    return targetKeywords.some(tk =>
      searchList.some(sl => sl.includes(tk) || tk.includes(sl))
    );
  };

  // ── 1. Drug-Drug Interaction Check ────────────────────────────────────────
  for (const rule of DRUG_INTERACTIONS) {
    const matchA = rule.drug_a.some(da => allMedsKeywords.some(m => m.includes(da) || da.includes(m)));
    const matchB = rule.drug_b.some(db => allMedsKeywords.some(m => m.includes(db) || db.includes(m)));

    if (matchA && matchB) {
      // Find if any newly prescribed medication is part of either side
      const involvedNewMed = newMedsResolved.find(nm =>
        rule.drug_a.some(da => nm.keywords.some(k => k.includes(da) || da.includes(k))) ||
        rule.drug_b.some(db => nm.keywords.some(k => k.includes(db) || db.includes(k)))
      );

      if (involvedNewMed) {
        // Identify the interacting counterpart from all medications
        const involvedA = allMedsKeywords.find(m => rule.drug_a.some(da => m.includes(da) || da.includes(m))) || rule.drug_a[0];
        const involvedB = allMedsKeywords.find(m => rule.drug_b.some(db => m.includes(db) || db.includes(m))) || rule.drug_b[0];

        const key = [rule.drug_a[0], rule.drug_b[0]].sort().join('|');
        if (!alerts.find(a => a.key === key)) {
          alerts.push({
            type: 'drug_interaction',
            key,
            severity: rule.severity,
            prescribedDrug: involvedNewMed.raw,
            drugA: involvedA,
            drugB: involvedB,
            title: `Drug Interaction: ${involvedNewMed.raw} (${involvedA}) + ${involvedB}`,
            mechanism: rule.mechanism,
            effect: rule.effect,
            alternatives: rule.alternatives,
          });
        }
      }
    }
  }

  // ── 2. Allergy Contraindication Check ─────────────────────────────────────
  for (const rule of ALLERGY_CONTRAINDICATIONS) {
    const allergenMatch = rule.allergen_keywords.some(kw =>
      allergiesKeywords.some(ak => ak.includes(kw) || kw.includes(ak))
    );
    if (!allergenMatch) continue;

    for (const newMed of newMedsResolved) {
      const isContraindicated = rule.contraindicated_drugs.some(d =>
        newMed.keywords.some(k => k.includes(d) || d.includes(k))
      );
      const isCrossReactive = !isContraindicated && rule.cross_reactive.some(d =>
        newMed.keywords.some(k => k.includes(d) || d.includes(k))
      );

      const matchedAllergen = allergiesKeywords.find(ak =>
        rule.allergen_keywords.some(kw => ak.includes(kw) || kw.includes(ak))
      ) || rule.allergen_keywords[0];

      if (isContraindicated) {
        alerts.push({
          type: 'allergy_contraindication',
          severity: rule.severity,
          drug: newMed.raw,
          normalizedDrug: newMed.normalized,
          allergen: matchedAllergen,
          title: `Allergy Clash: ${newMed.raw} (${matchedAllergen} allergy)`,
          mechanism: rule.reaction_note,
          effect: `Patient has documented ${matchedAllergen} allergy. ${newMed.raw} (${newMed.normalized}) is directly contraindicated.`,
          alternatives: rule.alternatives,
        });
      } else if (isCrossReactive) {
        alerts.push({
          type: 'allergy_cross_reactive',
          severity: 'warning',
          drug: newMed.raw,
          normalizedDrug: newMed.normalized,
          allergen: matchedAllergen,
          title: `Cross-Reactivity Alert: ${newMed.raw} (${matchedAllergen} sensitivity)`,
          mechanism: rule.reaction_note,
          effect: `Possible cross-reactivity between ${matchedAllergen} and ${newMed.raw}. Use with caution and clinical justification.`,
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

