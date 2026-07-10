// Builds ADM2 (district) geometry + risk data for the zoom-reveal detail level.
// For each country:
//  1. reads the mapshaper-simplified ADM2 from geo-adm2/<C>.simpl.json
//  2. rewinds rings clockwise (d3-geo spherical convention — see fix-winding.mjs)
//  3. assigns each district a parent ADM1 region via planar point-in-polygon
//  4. emits src/data/districts/<country>.adm2.json  (geometry, props: id/name/parent)
//     and  src/data/mock/<country>-risk-adm2.json    (one RiskRegion per district)
//
// Run: node scripts/build-districts.mjs   (requires geo-adm2/<C>.simpl.json present)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import rewind from "@mapbox/geojson-rewind";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const adm2Dir = path.join(root, "geo-adm2");
const adm1Dir = path.join(root, "src/data/countries");
const distDir = path.join(root, "src/data/districts");
const mockDir = path.join(root, "src/data/mock");
fs.mkdirSync(distDir, { recursive: true });

const COUNTRIES = [
  { code: "pakistan", src: "PAK" },
  { code: "india", src: "IND" },
  { code: "kenya", src: "KEN" },
];
const LANG = { pakistan: "ur", india: "hi", kenya: "sw" };
const RISK_TYPES = ["drought", "flood", "fire", "soil-degradation"];

const ADVISORY = {
  ur: {
    drought: "خشک سالی کی وارننگ: پانی کا ذخیرہ کریں، فصلوں کی آبپاشی محدود کریں اور مویشیوں کے لیے پانی محفوظ رکھیں۔",
    flood: "سیلاب کا خطرہ: نشیبی علاقوں سے دور رہیں اور ہنگامی سامان تیار رکھیں۔",
    fire: "آگ کا خطرہ: کھلی آگ سے گریز کریں اور خشک گھاس کے قریب احتیاط کریں۔",
    "soil-degradation": "زمینی کٹاؤ: زمین کی زرخیزی بحال کرنے کے لیے درخت لگائیں اور فصل کی گردش اپنائیں۔",
  },
  hi: {
    drought: "सूखे की चेतावनी: पानी का संचय करें, सिंचाई सीमित करें और पशुओं के लिए जल सुरक्षित रखें।",
    flood: "बाढ़ का खतरा: निचले इलाकों से दूर रहें और आपातकालीन सामग्री तैयार रखें।",
    fire: "आग का खतरा: खुली आग से बचें और सूखी घास के पास सावधानी बरतें।",
    "soil-degradation": "मृदा क्षरण: भूमि की उर्वरता बहाल करने हेतु वृक्षारोपण करें और फसल चक्र अपनाएँ।",
  },
  sw: {
    drought: "Onyo la ukame: Hifadhi maji, punguza umwagiliaji na weka akiba ya maji kwa mifugo.",
    flood: "Hatari ya mafuriko: Epuka maeneo ya chini na andaa vifaa vya dharura.",
    fire: "Hatari ya moto: Epuka moto wazi na kuwa mwangalifu karibu na nyasi kavu.",
    "soil-degradation": "Uharibifu wa udongo: Panda miti na tumia mzunguko wa mazao kurudisha rutuba ya ardhi.",
  },
};

function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function bandName(sev, alert) {
  if (alert || sev >= 75) return "critical";
  if (sev >= 50) return "warning";
  if (sev >= 25) return "watch";
  return "normal";
}

function summaryFor(name, parentName, riskType, band) {
  const scope = `${name} district${parentName ? `, ${parentName}` : ""}`;
  const t = {
    drought: {
      normal: `${scope} has adequate soil moisture this cycle.`,
      watch: `Rainfall in ${scope} is trailing the seasonal norm — early water-stress watch.`,
      warning: `A prolonged dry spell is stressing rain-fed crops across ${scope}.`,
      critical: `Severe local drought in ${scope}: acute water shortage and crop failure reported.`,
    },
    flood: {
      normal: `Watercourses across ${scope} sit within their normal channel.`,
      watch: `Rising upstream gauges put low-lying parts of ${scope} on a flood watch.`,
      warning: `Rivers near ${scope} are close to bank-full; localized inundation is likely.`,
      critical: `Major local flooding in ${scope}: inundation displacing households and cutting access.`,
    },
    fire: {
      normal: `Fuel moisture across ${scope} is healthy; fire potential is low.`,
      watch: `Dry vegetation puts ${scope} on an elevated fire watch.`,
      warning: `Hot, dry, windy conditions raise fast-spreading fire risk in ${scope}.`,
      critical: `Extreme local fire danger in ${scope}: active thermal anomalies detected.`,
    },
    "soil-degradation": {
      normal: `Soil structure and cover across ${scope} remain stable.`,
      watch: `Early erosion and declining organic matter are appearing in ${scope}.`,
      warning: `Land degradation is reducing arable capacity across ${scope}.`,
      critical: `Severe local soil degradation in ${scope}: widespread erosion of productive land.`,
    },
  };
  return t[riskType][band];
}

// --- winding-agnostic planar point-in-polygon over a GeoJSON geometry ---
function pointInRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const hit =
      yi > pt[1] !== yj > pt[1] &&
      pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}
function geomContains(geom, pt) {
  const polys =
    geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  for (const poly of polys) {
    if (poly.length && pointInRing(pt, poly[0])) return true; // exterior ring
  }
  return false;
}
// Rough representative point: average of the first exterior ring's vertices.
function repPoint(geom) {
  const ring =
    geom.type === "Polygon"
      ? geom.coordinates[0]
      : geom.coordinates.sort((a, b) => b[0].length - a[0].length)[0][0];
  let x = 0, y = 0;
  for (const c of ring) {
    x += c[0];
    y += c[1];
  }
  return [x / ring.length, y / ring.length];
}
function centroidOf(geom) {
  return repPoint(geom);
}
function dist2(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}

for (const { code, src } of COUNTRIES) {
  const adm2 = rewind(
    JSON.parse(fs.readFileSync(path.join(adm2Dir, `${src}.simpl.json`), "utf8")),
    true
  );
  const adm1 = JSON.parse(
    fs.readFileSync(path.join(adm1Dir, `${code}.geo.json`), "utf8")
  );
  const parentRisk = JSON.parse(
    fs.readFileSync(path.join(mockDir, `${code}-risk.json`), "utf8")
  );
  const parentRiskById = Object.fromEntries(parentRisk.map((r) => [r.id, r]));
  const adm1Centroids = adm1.features.map((f) => ({
    id: f.properties.id,
    name: f.properties.name,
    c: centroidOf(f.geometry),
  }));
  const lang = LANG[code];

  // Assign parent to each district.
  for (const f of adm2.features) {
    const pt = repPoint(f.geometry);
    let parent = adm1.features.find((p) => geomContains(p.geometry, pt));
    if (!parent) {
      // Fallback: nearest ADM1 centroid.
      let best = null, bestD = Infinity;
      for (const p of adm1Centroids) {
        const d = dist2(pt, p.c);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      f.properties.parent = best?.id ?? "";
      f.properties.parentName = best?.name ?? "";
    } else {
      f.properties.parent = parent.properties.id;
      f.properties.parentName = parent.properties.name;
    }
  }

  // Write geometry.
  fs.writeFileSync(
    path.join(distDir, `${code}.adm2.json`),
    JSON.stringify(adm2)
  );

  // Generate district risk (biased toward the parent province's risk type).
  const records = adm2.features.map((f) => {
    const id = f.properties.id;
    const parentId = f.properties.parent;
    const parentName = f.properties.parentName;
    const pr = parentRiskById[parentId];
    const r = hash01(id);
    const riskType =
      pr && hash01(id + "b") < 0.6
        ? pr.riskType
        : RISK_TYPES[Math.floor(hash01(id + "t") * RISK_TYPES.length)];
    // Bias district severity around the parent's, with local spread.
    const base = pr ? pr.severity : 35;
    let severity = Math.round(
      Math.max(0, Math.min(96, base - 20 + r * 45))
    );
    const activeAlert = pr?.activeAlert === true && hash01(id + "a") < 0.25;
    if (activeAlert) severity = Math.max(severity, 80);
    const band = bandName(severity, activeAlert);
    return {
      id,
      regionName: f.properties.name,
      country: code,
      riskType,
      severity,
      activeAlert,
      lastUpdated: "2026-07-05T09:00:00Z",
      summary: summaryFor(f.properties.name, parentName, riskType, band),
      advisoryScript: ADVISORY[lang][riskType],
      advisoryLanguage: lang,
      relatedRegionIds: [],
      adminLevel: 2,
      parentId,
      parentName,
    };
  });

  // relatedRegionIds = up to 4 sibling districts (same parent) sharing risk type.
  const byParent = {};
  for (const rec of records) (byParent[rec.parentId] ??= []).push(rec);
  for (const rec of records) {
    rec.relatedRegionIds = (byParent[rec.parentId] || [])
      .filter((o) => o.id !== rec.id && o.riskType === rec.riskType)
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 4)
      .map((o) => o.id);
  }

  fs.writeFileSync(
    path.join(mockDir, `${code}-risk-adm2.json`),
    JSON.stringify(records)
  );
  console.log(
    `${code}: ${records.length} districts -> districts/${code}.adm2.json + mock/${code}-risk-adm2.json`
  );
}
