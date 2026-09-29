/* MedRelief website — everything the team may need to change lives here.
 * No build step: edit, commit, and GitHub Pages republishes.
 *
 * DATA SOURCES (checked 2026-09-30):
 *  - Test MRPs .......... the current test list (MRP column)
 *  - Package offer price  the package master (same codes the counter bills)
 *  - Standard price ..... sum of the component tests' MRPs
 * Confirm against production before go-live; prices here are what the chat quotes
 * as an ESTIMATE — the collection agent / counter finalises the bill.
 */
window.MR_CONFIG = {
  brand: 'MedRelief Diagnostics',
  phone: '+919263840556',
  phoneDisplay: '+91 92638 40556',
  email: 'hi@medrelief.co.in',

  // A WhatsApp number that a PERSON reads. Leave '' if the business number is registered
  // on the WhatsApp Business API: messages to an API number have no human inbox, so a
  // "send on WhatsApp" hand-off would go nowhere.
  whatsapp: '',

  // Public booking API (medlab). '' = hand-off mode: the chat completes the booking
  // summary and the patient confirms it by phone. Set to e.g.
  // 'https://api.medlab.noshtek.ai/api/v1' once the /public/* endpoints ship
  // (contract: the home-collection workflow spec, §7 — kept outside this public repo).
  api: { baseUrl: '' },

  apps: {
    patientAndroid: 'https://app.medlab.noshtek.ai/install.html?app=patient&auto=1',
    patientIos: '',                                  // '' = "coming soon"
    patientWeb: 'https://patient.medlab.noshtek.ai',
    partnerPortal: 'https://doctor.medlab.noshtek.ai'
  },

  centres: [
    { id: 'bihar-sharif', name: 'Bihar Sharif', tag: 'Main centre & lab',
      address: '50 m North of Bhainsasur Chowk, Opp. Sudha Dairy, Bihar Sharif (Nalanda) — 803101',
      phones: ['+91 92638 40556', '061124 53327'] },
    { id: 'rajgir', name: 'Rajgir', tag: 'Collection centre',
      address: 'Rajgir, Nalanda district, Bihar', phones: ['+91 92638 40556'] },
    { id: 'ekangarsarai', name: 'Ekangarsarai', tag: 'Centre',
      address: 'Ekangarsarai, Nalanda district, Bihar', phones: ['+91 92638 40556'] },
    { id: 'madhubani', name: 'Madhubani', tag: 'Centre',
      address: 'Madhubani, Bihar', phones: ['+91 92638 40556'] }
  ],

  // CONFIRM: operating windows. Placeholders until the centres confirm their hours.
  slots: {
    home:   [ { label: '7 – 9 AM', start: 7 }, { label: '9 – 11 AM', start: 9 },
              { label: '11 AM – 1 PM', start: 11 }, { label: '4 – 6 PM', start: 16 } ],
    centre: [ { label: '8 – 10 AM', start: 8 }, { label: '10 AM – 12 PM', start: 10 },
              { label: '12 – 2 PM', start: 12 }, { label: '4 – 6 PM', start: 16 } ],
    daysAhead: 3            // Today (if a slot is still ahead) + the next days
  },

  homeCollection: {
    fee: null,              // CONFIRM: null = "any collection charge is confirmed by our team"
    pincodes: []            // CONFIRM: serviceable pincodes; [] = accept all, desk confirms coverage
  },

  // Common single tests the chat can quote. code = catalogue code (case-insensitive).
  tests: [
    { code: 'CBC',   name: 'Complete Blood Count (CBC)', mrp: 400 },
    { code: 'BSF',   name: 'Blood Sugar Fasting', mrp: 50, fasting: true },
    { code: 'Random',name: 'Blood Sugar Random', mrp: 50 },
    { code: 'HbA1c', name: 'HbA1c (3-month sugar)', mrp: 600 },
    { code: 'Lipid', name: 'Lipid Profile', mrp: 600, fasting: true },
    { code: 'LFT',   name: 'Liver Function Test (LFT)', mrp: 800 },
    { code: 'KFT',   name: 'Kidney Function Test (KFT)', mrp: 850 },
    { code: 'TFT',   name: 'Thyroid Profile', mrp: 600 },
    { code: 'TSH',   name: 'TSH', mrp: 300 },
    { code: '25',    name: 'Vitamin D3 (25 Hydroxy)', mrp: 1400 },
    { code: 'B12',   name: 'Vitamin B12', mrp: 1200 },
    { code: 'Urine Routine', name: 'Urine Routine', mrp: 100 },
    { code: 'CRP',   name: 'C-Reactive Protein (CRP)', mrp: 500 },
    { code: 'Uric Acid', name: 'Uric Acid', mrp: 200 },
    { code: 'Widal', name: 'Widal Test (typhoid)', mrp: 200 },
    { code: 'DENGUE NS1', name: 'Dengue Profile', mrp: 900 },
    { code: 'Malaria Parasite', name: 'Malaria Parasite', mrp: 200 }
  ],

  // CAMPAIGNS — the ticker + in-chat offer cards. Add, reorder or set active:false.
  // code = mdm_packages.code, so a booking maps 1:1 onto the package the counter bills.
  campaigns: [
    { code: 'MRD002', active: true, tag: 'Most booked', name: 'Nirogyam Standard',
      blurb: 'A full-body check: blood count, sugar, liver, kidney, lipids, thyroid and urine.',
      price: 1550, fasting: true,
      tests: [['Complete Blood Count', 400], ['HbA1c', 600], ['Blood Sugar Fasting', 50],
              ['Lipid Profile', 600], ['Liver Function Test', 800], ['Kidney Function Test', 850],
              ['Thyroid Profile', 600], ['Urine Routine', 100]] },
    { code: 'MRD003', active: true, tag: 'Best value', name: 'Nirogyam Premium',
      blurb: 'Everything in Standard, plus Vitamin D3.',
      price: 2050, fasting: true,
      tests: [['Complete Blood Count', 400], ['HbA1c', 600], ['Blood Sugar Fasting', 50],
              ['Lipid Profile', 600], ['Liver Function Test', 800], ['Kidney Function Test', 850],
              ['Thyroid Profile', 600], ['Urine Routine', 100], ['Vitamin D3 (25 Hydroxy)', 1400]] },
    { code: 'MRD001', active: true, tag: 'Starter', name: 'Nirogyam Basic',
      blurb: 'Liver, kidney, lipids, fasting sugar and TSH.',
      price: 1100, fasting: true,
      tests: [['Liver Function Test', 800], ['Kidney Function Test', 850], ['Lipid Profile', 600],
              ['Blood Sugar Fasting', 50], ['TSH', 300]] },
    { code: 'MRD005', active: true, tag: 'Diabetes', name: 'Nirogyam Diabetic',
      blurb: 'The routine diabetes check: HbA1c, fasting sugar, creatinine, CBC and urine.',
      price: 699, fasting: true,
      tests: [['HbA1c', 600], ['Blood Sugar Fasting', 50], ['Creatinine', 200],
              ['Complete Blood Count', 400], ['Urine Routine', 100]] },
    { code: 'MRD004', active: true, tag: 'Quick check', name: 'Nirogyam Mini',
      blurb: 'CBC, fasting sugar, cholesterol, SGPT, creatinine and TSH.',
      price: 799, fasting: true,
      tests: [['Complete Blood Count', 400], ['Blood Sugar Fasting', 50], ['Cholesterol', 200],
              ['SGPT', 200], ['Creatinine', 200], ['TSH', 300]] }
  ]
};
