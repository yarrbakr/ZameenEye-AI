// Build-time generator for mock-but-realistic risk data.
// Reads the simplified GeoJSON per country and emits src/data/mock/<country>-risk.json
// covering EVERY region (so the whole map is colored), with hand-curated narratives
// for featured/high-signal regions and deterministic plausible data for the rest.
//
// Run: node scripts/gen-risk.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const geoDir = path.join(root, "src/data/countries");
const outDir = path.join(root, "src/data/mock");

// Deterministic hash -> [0,1) so severities are reproducible across builds.
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

const RISK_TYPES = ["drought", "flood", "fire", "soil-degradation"];

const LANG = { pakistan: "ur", india: "hi", kenya: "sw" };

// Localized advisory samples (stand-ins for TTS output) per risk type + language.
const ADVISORY = {
  ur: {
    drought:
      "خشک سالی کی وارننگ: پانی کا ذخیرہ کریں، فصلوں کی آبپاشی محدود کریں اور مویشیوں کے لیے پانی محفوظ رکھیں۔",
    flood: "سیلاب کا خطرہ: نشیبی علاقوں سے دور رہیں اور ہنگامی سامان تیار رکھیں۔",
    fire: "آگ کا خطرہ: کھلی آگ سے گریز کریں اور خشک گھاس کے قریب احتیاط کریں۔",
    "soil-degradation":
      "زمینی کٹاؤ: زمین کی زرخیزی بحال کرنے کے لیے درخت لگائیں اور فصل کی گردش اپنائیں۔",
  },
  hi: {
    drought:
      "सूखे की चेतावनी: पानी का संचय करें, सिंचाई सीमित करें और पशुओं के लिए जल सुरक्षित रखें।",
    flood: "बाढ़ का खतरा: निचले इलाकों से दूर रहें और आपातकालीन सामग्री तैयार रखें।",
    fire: "आग का खतरा: खुली आग से बचें और सूखी घास के पास सावधानी बरतें।",
    "soil-degradation":
      "मृदा क्षरण: भूमि की उर्वरता बहाल करने हेतु वृक्षारोपण करें और फसल चक्र अपनाएँ।",
  },
  sw: {
    drought:
      "Onyo la ukame: Hifadhi maji, punguza umwagiliaji na weka akiba ya maji kwa mifugo.",
    flood: "Hatari ya mafuriko: Epuka maeneo ya chini na andaa vifaa vya dharura.",
    fire: "Hatari ya moto: Epuka moto wazi na kuwa mwangalifu karibu na nyasi kavu.",
    "soil-degradation":
      "Uharibifu wa udongo: Panda miti na tumia mzunguko wa mazao kurudisha rutuba ya ardhi.",
  },
};

// Templated summaries keyed by risk type + band, region name interpolated.
function summaryFor(name, riskType, band) {
  const t = {
    drought: {
      normal: `${name} has adequate soil moisture this cycle; reservoirs are near seasonal average.`,
      watch: `Rainfall in ${name} is trailing the seasonal norm — early-warning watch for pasture and water stress.`,
      warning: `Prolonged dry spell across ${name} is drawing down reservoirs and stressing rain-fed crops.`,
      critical: `Severe drought in ${name}: acute water shortage, failed planting season and livestock losses reported.`,
    },
    flood: {
      normal: `River levels across ${name} sit within their normal channel; no flood signal.`,
      watch: `Upstream rainfall is raising river gauges in ${name}; low-lying wards under a flood watch.`,
      warning: `Rivers in ${name} are near bank-full; localized inundation of farmland and roads is likely.`,
      critical: `Major flooding in ${name}: riverine and flash flooding displacing communities and cutting road access.`,
    },
    fire: {
      normal: `Fuel moisture across ${name} is healthy; wildfire potential is low.`,
      watch: `Dry vegetation and rising temperatures put ${name} on an elevated fire watch.`,
      warning: `Hot, dry, windy conditions across ${name} raise the risk of fast-spreading vegetation fires.`,
      critical: `Extreme fire danger in ${name}: active thermal anomalies detected; open burning strongly discouraged.`,
    },
    "soil-degradation": {
      normal: `Soil structure and vegetative cover across ${name} remain stable.`,
      watch: `Early signs of erosion and declining organic matter are appearing in parts of ${name}.`,
      warning: `Land degradation in ${name} is reducing arable capacity through erosion and salinity.`,
      critical: `Severe soil degradation in ${name}: widespread erosion and loss of productive land.`,
    },
  };
  return t[riskType][band];
}

function bandName(severity, activeAlert) {
  if (activeAlert || severity >= 75) return "critical";
  if (severity >= 50) return "warning";
  if (severity >= 25) return "watch";
  return "normal";
}

// Curated overrides: featured regions with realistic risk profiles per country.
// Each: [riskType, severity, activeAlert]
const CURATED = {
  pakistan: {
    "PK-SD": ["flood", 88, true], // Sindh — 2022-style riverine flooding
    "PK-BA": ["drought", 79, true], // Balochistan — chronic drought
    "PK-PB": ["flood", 64, false], // Punjab — Indus flooding
    "PK-KP": ["flood", 71, false], // KP — GLOF / flash floods
    "PK-GB": ["flood", 58, false], // Gilgit-Baltistan — glacial
    "PK-JK": ["soil-degradation", 41, false],
    "PK-IS": ["fire", 22, false],
  },
  india: {
    "IN-AS": ["flood", 90, true], // Assam — Brahmaputra floods
    "IN-BR": ["flood", 76, true], // Bihar — Kosi floods
    "IN-RJ": ["drought", 81, true], // Rajasthan — arid drought
    "IN-MH": ["drought", 68, false], // Maharashtra — Marathwada drought
    "IN-KL": ["flood", 62, false], // Kerala — monsoon floods
    "IN-UT": ["fire", 71, false], // Uttarakhand — forest fires
    "IN-OR": ["flood", 55, false], // Odisha — cyclone/flood
    "IN-MP": ["drought", 47, false],
    "IN-TN": ["drought", 38, false],
    "IN-PB": ["soil-degradation", 44, false], // Punjab — salinity
    "IN-KA": ["drought", 52, false],
    "IN-GJ": ["drought", 33, false],
  },
  kenya: {
    "KE-43": ["drought", 92, true], // Turkana — ASAL drought
    "KE-25": ["drought", 83, true], // Marsabit
    "KE-24": ["drought", 78, true], // Mandera
    "KE-46": ["drought", 74, false], // Wajir
    "KE-07": ["drought", 69, false], // Garissa
    "KE-40": ["flood", 66, false], // Tana River — flooding
    "KE-01": ["flood", 57, false], // Baringo — rising lakes
    "KE-33": ["fire", 48, false], // Narok — Mara grassland fires
    "KE-18": ["drought", 45, false], // Kitui
    "KE-14": ["flood", 36, false], // Kilifi
    "KE-30": ["soil-degradation", 28, false], // Nairobi
    "KE-31": ["soil-degradation", 31, false], // Nakuru
  },
};

function build(country) {
  const geo = JSON.parse(
    fs.readFileSync(path.join(geoDir, `${country}.geo.json`), "utf8")
  );
  const lang = LANG[country];
  const curated = CURATED[country] || {};

  const features = geo.features.map((f) => ({
    id: f.properties.id,
    name: f.properties.name,
  }));

  const records = features.map(({ id, name }) => {
    let riskType, severity, activeAlert;
    if (curated[id]) {
      [riskType, severity, activeAlert] = curated[id];
    } else {
      const r = hash01(id);
      riskType = RISK_TYPES[Math.floor(hash01(id + "t") * RISK_TYPES.length)];
      severity = Math.floor(r * 70); // uncurated regions cap below auto-critical
      activeAlert = false;
    }
    const band = bandName(severity, activeAlert);
    return {
      id,
      regionName: name,
      country,
      riskType,
      severity,
      activeAlert,
      lastUpdated: "2026-07-05T09:00:00Z",
      summary: summaryFor(name, riskType, band),
      advisoryScript: ADVISORY[lang][riskType],
      advisoryLanguage: lang,
      relatedRegionIds: [], // filled below
    };
  });

  // relatedRegionIds = up to 4 other regions sharing the same active riskType.
  for (const rec of records) {
    rec.relatedRegionIds = records
      .filter((o) => o.id !== rec.id && o.riskType === rec.riskType)
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 4)
      .map((o) => o.id);
  }

  const outPath = path.join(outDir, `${country}-risk.json`);
  fs.writeFileSync(outPath, JSON.stringify(records, null, 2));
  const alerts = records.filter((r) => r.activeAlert).length;
  console.log(
    `${country}: ${records.length} regions, ${alerts} active alerts -> ${path.relative(root, outPath)}`
  );
}

for (const c of ["pakistan", "india", "kenya"]) build(c);
