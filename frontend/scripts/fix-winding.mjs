// d3-geo (spherical geoMercator) renders the COMPLEMENT of a polygon when ring
// winding is wrong — a country fills the whole viewport. geoBoundaries data has
// inconsistent winding, so we rewind every geometry to the right-hand rule
// (RFC 7946), which d3-geo renders correctly. Runs in-place on the simplified files.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import rewind from "@mapbox/geojson-rewind";
import { geoPath, geoMercator } from "d3-geo";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const geoDir = path.resolve(__dirname, "../src/data/countries");

function areaFor(fc) {
  const proj = geoMercator().fitSize([800, 600], fc);
  const gp = geoPath(proj);
  // Sum absolute projected area of all features; a winding bug inflates this to
  // ~viewport area * feature count (each fills the whole screen).
  return fc.features.reduce((s, f) => s + Math.abs(gp.area(f)), 0);
}

for (const file of ["pakistan", "india", "kenya"]) {
  const p = path.join(geoDir, `${file}.geo.json`);
  const fc = JSON.parse(fs.readFileSync(p, "utf8"));
  const before = areaFor(fc);
  // d3-geo's spherical geoMercator renders correctly with CLOCKWISE exterior rings
  // (verified empirically: CW projects the true country area, CCW fills the
  // complement / whole viewport). So rewind clockwise=true.
  const fixed = rewind(JSON.parse(JSON.stringify(fc)), true);
  const after = areaFor(fixed);
  fs.writeFileSync(p, JSON.stringify(fixed));
  console.log(
    `${file}: projected-area ${Math.round(before)} -> ${Math.round(after)} (viewport ~480000)`
  );
}
