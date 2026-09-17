// Curated ICD-10 codes for common diagnoses used in primary care
// Format: { code, description }
export const ICD10_CODES = [
  // Infections
  { code: "J06.9", description: "Acute upper respiratory infection, unspecified" },
  { code: "J00", description: "Acute nasopharyngitis (Common cold)" },
  { code: "J02.9", description: "Acute pharyngitis, unspecified (Sore throat)" },
  { code: "J03.90", description: "Acute tonsillitis, unspecified" },
  { code: "J18.9", description: "Pneumonia, unspecified organism" },
  { code: "J20.9", description: "Acute bronchitis, unspecified" },
  { code: "J45.909", description: "Unspecified asthma, uncomplicated" },
  { code: "A09", description: "Infectious gastroenteritis and colitis" },
  { code: "B34.9", description: "Viral infection, unspecified" },
  { code: "L01.00", description: "Impetigo, unspecified" },
  // Cardiovascular
  { code: "I10", description: "Essential (primary) hypertension" },
  { code: "I25.10", description: "Atherosclerotic heart disease of native coronary artery" },
  { code: "I48.91", description: "Unspecified atrial fibrillation" },
  { code: "I50.9", description: "Heart failure, unspecified" },
  { code: "I21.9", description: "Acute myocardial infarction, unspecified" },
  { code: "I63.9", description: "Cerebral infarction, unspecified (Stroke)" },
  { code: "I73.9", description: "Peripheral vascular disease, unspecified" },
  // Endocrine / Metabolic
  { code: "E11.9", description: "Type 2 diabetes mellitus without complications" },
  { code: "E10.9", description: "Type 1 diabetes mellitus without complications" },
  { code: "E78.5", description: "Hyperlipidemia, unspecified" },
  { code: "E03.9", description: "Hypothyroidism, unspecified" },
  { code: "E05.90", description: "Thyrotoxicosis, unspecified" },
  { code: "E66.9", description: "Obesity, unspecified" },
  // Musculoskeletal
  { code: "M54.5", description: "Low back pain" },
  { code: "M54.2", description: "Cervicalgia (Neck pain)" },
  { code: "M79.3", description: "Panniculitis, unspecified" },
  { code: "M06.9", description: "Rheumatoid arthritis, unspecified" },
  { code: "M16.9", description: "Osteoarthritis of hip, unspecified" },
  { code: "M17.9", description: "Osteoarthritis of knee, unspecified" },
  { code: "M75.1", description: "Rotator cuff syndrome" },
  // Gastrointestinal
  { code: "K21.0", description: "Gastro-oesophageal reflux disease with oesophagitis (GERD)" },
  { code: "K29.70", description: "Gastritis, unspecified" },
  { code: "K57.30", description: "Diverticulosis of large intestine" },
  { code: "K80.20", description: "Calculus of gallbladder without cholecystitis" },
  { code: "K92.1", description: "Melaena" },
  // Neurological
  { code: "G43.909", description: "Migraine, unspecified, not intractable" },
  { code: "G40.909", description: "Epilepsy, unspecified, not intractable" },
  { code: "G35", description: "Multiple sclerosis" },
  { code: "G20", description: "Parkinson's disease" },
  { code: "G30.9", description: "Alzheimer's disease, unspecified" },
  // Mental health
  { code: "F32.9", description: "Major depressive disorder, single episode, unspecified" },
  { code: "F41.1", description: "Generalized anxiety disorder" },
  { code: "F20.9", description: "Schizophrenia, unspecified" },
  { code: "F31.9", description: "Bipolar disorder, unspecified" },
  // Dermatology
  { code: "L20.9", description: "Atopic dermatitis, unspecified (Eczema)" },
  { code: "L40.0", description: "Psoriasis vulgaris" },
  { code: "L50.9", description: "Urticaria, unspecified (Hives)" },
  // Urological / Renal
  { code: "N39.0", description: "Urinary tract infection, site not specified" },
  { code: "N18.9", description: "Chronic kidney disease, unspecified" },
  { code: "N20.0", description: "Calculus of kidney (Kidney stone)" },
  // Other
  { code: "R51", description: "Headache" },
  { code: "R05", description: "Cough" },
  { code: "R50.9", description: "Fever, unspecified" },
  { code: "R10.9", description: "Unspecified abdominal pain" },
  { code: "R11", description: "Nausea and vomiting" },
  { code: "R00.0", description: "Tachycardia, unspecified" },
  { code: "Z23", description: "Encounter for immunization" },
  { code: "Z00.00", description: "Encounter for general adult medical examination" },
];

/**
 * Search ICD-10 codes by query string (matches code or description, case-insensitive).
 * Returns top 6 matches.
 */
export function searchICD10(query) {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim().toLowerCase();
  return ICD10_CODES.filter(
    (c) => c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
  ).slice(0, 6);
}
