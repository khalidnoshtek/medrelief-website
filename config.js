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

  // Our social handles (one set for all of Med Relief, not per centre). Shown in the footer.
  social: {
    handle: '@medreliefdiagnostics',
    instagram: 'https://www.instagram.com/medreliefdiagnostics/',
    facebook: 'https://www.facebook.com/medreliefdiagnostics',
    youtube: 'https://www.youtube.com/@medreliefdiagnostics',
  },

  // A WhatsApp number that a PERSON reads. Leave '' if the business number is registered
  // on the WhatsApp Business API: messages to an API number have no human inbox, so a
  // "send on WhatsApp" hand-off would go nowhere.
  whatsapp: '',

  // Campaign measurement (analytics.js). Empty = off: no banner, nothing loads.
  // ga4 = the GA4 Measurement ID ('G-XXXXXXX'); metaPixel = the Meta dataset (Pixel) ID.
  // Both load only after the visitor taps Allow on the consent banner.
  // GA4 property 'medrelief.co.in' (account Med Relief Diagnostics, Medrelief Marketing Google login);
  // Meta dataset 'medrelief.co.in website' in the Medrelief business portfolio (created 2026-11-07).
  analytics: { ga4: 'G-1Q7195C36E', metaPixel: '1133682649647706' },

  // Public booking API (medlab). On load the site asks GET /public/home-collection/status;
  // in-chat UPI payment switches on only when it answers online_payment: true (live
  // Razorpay keys). Unreachable / off = hand-off mode: the patient confirms by phone and
  // pays the agent at the door. '' disables the API entirely.
  api: { baseUrl: 'https://api.medlab.noshtek.ai/api/v1' },

  // Master switch for in-chat UPI payment. Razorpay only accepts payments from a website
  // registered on the merchant account; until this site's domain is approved there, keep
  // it false so patients get call-to-confirm instead of a payment Razorpay will refuse
  // (2026-10-10: khalidnoshtek.github.io not registered → payment_risk_check_failed).
  onlinePayments: true,
  // Razorpay accepts payments only from websites registered on the merchant account
  // (medrelief.co.in approved 2026-10-27). On any other host (e.g. the GitHub Pages copy)
  // the chat hands off to call-to-confirm instead of opening a checkout Razorpay will
  // refuse (and flag as a risk event).
  paymentHosts: ['medrelief.co.in', 'www.medrelief.co.in', 'app.medlab.noshtek.ai'],

  apps: {
    patientAndroid: 'https://app.medlab.noshtek.ai/install.html?app=patient&auto=1',
    patientIos: '',                                  // '' = "coming soon"
    patientWeb: 'https://patient.medlab.noshtek.ai',
    partnerPortal: 'https://doctor.medlab.noshtek.ai'
  },

  // address_hi = the address in Hindi (shown in हिंदी mode; '' or missing = the English one).
  // maps = the centre's Google Business Profile / Google Maps share link, used by /links
  //        ('' = a Google Maps search for the centre's name + address).
  // bookFrom / bookFromNote = a centre that is not taking bookings yet: until bookFrom
  //        ('YYYY-MM-DD', India time) the site shows the note and the chat's earliest day is
  //        bookFrom. Both switch off by themselves on that date — nothing to remove later.
  centres: [
    { id: 'bihar-sharif', name: 'Bihar Sharif', name_hi: 'बिहार शरीफ', tag: 'Centre & lab',
      address: '50 m North of Bhainsasur Chowk, Opp. Sudha Dairy, Bihar Sharif (Nalanda) — 803101',
      address_hi: 'भैंसासुर चौक से 50 मीटर उत्तर, सुधा डेयरी के सामने, बिहार शरीफ (नालंदा) — 803101',
      phones: ['+91 92638 40556', '061124 53327'], maps: '', whatsapp: '',
      lat: 25.205942, lng: 85.520323 },
    { id: 'rajgir', name: 'Rajgir', name_hi: 'राजगीर', tag: 'Collection centre',
      address: 'Rajgir, Nalanda district, Bihar', address_hi: 'राजगीर, नालंदा ज़िला, बिहार',
      phones: ['+91 92638 40556'], maps: '', whatsapp: '',
      lat: 25.0283, lng: 85.4206 },     // CONFIRM: approximate (town centre)
    { id: 'ekangarsarai', name: 'Ekangarsarai', name_hi: 'एकंगरसराय', tag: 'Centre',
      address: 'SAK Tower, Near Railway Fatak, Ekangarsarai (Nalanda) — 801301',
      address_hi: 'SAK टावर, रेलवे फाटक के पास, एकंगरसराय (नालंदा) — 801301',
      phones: ['+91 88935 13340'], maps: '',
      // On WhatsApp Business (Khalid 2026-11-14): the visit hand-off offers a WhatsApp button.
      whatsapp: '+91 88935 13340',
      lat: 25.2238, lng: 85.2340,       // CONFIRM: approximate (near the railway crossing)
      bookFrom: '2026-11-11',
      bookFromNote: 'एकंगरसराय में बुकिंग 11 नवंबर से / Ekangarsarai bookings start from 11 November' },
    { id: 'madhubani', name: 'Madhubani', tag: 'Centre',
      address: 'Ground Floor, Bhramdev Complex, In front of Watson High School (Behind Bazar India Mall / Domino\'s Pizza), Madhubani, Bihar 847211',
      address_hi: 'ग्राउंड फ़्लोर, ब्रह्मदेव कॉम्प्लेक्स, वॉटसन हाई स्कूल के सामने (बाज़ार इंडिया मॉल / डोमिनोज़ पिज़्ज़ा के पीछे), मधुबनी, बिहार 847211',
      phones: ['+91 91421 55427'], maps: '', whatsapp: '',
      lat: 26.3537, lng: 86.0718 }      // CONFIRM: approximate (town centre)
  ],

  // CONFIRM: operating windows. Placeholders until the centres confirm their hours.
  slots: {
    home:   [ { label: '7 – 9 AM', label_hi: 'सुबह 7 – 9 बजे', start: 7 }, { label: '9 – 11 AM', label_hi: 'सुबह 9 – 11 बजे', start: 9 },
              { label: '11 AM – 1 PM', label_hi: 'सुबह 11 – दोपहर 1 बजे', start: 11 }, { label: '4 – 6 PM', label_hi: 'शाम 4 – 6 बजे', start: 16 } ],
    centre: [ { label: '8 – 10 AM', label_hi: 'सुबह 8 – 10 बजे', start: 8 }, { label: '10 AM – 12 PM', label_hi: 'सुबह 10 – दोपहर 12 बजे', start: 10 },
              { label: '12 – 2 PM', label_hi: 'दोपहर 12 – 2 बजे', start: 12 }, { label: '4 – 6 PM', label_hi: 'शाम 4 – 6 बजे', start: 16 } ],
    daysAhead: 3            // Today (if a slot is still ahead) + the next days
  },

  // Home collection only within radiusKm of the lab. The browser checks first (shared
  // location); the server re-checks against org_centers.latitude/longitude/
  // home_collection_radius_km (set by migration to the same pin). Lab pin = Google Maps
  // "Med Relief Diagnostic- Bihar Sharif", Plus Code 6G4C+93H, Kaghzi Mohalla Rd, Bhaisasur.
  homeCollection: {
    lab: { name: 'Bihar Sharif', lat: 25.205942, lng: 85.520323 },
    radiusKm: 15,
    fee: null               // CONFIRM: null = no separate collection charge shown
  },

  // Razorpay Standard Checkout (loaded only when the patient taps Pay).
  razorpay: { script: 'https://checkout.razorpay.com/v1/checkout.js', brandColor: '#86198F' },

  // Common single tests the chat can quote. code = the EXACT catalogue code (case-insensitive) —
  // the server re-prices by code at checkout, so a code that isn't an exact match fails
  // (Widal's catalogue code is 'WIDAL TEST *', checked 2026-10-27).
  tests: [
    { code: 'CBC',   name: 'Complete Blood Count (CBC)', name_hi: 'कम्प्लीट ब्लड काउंट (CBC)', mrp: 400 },
    { code: 'BSF',   name: 'Blood Sugar Fasting', name_hi: 'फ़ास्टिंग ब्लड शुगर', mrp: 50, fasting: true },
    { code: 'Random',name: 'Blood Sugar Random', name_hi: 'रैंडम ब्लड शुगर', mrp: 50 },
    { code: 'HbA1c', name: 'HbA1c (3-month sugar)', name_hi: 'HbA1c (3 महीने की शुगर)', mrp: 600 },
    { code: 'Lipid', name: 'Lipid Profile', name_hi: 'लिपिड प्रोफ़ाइल (कोलेस्ट्रॉल)', mrp: 600, fasting: true },
    { code: 'LFT',   name: 'Liver Function Test (LFT)', name_hi: 'लिवर फ़ंक्शन टेस्ट (LFT)', mrp: 800 },
    { code: 'KFT',   name: 'Kidney Function Test (KFT)', name_hi: 'किडनी फ़ंक्शन टेस्ट (KFT)', mrp: 850 },
    { code: 'TFT',   name: 'Thyroid Profile', name_hi: 'थायरॉइड प्रोफ़ाइल', mrp: 600 },
    { code: 'TSH',   name: 'TSH', name_hi: 'TSH (थायरॉइड)', mrp: 300 },
    { code: '25',    name: 'Vitamin D3 (25 Hydroxy)', name_hi: 'विटामिन D3', mrp: 1400 },
    { code: 'B12',   name: 'Vitamin B12', name_hi: 'विटामिन B12', mrp: 1200 },
    { code: 'Urine Routine', name: 'Urine Routine', name_hi: 'पेशाब की जाँच (रूटीन)', mrp: 100 },
    { code: 'CRP',   name: 'C-Reactive Protein (CRP)', name_hi: 'CRP (सूजन की जाँच)', mrp: 500 },
    { code: 'Uric Acid', name: 'Uric Acid', name_hi: 'यूरिक एसिड', mrp: 200 },
    { code: 'WIDAL TEST *', name: 'Widal Test (typhoid)', name_hi: 'विडाल टेस्ट (टाइफ़ाइड)', mrp: 200 },
    { code: 'DENGUE NS1', name: 'Dengue Profile', name_hi: 'डेंगू प्रोफ़ाइल', mrp: 900 },
    { code: 'Malaria Parasite', name: 'Malaria Parasite', name_hi: 'मलेरिया जाँच', mrp: 200 }
  ],

  // CAMPAIGNS — the ticker + in-chat offer cards. Add, reorder or set active:false.
  // Hindi names of the tests inside the packages below (shown in हिंदी mode).
  testNamesHi: {
    'Complete Blood Count': 'कम्प्लीट ब्लड काउंट (CBC)', 'HbA1c': 'HbA1c (3 महीने की शुगर)',
    'Blood Sugar Fasting': 'फ़ास्टिंग ब्लड शुगर', 'Lipid Profile': 'लिपिड प्रोफ़ाइल (कोलेस्ट्रॉल)',
    'Liver Function Test': 'लिवर फ़ंक्शन टेस्ट (LFT)', 'Kidney Function Test': 'किडनी फ़ंक्शन टेस्ट (KFT)',
    'Thyroid Profile': 'थायरॉइड प्रोफ़ाइल', 'Urine Routine': 'पेशाब की जाँच (रूटीन)',
    'Vitamin D3 (25 Hydroxy)': 'विटामिन D3', 'TSH': 'TSH (थायरॉइड)', 'Creatinine': 'क्रिएटिनिन',
    'Cholesterol': 'कोलेस्ट्रॉल', 'SGPT': 'SGPT (लिवर)'
  },

  // code = mdm_packages.code, so a booking maps 1:1 onto the package the counter bills.
  campaigns: [
    { code: 'MRD002', active: true, tag_hi: 'सबसे ज़्यादा बुक', name_hi: 'निरोग्यम स्टैंडर्ड', blurb_hi: 'पूरे शरीर की जाँच: ब्लड काउंट, शुगर, लिवर, किडनी, लिपिड, थायरॉइड और पेशाब।', tag: 'Most booked', name: 'Nirogyam Standard',
      blurb: 'A full-body check: blood count, sugar, liver, kidney, lipids, thyroid and urine.',
      price: 1550, fasting: true,
      tests: [['Complete Blood Count', 400], ['HbA1c', 600], ['Blood Sugar Fasting', 50],
              ['Lipid Profile', 600], ['Liver Function Test', 800], ['Kidney Function Test', 850],
              ['Thyroid Profile', 600], ['Urine Routine', 100]] },
    { code: 'MRD003', active: true, tag_hi: 'सबसे फ़ायदेमंद', name_hi: 'निरोग्यम प्रीमियम', blurb_hi: 'स्टैंडर्ड की सारी जाँचें, साथ में विटामिन D3।', tag: 'Best value', name: 'Nirogyam Premium',
      blurb: 'Everything in Standard, plus Vitamin D3.',
      price: 2050, fasting: true,
      tests: [['Complete Blood Count', 400], ['HbA1c', 600], ['Blood Sugar Fasting', 50],
              ['Lipid Profile', 600], ['Liver Function Test', 800], ['Kidney Function Test', 850],
              ['Thyroid Profile', 600], ['Urine Routine', 100], ['Vitamin D3 (25 Hydroxy)', 1400]] },
    { code: 'MRD001', active: true, tag_hi: 'शुरुआती', name_hi: 'निरोग्यम बेसिक', blurb_hi: 'लिवर, किडनी, लिपिड, फ़ास्टिंग शुगर और TSH।', tag: 'Starter', name: 'Nirogyam Basic',
      blurb: 'Liver, kidney, lipids, fasting sugar and TSH.',
      price: 1100, fasting: true,
      tests: [['Liver Function Test', 800], ['Kidney Function Test', 850], ['Lipid Profile', 600],
              ['Blood Sugar Fasting', 50], ['TSH', 300]] },
    { code: 'MRD005', active: true, tag_hi: 'डायबिटीज़', name_hi: 'निरोग्यम डायबिटिक', blurb_hi: 'डायबिटीज़ की नियमित जाँच: HbA1c, फ़ास्टिंग शुगर, क्रिएटिनिन, CBC और पेशाब।', tag: 'Diabetes', name: 'Nirogyam Diabetic',
      blurb: 'The routine diabetes check: HbA1c, fasting sugar, creatinine, CBC and urine.',
      price: 699, fasting: true,
      tests: [['HbA1c', 600], ['Blood Sugar Fasting', 50], ['Creatinine', 200],
              ['Complete Blood Count', 400], ['Urine Routine', 100]] },
    { code: 'MRD004', active: true, tag_hi: 'जल्दी जाँच', name_hi: 'निरोग्यम मिनी', blurb_hi: 'CBC, फ़ास्टिंग शुगर, कोलेस्ट्रॉल, SGPT, क्रिएटिनिन और TSH।', tag: 'Quick check', name: 'Nirogyam Mini',
      blurb: 'CBC, fasting sugar, cholesterol, SGPT, creatinine and TSH.',
      price: 799, fasting: true,
      tests: [['Complete Blood Count', 400], ['Blood Sugar Fasting', 50], ['Cholesterol', 200],
              ['SGPT', 200], ['Creatinine', 200], ['TSH', 300]] }
  ]
};

// Today's date in India (Asia/Kolkata) as 'YYYY-MM-DD', whatever time zone the visitor's phone is set to.
window.MR_TODAY_IST = function () {
  try {
    var p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    if (p.year && p.month && p.day) return p.year + '-' + p.month + '-' + p.day;
  } catch (e) {}
  return new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);   // IST = UTC+5:30, no DST
};
// A centre not taking bookings yet → its first bookable day ('YYYY-MM-DD'); '' once that day has come.
window.MR_BOOK_FROM = function (centre) {
  return (centre && centre.bookFrom && window.MR_TODAY_IST() < centre.bookFrom) ? centre.bookFrom : '';
};
