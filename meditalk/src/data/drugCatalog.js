// Drug catalog — 60+ common medications with autocomplete metadata
export const DRUG_CATALOG = [
  // ── Antibiotics ─────────────────────────────────────────────────────
  { name: "Amoxicillin", category: "Antibiotic", commonDosages: ["250mg", "500mg", "875mg"], forms: ["Capsule", "Tablet", "Syrup"], routes: ["Oral"], defaultFrequency: "TDS", instructions: "Complete the full course" },
  { name: "Amoxicillin-Clavulanate (Augmentin)", category: "Antibiotic", commonDosages: ["375mg", "625mg", "1g"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "BD", instructions: "Take with food" },
  { name: "Azithromycin", category: "Antibiotic", commonDosages: ["250mg", "500mg"], forms: ["Tablet", "Syrup"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Take on empty stomach" },
  { name: "Ciprofloxacin", category: "Antibiotic", commonDosages: ["250mg", "500mg", "750mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "BD", instructions: "Avoid dairy products" },
  { name: "Doxycycline", category: "Antibiotic", commonDosages: ["50mg", "100mg"], forms: ["Capsule", "Tablet"], routes: ["Oral"], defaultFrequency: "BD", instructions: "Take with full glass of water, avoid lying down" },
  { name: "Metronidazole", category: "Antibiotic", commonDosages: ["200mg", "400mg", "500mg"], forms: ["Tablet", "Syrup"], routes: ["Oral"], defaultFrequency: "TDS", instructions: "Avoid alcohol" },
  { name: "Cephalexin", category: "Antibiotic", commonDosages: ["250mg", "500mg"], forms: ["Capsule", "Tablet"], routes: ["Oral"], defaultFrequency: "QID", instructions: "Take with or without food" },
  { name: "Clarithromycin", category: "Antibiotic", commonDosages: ["250mg", "500mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "BD", instructions: "Take with food" },
  { name: "Trimethoprim-Sulfamethoxazole", category: "Antibiotic", commonDosages: ["80/400mg", "160/800mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "BD", instructions: "Drink plenty of water" },
  { name: "Clindamycin", category: "Antibiotic", commonDosages: ["150mg", "300mg"], forms: ["Capsule"], routes: ["Oral"], defaultFrequency: "TDS", instructions: "Take with full glass of water" },

  // ── Cardiology ──────────────────────────────────────────────────────
  { name: "Amlodipine", category: "Cardiology", commonDosages: ["2.5mg", "5mg", "10mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Take at the same time each day" },
  { name: "Atenolol", category: "Cardiology", commonDosages: ["25mg", "50mg", "100mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Do not stop abruptly" },
  { name: "Metoprolol", category: "Cardiology", commonDosages: ["25mg", "50mg", "100mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "BD", instructions: "Take with food" },
  { name: "Enalapril", category: "Cardiology", commonDosages: ["2.5mg", "5mg", "10mg", "20mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Monitor blood pressure" },
  { name: "Lisinopril", category: "Cardiology", commonDosages: ["5mg", "10mg", "20mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Monitor blood pressure and renal function" },
  { name: "Ramipril", category: "Cardiology", commonDosages: ["1.25mg", "2.5mg", "5mg", "10mg"], forms: ["Capsule", "Tablet"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Take at bedtime" },
  { name: "Losartan", category: "Cardiology", commonDosages: ["25mg", "50mg", "100mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Monitor blood pressure" },
  { name: "Furosemide", category: "Cardiology", commonDosages: ["20mg", "40mg", "80mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Take in the morning" },
  { name: "Aspirin (Low Dose)", category: "Cardiology", commonDosages: ["75mg", "150mg", "325mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Take after meals" },
  { name: "Clopidogrel", category: "Cardiology", commonDosages: ["75mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Monitor for bleeding" },
  { name: "Simvastatin", category: "Cardiology", commonDosages: ["10mg", "20mg", "40mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Take at bedtime" },
  { name: "Atorvastatin", category: "Cardiology", commonDosages: ["10mg", "20mg", "40mg", "80mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Can take at any time of day" },

  // ── Pain Management ─────────────────────────────────────────────────
  { name: "Paracetamol", category: "Analgesic", commonDosages: ["325mg", "500mg", "650mg", "1g"], forms: ["Tablet", "Syrup", "Suppository"], routes: ["Oral", "Rectal"], defaultFrequency: "TDS", instructions: "Do not exceed 4g/day" },
  { name: "Ibuprofen", category: "Analgesic", commonDosages: ["200mg", "400mg", "600mg"], forms: ["Tablet", "Syrup"], routes: ["Oral"], defaultFrequency: "TDS", instructions: "Take with food, avoid in renal disease" },
  { name: "Diclofenac", category: "Analgesic", commonDosages: ["25mg", "50mg", "75mg"], forms: ["Tablet", "Injection", "Gel"], routes: ["Oral", "IM", "Topical"], defaultFrequency: "BD", instructions: "Take with food" },
  { name: "Naproxen", category: "Analgesic", commonDosages: ["250mg", "500mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "BD", instructions: "Take with food and milk" },
  { name: "Tramadol", category: "Analgesic", commonDosages: ["50mg", "100mg"], forms: ["Capsule", "Tablet"], routes: ["Oral"], defaultFrequency: "BD", instructions: "May cause drowsiness, avoid driving" },
  { name: "Codeine", category: "Analgesic", commonDosages: ["15mg", "30mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "QID", instructions: "May cause drowsiness and constipation" },

  // ── Endocrinology / Diabetes ────────────────────────────────────────
  { name: "Metformin", category: "Endocrinology", commonDosages: ["500mg", "850mg", "1000mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "BD", instructions: "Take with food to reduce GI side effects" },
  { name: "Glibenclamide", category: "Endocrinology", commonDosages: ["2.5mg", "5mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Take before meals" },
  { name: "Glimepiride", category: "Endocrinology", commonDosages: ["1mg", "2mg", "4mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Take with breakfast" },
  { name: "Sitagliptin", category: "Endocrinology", commonDosages: ["50mg", "100mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Take with or without food" },
  { name: "Insulin Glargine", category: "Endocrinology", commonDosages: ["10 units", "20 units", "30 units"], forms: ["Injection"], routes: ["Subcutaneous"], defaultFrequency: "OD", instructions: "Inject at the same time each night" },
  { name: "Levothyroxine", category: "Endocrinology", commonDosages: ["25mcg", "50mcg", "75mcg", "100mcg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Take 30 min before breakfast on empty stomach" },

  // ── Respiratory ─────────────────────────────────────────────────────
  { name: "Salbutamol", category: "Respiratory", commonDosages: ["2mg", "4mg", "100mcg/puff"], forms: ["Tablet", "Inhaler", "Syrup"], routes: ["Oral", "Inhalation"], defaultFrequency: "TDS", instructions: "Shake inhaler well before each use" },
  { name: "Prednisolone", category: "Respiratory", commonDosages: ["5mg", "10mg", "20mg", "40mg"], forms: ["Tablet", "Syrup"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Take in the morning with food" },
  { name: "Montelukast", category: "Respiratory", commonDosages: ["4mg", "5mg", "10mg"], forms: ["Tablet", "Chewable"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Take in the evening" },
  { name: "Fluticasone", category: "Respiratory", commonDosages: ["50mcg", "100mcg", "250mcg"], forms: ["Inhaler"], routes: ["Inhalation"], defaultFrequency: "BD", instructions: "Rinse mouth after use" },
  { name: "Budesonide", category: "Respiratory", commonDosages: ["100mcg", "200mcg", "400mcg"], forms: ["Inhaler", "Nebulizer"], routes: ["Inhalation"], defaultFrequency: "BD", instructions: "Rinse mouth after use" },
  { name: "Cetirizine", category: "Respiratory", commonDosages: ["5mg", "10mg"], forms: ["Tablet", "Syrup"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Take at bedtime if drowsiness occurs" },
  { name: "Loratadine", category: "Respiratory", commonDosages: ["10mg"], forms: ["Tablet", "Syrup"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Take on empty stomach" },

  // ── Gastroenterology ────────────────────────────────────────────────
  { name: "Omeprazole", category: "Gastroenterology", commonDosages: ["10mg", "20mg", "40mg"], forms: ["Capsule", "Tablet"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Take 30 min before meals" },
  { name: "Pantoprazole", category: "Gastroenterology", commonDosages: ["20mg", "40mg"], forms: ["Tablet", "Injection"], routes: ["Oral", "IV"], defaultFrequency: "OD", instructions: "Take before breakfast" },
  { name: "Ranitidine", category: "Gastroenterology", commonDosages: ["75mg", "150mg", "300mg"], forms: ["Tablet", "Syrup"], routes: ["Oral"], defaultFrequency: "BD", instructions: "Take with or without food" },
  { name: "Domperidone", category: "Gastroenterology", commonDosages: ["10mg"], forms: ["Tablet", "Syrup"], routes: ["Oral"], defaultFrequency: "TDS", instructions: "Take 15-30 min before meals" },
  { name: "Ondansetron", category: "Gastroenterology", commonDosages: ["4mg", "8mg"], forms: ["Tablet", "Injection"], routes: ["Oral", "IV"], defaultFrequency: "TDS", instructions: "Take 30 min before trigger" },
  { name: "Bisacodyl", category: "Gastroenterology", commonDosages: ["5mg", "10mg"], forms: ["Tablet", "Suppository"], routes: ["Oral", "Rectal"], defaultFrequency: "OD", instructions: "Take at bedtime, do not crush tablet" },

  // ── Psychiatry / Neurology ───────────────────────────────────────────
  { name: "Sertraline", category: "Psychiatry", commonDosages: ["25mg", "50mg", "100mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "OD", instructions: "May take 4-6 weeks for full effect" },
  { name: "Fluoxetine", category: "Psychiatry", commonDosages: ["10mg", "20mg", "40mg"], forms: ["Capsule", "Tablet"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Take in the morning" },
  { name: "Diazepam", category: "Psychiatry", commonDosages: ["2mg", "5mg", "10mg"], forms: ["Tablet", "Injection"], routes: ["Oral", "IV", "IM"], defaultFrequency: "TDS", instructions: "Avoid alcohol, do not drive" },
  { name: "Alprazolam", category: "Psychiatry", commonDosages: ["0.25mg", "0.5mg", "1mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "TDS", instructions: "Avoid abrupt discontinuation" },
  { name: "Amitriptyline", category: "Psychiatry", commonDosages: ["10mg", "25mg", "50mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Take at bedtime" },

  // ── Vitamins / Supplements ───────────────────────────────────────────
  { name: "Vitamin D3", category: "Supplement", commonDosages: ["1000IU", "2000IU", "5000IU"], forms: ["Tablet", "Capsule", "Drops"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Take with fatty meal" },
  { name: "Calcium + Vitamin D", category: "Supplement", commonDosages: ["500mg/200IU", "1000mg/400IU"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "BD", instructions: "Take with meals" },
  { name: "Iron (Ferrous Sulphate)", category: "Supplement", commonDosages: ["200mg", "325mg"], forms: ["Tablet", "Syrup"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Take 1 hour before meals, stools may turn dark" },
  { name: "Folic Acid", category: "Supplement", commonDosages: ["0.4mg", "1mg", "5mg"], forms: ["Tablet"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Take with or without food" },
  { name: "Vitamin B12", category: "Supplement", commonDosages: ["500mcg", "1000mcg"], forms: ["Tablet", "Injection"], routes: ["Oral", "IM"], defaultFrequency: "OD", instructions: "Take with or without food" },
  { name: "Omega-3 Fatty Acids", category: "Supplement", commonDosages: ["1g"], forms: ["Capsule"], routes: ["Oral"], defaultFrequency: "OD", instructions: "Take with meals" },
];

/** Search drug catalog by name prefix/substring, case-insensitive */
export function searchDrugs(query) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return DRUG_CATALOG.filter(d => d.name.toLowerCase().includes(q)).slice(0, 8);
}
