// Pure data — no React, no side effects.

export interface BilingualOption {
  hi: string;
  en: string;
}

export interface CountryCode {
  code: string;
  country: string;
  flag: string;
}

// ── GOTRAS ──────────────────────────────────────────────────────────────────

export const GOTRAS: BilingualOption[] = [
  // Common (ordered by community frequency)
  { hi: "कूलवाल", en: "Kulwal" },
  { hi: "खुटेटा", en: "Khuteta" },
  { hi: "झालानी", en: "Jhalani" },
  { hi: "रावत", en: "Rawat" },
  { hi: "ठाकुरिया", en: "Thakuria" },
  { hi: "भूख्मारिया", en: "Bhukhmaria" },
  { hi: "मेठी", en: "Methi" },
  { hi: "घीया", en: "Gheeya" },
  { hi: "पटोदिया", en: "Patodia" },
  { hi: "ताम्बी", en: "Tambi" },
  { hi: "टोडवाल", en: "Todwal" },
  { hi: "बडाया", en: "Badaya" },
  { hi: "जघिनिया", en: "Jaghinia" },
  { hi: "कट्टा", en: "Katta" },
  { hi: "सोंखिया", en: "Sonkhia" },

  // Rest (alpha by en)
  { hi: "आकड़", en: "Aakad" },
  { hi: "बढेरा", en: "Badera" },
  { hi: "बडगोती", en: "Badgoti" },
  { hi: "बाजरगान", en: "Bajargan" },
  { hi: "बम्ब", en: "Bamb" },
  { hi: "बटवाडा", en: "Batwada" },
  { hi: "डंगायच", en: "Dangayach" },
  { hi: "धोंकरिया", en: "Dhonkaria" },
  { hi: "दुसाद", en: "Dusad" },
  { hi: "जसोरिया", en: "Jasoria" },
  { hi: "कायथवाल", en: "Kayathwal" },
  { hi: "खारवाल", en: "Kharwal" },
  { hi: "खटोरिया", en: "Khatoria" },
  { hi: "लाभी", en: "Labhi" },
  { hi: "महरवाल", en: "Maharwal" },
  { hi: "माली", en: "Mali" },
  { hi: "मामोडीया", en: "Mamodia" },
  { hi: "माठा", en: "Matha" },
  { hi: "नारायणवाल", en: "Narayanwal" },
  { hi: "नाटाणी", en: "Natani" },
  { hi: "पाबुवाल", en: "Pabuwal" },
  { hi: "परवा", en: "Parwa" },
  { hi: "सकुनिया", en: "Sakunia" },
  { hi: "सेठी", en: "Sethi" },
  { hi: "टटार", en: "Tatar" },
  { hi: "वैद", en: "Vaid" },

  // Mixed-community
  { hi: "अग्रवाल-गर्ग", en: "Agarwal-Garg" },
  { hi: "गोयनका अग्रवाल", en: "Goyanka Agarwal" },
  { hi: "मंगल (अग्रवाल)", en: "Mangal (Agarwal)" },
  { hi: "तोषनीवाल (महेश्वरी)", en: "Toshniwal (Maheshwari)" },
  { hi: "पंजाबी", en: "Punjabi" },
];

// ── COUNTRY CODES ───────────────────────────────────────────────────────────

export const COUNTRY_CODES: CountryCode[] = [
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+1", country: "USA", flag: "🇺🇸" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+974", country: "Qatar", flag: "🇶🇦" },
  { code: "+971", country: "UAE", flag: "🇦🇪" },
  { code: "+61", country: "Australia", flag: "🇦🇺" },
  { code: "+65", country: "Singapore", flag: "🇸🇬" },
  { code: "+64", country: "New Zealand", flag: "🇳🇿" },
  { code: "+1", country: "Canada", flag: "🇨🇦" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
];

// ── COUNTRIES ───────────────────────────────────────────────────────────────

export const COUNTRIES: BilingualOption[] = [
  { hi: "भारत", en: "India" },
  { hi: "अमेरिका", en: "USA" },
  { hi: "ब्रिटेन", en: "UK" },
  { hi: "कतर", en: "Qatar" },
  { hi: "संयुक्त अरब अमीरात", en: "UAE" },
  { hi: "ऑस्ट्रेलिया", en: "Australia" },
  { hi: "सिंगापुर", en: "Singapore" },
  { hi: "कनाडा", en: "Canada" },
  { hi: "जर्मनी", en: "Germany" },
  { hi: "न्यूज़ीलैंड", en: "New Zealand" },
];

// ── INDIA STATES (28 states + 8 UTs) ────────────────────────────────────────

export const INDIA_STATES: BilingualOption[] = [
  // States
  { hi: "आंध्र प्रदेश", en: "Andhra Pradesh" },
  { hi: "अरुणाचल प्रदेश", en: "Arunachal Pradesh" },
  { hi: "असम", en: "Assam" },
  { hi: "बिहार", en: "Bihar" },
  { hi: "छत्तीसगढ़", en: "Chhattisgarh" },
  { hi: "गोवा", en: "Goa" },
  { hi: "गुजरात", en: "Gujarat" },
  { hi: "हरियाणा", en: "Haryana" },
  { hi: "हिमाचल प्रदेश", en: "Himachal Pradesh" },
  { hi: "झारखंड", en: "Jharkhand" },
  { hi: "कर्नाटक", en: "Karnataka" },
  { hi: "केरल", en: "Kerala" },
  { hi: "मध्य प्रदेश", en: "Madhya Pradesh" },
  { hi: "महाराष्ट्र", en: "Maharashtra" },
  { hi: "मणिपुर", en: "Manipur" },
  { hi: "मेघालय", en: "Meghalaya" },
  { hi: "मिजोरम", en: "Mizoram" },
  { hi: "नागालैंड", en: "Nagaland" },
  { hi: "ओडिशा", en: "Odisha" },
  { hi: "पंजाब", en: "Punjab" },
  { hi: "राजस्थान", en: "Rajasthan" },
  { hi: "सिक्किम", en: "Sikkim" },
  { hi: "तमिलनाडु", en: "Tamil Nadu" },
  { hi: "तेलंगाना", en: "Telangana" },
  { hi: "त्रिपुरा", en: "Tripura" },
  { hi: "उत्तर प्रदेश", en: "Uttar Pradesh" },
  { hi: "उत्तराखंड", en: "Uttarakhand" },
  { hi: "पश्चिम बंगाल", en: "West Bengal" },
  // Union Territories
  { hi: "अंडमान और निकोबार द्वीपसमूह", en: "Andaman and Nicobar Islands" },
  { hi: "चंडीगढ़", en: "Chandigarh" },
  { hi: "दादरा और नगर हवेली और दमन और दीव", en: "Dadra and Nagar Haveli and Daman and Diu" },
  { hi: "दिल्ली", en: "Delhi" },
  { hi: "जम्मू और कश्मीर", en: "Jammu and Kashmir" },
  { hi: "लद्दाख", en: "Ladakh" },
  { hi: "लक्षद्वीप", en: "Lakshadweep" },
  { hi: "पुदुचेरी", en: "Puducherry" },
];

// ── INDIA CITIES (keyed by state en name) ───────────────────────────────────

export const INDIA_CITIES: Record<string, BilingualOption[]> = {
  Rajasthan: [
    { hi: "जयपुर", en: "Jaipur" },
    { hi: "अजमेर", en: "Ajmer" },
    { hi: "जोधपुर", en: "Jodhpur" },
    { hi: "उदयपुर", en: "Udaipur" },
    { hi: "कोटा", en: "Kota" },
    { hi: "बीकानेर", en: "Bikaner" },
    { hi: "अलवर", en: "Alwar" },
    { hi: "भीलवाड़ा", en: "Bhilwara" },
    { hi: "सीकर", en: "Sikar" },
    { hi: "झुंझुनू", en: "Jhunjhunu" },
    { hi: "नाथद्वारा", en: "Nathdwara" },
    { hi: "दौसा", en: "Dausa" },
    { hi: "चोमू", en: "Chomu" },
    { hi: "शाहपुरा", en: "Shahpura" },
    { hi: "गोविंदगढ़", en: "Govindgarh" },
  ],
  Maharashtra: [
    { hi: "मुंबई", en: "Mumbai" },
    { hi: "नवी मुंबई", en: "Navi Mumbai" },
    { hi: "ठाणे", en: "Thane" },
    { hi: "पुणे", en: "Pune" },
    { hi: "नागपुर", en: "Nagpur" },
    { hi: "अकोला", en: "Akola" },
    { hi: "लोनावला", en: "Lonavala" },
    { hi: "नासिक", en: "Nashik" },
  ],
  Delhi: [
    { hi: "नई दिल्ली", en: "New Delhi" },
    { hi: "दिल्ली", en: "Delhi" },
  ],
  Gujarat: [
    { hi: "अहमदाबाद", en: "Ahmedabad" },
    { hi: "सूरत", en: "Surat" },
    { hi: "वडोदरा", en: "Vadodara" },
    { hi: "राजकोट", en: "Rajkot" },
  ],
  Karnataka: [
    { hi: "बेंगलुरु", en: "Bengaluru" },
    { hi: "मैसूरु", en: "Mysuru" },
    { hi: "मंगलुरु", en: "Mangaluru" },
  ],
  "Madhya Pradesh": [
    { hi: "इंदौर", en: "Indore" },
    { hi: "भोपाल", en: "Bhopal" },
    { hi: "ग्वालियर", en: "Gwalior" },
    { hi: "जबलपुर", en: "Jabalpur" },
  ],
  "Uttar Pradesh": [
    { hi: "बरेली", en: "Bareilly" },
    { hi: "गाज़ियाबाद", en: "Ghaziabad" },
    { hi: "नोएडा", en: "Noida" },
    { hi: "लखनऊ", en: "Lucknow" },
    { hi: "कानपुर", en: "Kanpur" },
  ],
  "West Bengal": [
    { hi: "कोलकाता", en: "Kolkata" },
  ],
  "Andhra Pradesh": [
    { hi: "हैदराबाद", en: "Hyderabad" },
    { hi: "विशाखापत्तनम", en: "Visakhapatnam" },
    { hi: "विजयवाड़ा", en: "Vijayawada" },
    { hi: "तिरुपति", en: "Tirupati" },
  ],
  "Arunachal Pradesh": [
    { hi: "ईटानगर", en: "Itanagar" },
  ],
  Assam: [
    { hi: "गुवाहाटी", en: "Guwahati" },
    { hi: "डिब्रूगढ़", en: "Dibrugarh" },
  ],
  Bihar: [
    { hi: "पटना", en: "Patna" },
    { hi: "गया", en: "Gaya" },
    { hi: "मुज़फ्फरपुर", en: "Muzaffarpur" },
  ],
  Chhattisgarh: [
    { hi: "रायपुर", en: "Raipur" },
    { hi: "बिलासपुर", en: "Bilaspur" },
  ],
  Goa: [
    { hi: "पणजी", en: "Panaji" },
    { hi: "मडगांव", en: "Margao" },
  ],
  Haryana: [
    { hi: "गुरुग्राम", en: "Gurugram" },
    { hi: "फरीदाबाद", en: "Faridabad" },
    { hi: "पानीपत", en: "Panipat" },
    { hi: "अंबाला", en: "Ambala" },
    { hi: "करनाल", en: "Karnal" },
  ],
  "Himachal Pradesh": [
    { hi: "शिमला", en: "Shimla" },
    { hi: "मनाली", en: "Manali" },
    { hi: "धर्मशाला", en: "Dharamshala" },
  ],
  Jharkhand: [
    { hi: "रांची", en: "Ranchi" },
    { hi: "जमशेदपुर", en: "Jamshedpur" },
    { hi: "धनबाद", en: "Dhanbad" },
  ],
  Kerala: [
    { hi: "तिरुवनंतपुरम", en: "Thiruvananthapuram" },
    { hi: "कोच्चि", en: "Kochi" },
    { hi: "कोझीकोड", en: "Kozhikode" },
  ],
  Manipur: [
    { hi: "इंफाल", en: "Imphal" },
  ],
  Meghalaya: [
    { hi: "शिलांग", en: "Shillong" },
  ],
  Mizoram: [
    { hi: "आइजोल", en: "Aizawl" },
  ],
  Nagaland: [
    { hi: "कोहिमा", en: "Kohima" },
    { hi: "दीमापुर", en: "Dimapur" },
  ],
  Odisha: [
    { hi: "भुवनेश्वर", en: "Bhubaneswar" },
    { hi: "कटक", en: "Cuttack" },
    { hi: "पुरी", en: "Puri" },
  ],
  Punjab: [
    { hi: "लुधियाना", en: "Ludhiana" },
    { hi: "अमृतसर", en: "Amritsar" },
    { hi: "जालंधर", en: "Jalandhar" },
    { hi: "पटियाला", en: "Patiala" },
  ],
  Sikkim: [
    { hi: "गंगटोक", en: "Gangtok" },
  ],
  "Tamil Nadu": [
    { hi: "चेन्नई", en: "Chennai" },
    { hi: "कोयंबटूर", en: "Coimbatore" },
    { hi: "मदुरई", en: "Madurai" },
    { hi: "तिरुचिरापल्ली", en: "Tiruchirappalli" },
    { hi: "सेलम", en: "Salem" },
  ],
  Telangana: [
    { hi: "हैदराबाद", en: "Hyderabad" },
    { hi: "वारंगल", en: "Warangal" },
    { hi: "निजामाबाद", en: "Nizamabad" },
  ],
  Tripura: [
    { hi: "अगरतला", en: "Agartala" },
  ],
  Uttarakhand: [
    { hi: "देहरादून", en: "Dehradun" },
    { hi: "हरिद्वार", en: "Haridwar" },
    { hi: "ऋषिकेश", en: "Rishikesh" },
  ],
  "Andaman and Nicobar Islands": [
    { hi: "पोर्ट ब्लेयर", en: "Port Blair" },
  ],
  Chandigarh: [
    { hi: "चंडीगढ़", en: "Chandigarh" },
  ],
  "Dadra and Nagar Haveli and Daman and Diu": [
    { hi: "सिलवासा", en: "Silvassa" },
    { hi: "दमन", en: "Daman" },
  ],
  "Jammu and Kashmir": [
    { hi: "श्रीनगर", en: "Srinagar" },
    { hi: "जम्मू", en: "Jammu" },
  ],
  Ladakh: [
    { hi: "लेह", en: "Leh" },
  ],
  Lakshadweep: [
    { hi: "कवरत्ती", en: "Kavaratti" },
  ],
  Puducherry: [
    { hi: "पुदुचेरी", en: "Puducherry" },
  ],
};
