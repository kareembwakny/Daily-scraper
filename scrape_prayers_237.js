// scrape_prayers_237.js
import fs from "fs";
import { execSync } from "child_process";

const SHOBIDDAK_URL = "https://www.shobiddak.com/prayers/prayer_today?town_id=237";

// Fallback (JSON API) – very reliable
// Docs: https://aladhan.com/prayer-times-api  (timingsByCity)
const ALADHAN_URL =
  "https://api.aladhan.com/v1/timingsByCity?city=Baqa%20al%20Gharbiyye&country=Israel&method=3";

function curlGet(url) {
  const cmd =
    `curl -L --compressed --fail ` +
    `-H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" ` +
    `-H "Accept-Language: ar,en;q=0.8" ` +
    `"${url}"`;
  return execSync(cmd, { encoding: "utf8" });
}

function parseTimesFromHtml(html) {
  const mapping = {};
  // Accept both Arabic comma ، and normal ,
  const re = /(الفجر|الشروق|الظهر|العصر|المغرب|العشاء)\s*[,،]\s*([0-2]?\d:[0-5]\d)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    mapping[m[1]] = m[2];
  }
  return mapping;
}

function buildOutput({ cityAr, source, times }) {
  const out = {
    generatedAt: new Date().toISOString(),
    source,
    town_id: 237,
    city_ar: cityAr,
    times_ar: {
      "الفجر": times["الفجر"],
      "الشروق": times["الشروق"] ?? null,
      "الظهر": times["الظهر"],
      "العصر": times["العصر"],
      "المغرب": times["المغرب"],
      "العشاء": times["العشاء"],
    },
  };

  // Validate required
  const req = ["الفجر", "الظهر", "العصر", "المغرب", "العشاء"];
  const missing = req.filter((k) => !out.times_ar[k]);
  if (missing.length) throw new Error("Missing times: " + missing.join(", "));

  return out;
}

function main() {
  let out = null;

  // 1) Try Shobiddak (may fail due to 403 / bot protection)
  try {
    const html = curlGet(SHOBIDDAK_URL);
    const times = parseTimesFromHtml(html);

    // If parsing succeeded, use it
    out = buildOutput({
      cityAr: "باقة الغربية",
      source: "shobiddak.com",
      times,
    });

    console.log("✅ Using Shobiddak data.");
  } catch (e) {
    console.log("⚠️ Shobiddak fetch/parse failed, falling back to AlAdhan.");
    console.log(String(e).slice(0, 200));
  }

  // 2) Fallback: AlAdhan JSON API (reliable)
  if (!out) {
    const txt = curlGet(ALADHAN_URL);
    const j = JSON.parse(txt);

    // AlAdhan fields: Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha
    const t = j?.data?.timings;
    if (!t) throw new Error("AlAdhan response missing timings");

    const times = {
      "الفجر": (t.Fajr || "").slice(0, 5),
      "الشروق": (t.Sunrise || "").slice(0, 5),
      "الظهر": (t.Dhuhr || "").slice(0, 5),
      "العصر": (t.Asr || "").slice(0, 5),
      "المغرب": (t.Maghrib || "").slice(0, 5),
      "العشاء": (t.Isha || "").slice(0, 5),
    };

    out = buildOutput({
      cityAr: "باقة الغربية",
      source: "aladhan.com",
      times,
    });

    console.log("✅ Using AlAdhan fallback data.");
  }

  fs.writeFileSync("prayers_237.json", JSON.stringify(out, null, 2));
  console.log("Wrote prayers_237.json");
}

main();
