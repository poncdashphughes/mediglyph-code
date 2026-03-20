import type { ConditionCode } from './types';

/**
 * Complete condition code registry covering all tiers.
 * Code ranges:
 *   T0: 0x00-0x0F  (PAUSE — life-threatening)
 *   T1: 0x10-0x37  (CONSTRAINT — allergies, contraindications, medications)
 *   T2: 0x40-0x6E  (CONTEXT — chronic conditions)
 *   T3: 0x70-0x8D  (ATYPICAL — communication, physical, legal)
 *   T4: 0x90-0x9C  (CONFIRM — emergency contacts)
 */
export const CONDITIONS: ConditionCode[] = [
  // ── TIER 0 — PAUSE (0x00-0x0F) ──
  { code: '00', tier: 0, subcategory: 'cardiac', label: 'Pacemaker', shortLabel: 'Pacemaker' },
  { code: '01', tier: 0, subcategory: 'cardiac', label: 'ICD (Implantable Cardioverter-Defibrillator)', shortLabel: 'ICD' },
  { code: '02', tier: 0, subcategory: 'allergy', label: 'Severe Anaphylaxis History', shortLabel: 'Anaphylaxis' },
  { code: '03', tier: 0, subcategory: 'endocrine', label: 'Adrenal Insufficiency', shortLabel: 'Adrenal Insufficiency' },
  { code: '04', tier: 0, subcategory: 'haematology', label: 'Bleeding Disorder (Haemophilia)', shortLabel: 'Haemophilia' },
  { code: '05', tier: 0, subcategory: 'haematology', label: 'On Anticoagulants (Warfarin/DOACs)', shortLabel: 'Warfarin/DOACs' },
  { code: '06', tier: 0, subcategory: 'anaesthesia', label: 'Malignant Hyperthermia Risk', shortLabel: 'Malignant Hyperthermia' },
  { code: '07', tier: 0, subcategory: 'cardiac', label: 'Long QT Syndrome', shortLabel: 'Long QT' },
  { code: '08', tier: 0, subcategory: 'allergy', label: 'Mastocytosis', shortLabel: 'Mastocytosis' },
  { code: '09', tier: 0, subcategory: 'neuro', label: 'Myasthenia Gravis', shortLabel: 'Myasthenia Gravis' },
  { code: '0a', tier: 0, subcategory: 'respiratory', label: 'Severe Asthma (Brittle/Near-Fatal)', shortLabel: 'Severe Asthma' },
  { code: '0b', tier: 0, subcategory: 'endocrine', label: "Addison's Disease", shortLabel: "Addison's" },
  { code: '0c', tier: 0, subcategory: 'allergy', label: 'Hereditary Angioedema', shortLabel: 'Angioedema' },
  { code: '0d', tier: 0, subcategory: 'cardiac', label: 'Heart Transplant', shortLabel: 'Heart Transplant' },
  { code: '0e', tier: 0, subcategory: 'cardiac', label: 'Pulmonary Hypertension', shortLabel: 'Pulmonary HTN' },
  { code: '0f', tier: 0, subcategory: 'other', label: 'Other Life-Threat (see notes)', shortLabel: 'Other Life-Threat' },

  // ── TIER 1 — CONSTRAINT: Drug Allergies (0x10-0x1B) ──
  { code: '10', tier: 1, subcategory: 'drug_allergy', label: 'Penicillin Allergy', shortLabel: 'Penicillin' },
  { code: '11', tier: 1, subcategory: 'drug_allergy', label: 'Sulfa Drug Allergy', shortLabel: 'Sulfa' },
  { code: '12', tier: 1, subcategory: 'drug_allergy', label: 'NSAID Allergy', shortLabel: 'NSAIDs' },
  { code: '13', tier: 1, subcategory: 'drug_allergy', label: 'Opioid Allergy', shortLabel: 'Opioids' },
  { code: '14', tier: 1, subcategory: 'drug_allergy', label: 'Cephalosporin Allergy', shortLabel: 'Cephalosporins' },
  { code: '15', tier: 1, subcategory: 'drug_allergy', label: 'Fluoroquinolone Allergy', shortLabel: 'Fluoroquinolones' },
  { code: '16', tier: 1, subcategory: 'drug_allergy', label: 'ACE Inhibitor Allergy', shortLabel: 'ACE Inhibitors' },
  { code: '17', tier: 1, subcategory: 'drug_allergy', label: 'Beta Blocker Allergy', shortLabel: 'Beta Blockers' },
  { code: '18', tier: 1, subcategory: 'drug_allergy', label: 'Contrast Dye (Iodine) Allergy', shortLabel: 'Contrast Dye' },
  { code: '19', tier: 1, subcategory: 'material_allergy', label: 'Latex Allergy', shortLabel: 'Latex' },
  { code: '1a', tier: 1, subcategory: 'drug_allergy', label: 'Anaesthetic Agent Allergy', shortLabel: 'Anaesthetics' },
  { code: '1b', tier: 1, subcategory: 'drug_allergy', label: 'Other Drug Allergy', shortLabel: 'Other Drug' },

  // ── TIER 1 — CONSTRAINT: Food Allergies (0x1C-0x25) ──
  { code: '1c', tier: 1, subcategory: 'food_allergy', label: 'Peanut Allergy', shortLabel: 'Peanuts' },
  { code: '1d', tier: 1, subcategory: 'food_allergy', label: 'Tree Nut Allergy', shortLabel: 'Tree Nuts' },
  { code: '1e', tier: 1, subcategory: 'food_allergy', label: 'Shellfish Allergy', shortLabel: 'Shellfish' },
  { code: '1f', tier: 1, subcategory: 'food_allergy', label: 'Fish Allergy', shortLabel: 'Fish' },
  { code: '20', tier: 1, subcategory: 'food_allergy', label: 'Egg Allergy', shortLabel: 'Eggs' },
  { code: '21', tier: 1, subcategory: 'food_allergy', label: 'Dairy/Milk Allergy', shortLabel: 'Dairy' },
  { code: '22', tier: 1, subcategory: 'food_allergy', label: 'Wheat/Gluten Allergy', shortLabel: 'Wheat/Gluten' },
  { code: '23', tier: 1, subcategory: 'food_allergy', label: 'Soy Allergy', shortLabel: 'Soy' },
  { code: '24', tier: 1, subcategory: 'food_allergy', label: 'Sesame Allergy', shortLabel: 'Sesame' },
  { code: '25', tier: 1, subcategory: 'food_allergy', label: 'Other Food Allergy', shortLabel: 'Other Food' },

  // ── TIER 1 — CONSTRAINT: Environmental (0x26-0x27) ──
  { code: '26', tier: 1, subcategory: 'env_allergy', label: 'Bee/Wasp Sting Allergy', shortLabel: 'Bee/Wasp' },
  { code: '27', tier: 1, subcategory: 'env_allergy', label: 'Other Insect Allergy', shortLabel: 'Other Insect' },

  // ── TIER 1 — CONSTRAINT: Treatment Contraindications (0x28-0x30) ──
  { code: '28', tier: 1, subcategory: 'contraindication', label: 'No MRI', shortLabel: 'No MRI' },
  { code: '29', tier: 1, subcategory: 'contraindication', label: 'No Adrenaline/Epinephrine', shortLabel: 'No Adrenaline' },
  { code: '2a', tier: 1, subcategory: 'contraindication', label: 'Difficult Airway/Intubation', shortLabel: 'Difficult Airway' },
  { code: '2b', tier: 1, subcategory: 'contraindication', label: 'No BP/IV/Needles LEFT Arm', shortLabel: 'No Left Arm' },
  { code: '2c', tier: 1, subcategory: 'contraindication', label: 'No BP/IV/Needles RIGHT Arm', shortLabel: 'No Right Arm' },
  { code: '2d', tier: 1, subcategory: 'contraindication', label: 'No Blood Products', shortLabel: 'No Blood Prods' },
  { code: '2e', tier: 1, subcategory: 'contraindication', label: 'Steroid-Dependent', shortLabel: 'Steroid-Dependent' },
  { code: '2f', tier: 1, subcategory: 'contraindication', label: 'Carries EpiPen', shortLabel: 'EpiPen' },
  { code: '30', tier: 1, subcategory: 'contraindication', label: 'Other Constraint', shortLabel: 'Other Constraint' },

  // ── TIER 1 — CONSTRAINT: Current Medications (0x31-0x37) ──
  { code: '31', tier: 1, subcategory: 'medication', label: 'Immunosuppressants', shortLabel: 'Immunosuppressants' },
  { code: '32', tier: 1, subcategory: 'medication', label: 'MAOIs', shortLabel: 'MAOIs' },
  { code: '33', tier: 1, subcategory: 'medication', label: 'Insulin', shortLabel: 'Insulin' },
  { code: '34', tier: 1, subcategory: 'medication', label: 'Chemotherapy', shortLabel: 'Chemotherapy' },
  { code: '35', tier: 1, subcategory: 'medication', label: 'Lithium', shortLabel: 'Lithium' },
  { code: '36', tier: 1, subcategory: 'medication', label: 'Digoxin', shortLabel: 'Digoxin' },
  { code: '37', tier: 1, subcategory: 'medication', label: 'Other Medication', shortLabel: 'Other Medication' },

  // ── TIER 2 — CONTEXT: Neurological (0x40-0x49) ──
  { code: '40', tier: 2, subcategory: 'neurological', label: 'Epilepsy', shortLabel: 'Epilepsy' },
  { code: '41', tier: 2, subcategory: 'neurological', label: "Alzheimer's Disease", shortLabel: "Alzheimer's" },
  { code: '42', tier: 2, subcategory: 'neurological', label: 'Dementia (Other)', shortLabel: 'Dementia' },
  { code: '43', tier: 2, subcategory: 'neurological', label: "Parkinson's Disease", shortLabel: "Parkinson's" },
  { code: '44', tier: 2, subcategory: 'neurological', label: 'Multiple Sclerosis', shortLabel: 'MS' },
  { code: '45', tier: 2, subcategory: 'neurological', label: 'Stroke History', shortLabel: 'Stroke History' },
  { code: '46', tier: 2, subcategory: 'neurological', label: 'Brain Injury (TBI)', shortLabel: 'TBI' },
  { code: '47', tier: 2, subcategory: 'neurological', label: 'Tourette Syndrome', shortLabel: 'Tourette' },
  { code: '48', tier: 2, subcategory: 'neurological', label: 'Narcolepsy', shortLabel: 'Narcolepsy' },
  { code: '49', tier: 2, subcategory: 'neurological', label: 'Migraine with Aura', shortLabel: 'Migraine/Aura' },

  // ── TIER 2 — CONTEXT: Metabolic (0x4A-0x4E) ──
  { code: '4a', tier: 2, subcategory: 'metabolic', label: 'Diabetes Type 1', shortLabel: 'Type 1 Diabetes' },
  { code: '4b', tier: 2, subcategory: 'metabolic', label: 'Diabetes Type 2', shortLabel: 'Type 2 Diabetes' },
  { code: '4c', tier: 2, subcategory: 'metabolic', label: 'Hypoglycaemia Tendency', shortLabel: 'Hypoglycaemia' },
  { code: '4d', tier: 2, subcategory: 'metabolic', label: 'Thyroid Disorder', shortLabel: 'Thyroid' },
  { code: '4e', tier: 2, subcategory: 'metabolic', label: 'Phenylketonuria (PKU)', shortLabel: 'PKU' },

  // ── TIER 2 — CONTEXT: Cardiovascular (0x50-0x55) ──
  { code: '50', tier: 2, subcategory: 'cardiovascular', label: 'Heart Failure', shortLabel: 'Heart Failure' },
  { code: '51', tier: 2, subcategory: 'cardiovascular', label: 'Atrial Fibrillation', shortLabel: 'AFib' },
  { code: '52', tier: 2, subcategory: 'cardiovascular', label: 'Angina', shortLabel: 'Angina' },
  { code: '53', tier: 2, subcategory: 'cardiovascular', label: 'Previous Heart Attack', shortLabel: 'Prev. MI' },
  { code: '54', tier: 2, subcategory: 'cardiovascular', label: 'POTS (Postural Tachycardia)', shortLabel: 'POTS' },
  { code: '55', tier: 2, subcategory: 'cardiovascular', label: 'Known Aneurysm', shortLabel: 'Aneurysm' },

  // ── TIER 2 — CONTEXT: Respiratory (0x56-0x59) ──
  { code: '56', tier: 2, subcategory: 'respiratory', label: 'Asthma', shortLabel: 'Asthma' },
  { code: '57', tier: 2, subcategory: 'respiratory', label: 'COPD', shortLabel: 'COPD' },
  { code: '58', tier: 2, subcategory: 'respiratory', label: 'Cystic Fibrosis', shortLabel: 'Cystic Fibrosis' },
  { code: '59', tier: 2, subcategory: 'respiratory', label: 'Sleep Apnoea', shortLabel: 'Sleep Apnoea' },

  // ── TIER 2 — CONTEXT: Mental Health (0x5A-0x5F) ──
  { code: '5a', tier: 2, subcategory: 'mental_health', label: 'Depression', shortLabel: 'Depression' },
  { code: '5b', tier: 2, subcategory: 'mental_health', label: 'Bipolar Disorder', shortLabel: 'Bipolar' },
  { code: '5c', tier: 2, subcategory: 'mental_health', label: 'Schizophrenia', shortLabel: 'Schizophrenia' },
  { code: '5d', tier: 2, subcategory: 'mental_health', label: 'Anxiety Disorder', shortLabel: 'Anxiety' },
  { code: '5e', tier: 2, subcategory: 'mental_health', label: 'PTSD', shortLabel: 'PTSD' },
  { code: '5f', tier: 2, subcategory: 'mental_health', label: 'Other Mental Health', shortLabel: 'Other Mental Health' },

  // ── TIER 2 — CONTEXT: Developmental (0x60-0x64) ──
  { code: '60', tier: 2, subcategory: 'developmental', label: 'Autism Spectrum Disorder', shortLabel: 'Autism' },
  { code: '61', tier: 2, subcategory: 'developmental', label: 'Down Syndrome', shortLabel: 'Down Syndrome' },
  { code: '62', tier: 2, subcategory: 'developmental', label: 'Intellectual Disability', shortLabel: 'Intellectual Disability' },
  { code: '63', tier: 2, subcategory: 'developmental', label: 'ADHD', shortLabel: 'ADHD' },
  { code: '64', tier: 2, subcategory: 'developmental', label: 'Learning Disability', shortLabel: 'Learning Disability' },

  // ── TIER 2 — CONTEXT: Other (0x65-0x6E) ──
  { code: '65', tier: 2, subcategory: 'other_chronic', label: 'Chronic Fatigue Syndrome', shortLabel: 'CFS/ME' },
  { code: '66', tier: 2, subcategory: 'other_chronic', label: 'Fibromyalgia', shortLabel: 'Fibromyalgia' },
  { code: '67', tier: 2, subcategory: 'other_chronic', label: 'Chronic Kidney Disease', shortLabel: 'CKD' },
  { code: '68', tier: 2, subcategory: 'other_chronic', label: 'Liver Disease', shortLabel: 'Liver Disease' },
  { code: '69', tier: 2, subcategory: 'other_chronic', label: 'Lupus (SLE)', shortLabel: 'Lupus' },
  { code: '6a', tier: 2, subcategory: 'other_chronic', label: 'Ehlers-Danlos Syndrome', shortLabel: 'EDS' },
  { code: '6b', tier: 2, subcategory: 'other_chronic', label: 'Gastroparesis', shortLabel: 'Gastroparesis' },
  { code: '6c', tier: 2, subcategory: 'other_chronic', label: 'Celiac Disease', shortLabel: 'Celiac' },
  { code: '6d', tier: 2, subcategory: 'other_chronic', label: 'Substance Use Disorder (Recovery)', shortLabel: 'Recovery' },
  { code: '6e', tier: 2, subcategory: 'other_chronic', label: 'Other Condition', shortLabel: 'Other Condition' },

  // ── TIER 3 — ATYPICAL: Communication (0x70-0x76) ──
  { code: '70', tier: 3, subcategory: 'communication', label: 'Non-Verbal', shortLabel: 'Non-Verbal' },
  { code: '71', tier: 3, subcategory: 'communication', label: 'Deaf / Hard of Hearing', shortLabel: 'Deaf/HoH' },
  { code: '72', tier: 3, subcategory: 'communication', label: 'Blind / Visually Impaired', shortLabel: 'Blind' },
  { code: '73', tier: 3, subcategory: 'communication', label: 'Speech Impairment', shortLabel: 'Speech Impairment' },
  { code: '74', tier: 3, subcategory: 'communication', label: 'English Not First Language', shortLabel: 'Non-English' },
  { code: '75', tier: 3, subcategory: 'communication', label: 'Selective Mutism', shortLabel: 'Selective Mutism' },
  { code: '76', tier: 3, subcategory: 'communication', label: 'Uses AAC Device', shortLabel: 'AAC Device' },

  // ── TIER 3 — ATYPICAL: Physical (0x77-0x7F) ──
  { code: '77', tier: 3, subcategory: 'physical', label: 'Limb Amputation/Difference', shortLabel: 'Limb Difference' },
  { code: '78', tier: 3, subcategory: 'physical', label: 'Prosthetic Limb', shortLabel: 'Prosthetic' },
  { code: '79', tier: 3, subcategory: 'physical', label: 'Wheelchair User', shortLabel: 'Wheelchair' },
  { code: '7a', tier: 3, subcategory: 'physical', label: 'Spinal Cord Injury', shortLabel: 'Spinal Cord Injury' },
  { code: '7b', tier: 3, subcategory: 'physical', label: 'Colostomy/Ileostomy', shortLabel: 'Colostomy' },
  { code: '7c', tier: 3, subcategory: 'physical', label: 'Tracheostomy', shortLabel: 'Tracheostomy' },
  { code: '7d', tier: 3, subcategory: 'physical', label: 'Feeding Tube (PEG/NG)', shortLabel: 'Feeding Tube' },
  { code: '7e', tier: 3, subcategory: 'physical', label: 'Dialysis Fistula/Catheter', shortLabel: 'Dialysis Access' },
  { code: '7f', tier: 3, subcategory: 'physical', label: 'Central Line/Port', shortLabel: 'Central Line' },

  // ── TIER 3 — ATYPICAL: Legal/Care Directives (0x80-0x86) ──
  { code: '80', tier: 3, subcategory: 'legal', label: 'DNR (Do Not Resuscitate)', shortLabel: 'DNR' },
  { code: '81', tier: 3, subcategory: 'legal', label: 'DNAR / AND', shortLabel: 'DNAR' },
  { code: '82', tier: 3, subcategory: 'legal', label: 'POLST/MOLST Exists', shortLabel: 'POLST' },
  { code: '83', tier: 3, subcategory: 'legal', label: 'Living Will Exists', shortLabel: 'Living Will' },
  { code: '84', tier: 3, subcategory: 'legal', label: 'Healthcare Proxy Assigned', shortLabel: 'Healthcare Proxy' },
  { code: '85', tier: 3, subcategory: 'legal', label: 'Comfort Care Only', shortLabel: 'Comfort Care' },
  { code: '86', tier: 3, subcategory: 'legal', label: 'No Blood Transfusion', shortLabel: 'No Transfusion' },

  // ── TIER 3 — ATYPICAL: Special Circumstances (0x87-0x8D) ──
  { code: '87', tier: 3, subcategory: 'special', label: 'Pregnant', shortLabel: 'Pregnant' },
  { code: '88', tier: 3, subcategory: 'special', label: 'Bariatric Surgery History', shortLabel: 'Bariatric Surgery' },
  { code: '89', tier: 3, subcategory: 'special', label: 'Organ Transplant Recipient', shortLabel: 'Organ Transplant' },
  { code: '8a', tier: 3, subcategory: 'special', label: 'Organ Donor', shortLabel: 'Organ Donor' },
  { code: '8b', tier: 3, subcategory: 'special', label: 'Rare Blood Type', shortLabel: 'Rare Blood Type' },
  { code: '8c', tier: 3, subcategory: 'special', label: 'Child/Minor', shortLabel: 'Child/Minor' },
  { code: '8d', tier: 3, subcategory: 'special', label: 'Other Factor', shortLabel: 'Other Factor' },

  // ── TIER 4 — CONFIRM (0x90-0x9C) ──
  { code: '90', tier: 4, subcategory: 'contact', label: 'Emergency Contact (ICE)', shortLabel: 'ICE Contact' },
  { code: '91', tier: 4, subcategory: 'contact', label: 'Second Emergency Contact', shortLabel: '2nd Contact' },
  { code: '92', tier: 4, subcategory: 'contact', label: 'Primary Physician', shortLabel: 'GP/PCP' },
  { code: '93', tier: 4, subcategory: 'contact', label: 'Specialist Physician', shortLabel: 'Specialist' },
  { code: '94', tier: 4, subcategory: 'reference', label: 'Medical Record URL', shortLabel: 'Record URL' },
  { code: '95', tier: 4, subcategory: 'reference', label: 'MedicAlert / Service ID', shortLabel: 'MedicAlert' },
  { code: '96', tier: 4, subcategory: 'contact', label: 'Hospital/Clinic', shortLabel: 'Hospital' },
  { code: '97', tier: 4, subcategory: 'reference', label: 'See Engraved Text', shortLabel: 'Engraved Text' },
  { code: '98', tier: 4, subcategory: 'reference', label: 'See Wallet Card', shortLabel: 'Wallet Card' },
  { code: '99', tier: 4, subcategory: 'contact', label: 'Pharmacy', shortLabel: 'Pharmacy' },
  { code: '9a', tier: 4, subcategory: 'reference', label: 'Insurance Info', shortLabel: 'Insurance' },
  { code: '9b', tier: 4, subcategory: 'reference', label: 'National Health ID (NHS)', shortLabel: 'NHS Number' },
  { code: '9c', tier: 4, subcategory: 'reference', label: 'Other', shortLabel: 'Other' },
];

/** Lookup condition by hex code */
export function getCondition(code: string): ConditionCode | undefined {
  return CONDITIONS.find(c => c.code === code.toLowerCase());
}

/** Get all conditions for a given tier */
export function getConditionsForTier(tier: 0 | 1 | 2 | 3 | 4): ConditionCode[] {
  return CONDITIONS.filter(c => c.tier === tier);
}

/** Get unique subcategories for a tier */
export function getSubcategoriesForTier(tier: 0 | 1 | 2 | 3 | 4): string[] {
  const subs = new Set<string>();
  CONDITIONS.filter(c => c.tier === tier).forEach(c => subs.add(c.subcategory));
  return [...subs];
}

/** Quick lookup map: hex code → label */
export const CONDITIONS_MAP: Record<string, string> = Object.fromEntries(
  CONDITIONS.map(c => [c.code, c.label])
);

/**
 * Sequential bit index for each condition (tiers 0-3 only, used in bitfield encoding).
 * Maps hex code → bit position (0-based).
 */
const _selectableConditions = CONDITIONS.filter(c => c.tier <= 3);
export const CONDITION_BIT_INDEX: Record<string, number> = Object.fromEntries(
  _selectableConditions.map((c, i) => [c.code, i])
);
export const BIT_INDEX_TO_CODE: Record<number, string> = Object.fromEntries(
  _selectableConditions.map((c, i) => [i, c.code])
);
export const TOTAL_SELECTABLE_CONDITIONS = _selectableConditions.length;

/** Subcategory display names */
export const SUBCATEGORY_LABELS: Record<string, string> = {
  cardiac: 'Cardiac',
  allergy: 'Allergy',
  endocrine: 'Endocrine',
  haematology: 'Haematology',
  anaesthesia: 'Anaesthesia',
  neuro: 'Neurological',
  respiratory: 'Respiratory',
  other: 'Other',
  drug_allergy: 'Drug Allergies',
  food_allergy: 'Food Allergies',
  material_allergy: 'Material',
  env_allergy: 'Environmental',
  contraindication: 'Contraindications',
  medication: 'Current Medications',
  neurological: 'Neurological',
  metabolic: 'Metabolic',
  cardiovascular: 'Cardiovascular',
  mental_health: 'Mental Health',
  developmental: 'Developmental',
  other_chronic: 'Other Chronic',
  communication: 'Communication',
  physical: 'Physical',
  legal: 'Legal Directives',
  special: 'Special Circumstances',
  contact: 'Contacts',
  reference: 'References',
};
