// scrape_prayers_237.js
import fs from "fs";

const URL = "https://www.shobiddak.com/prayers/prayer_today?town_id=237";

// Use fetch via node (works sometimes) OR curl fallback.
// We'll do curl fallback using child_process for best reliability.
import { execSync } from "child_process";

function fetchHtml() {
  const cmd =
    `curl -L --compressed ` +
    `-H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" ` +
    `-H "Accept-Language: ar,en;q=0.8" ` +
    `"${URL}"`;
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function parseTimes(html) {
  // Extract الصلاة, الوقت pairs from the HTML text.
  // Example patterns: "الفجر, 04:50" etc.
  const mapping = {};
  const re = /(الفجر|الشروق|الظهر|العصر|المغرب|العشاء)\s*[,،]\s*([0-2]?\d:[0-5]\d)/g;

  let m;
  while ((m = re.exec(html)) !== null) {
    mapping[m[1]] = m[2];
  }
  return mapping;
}

function parseCity(html) {
  // Try to find "أوقات الصلاة في <city>"
  const m = html.match(/أوقات الصلاة في\s*([^<\n\r]+?)\s*(?:مواقيت|<\/title>|<)/);
  if (!m) return "باقة الغربية";
  return m[1].trim();
}

function parseDate(html) {
  // Example: "الخميس 26-2" in snippet/title sometimes.
  const m = html.match(/(الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت)\s+([0-3]?\d-[0-1]?\d)/);
  return m ? `${m[1]} ${m[2]}` : null;
}

function main() {
  const html = fetchHtml();

  const city = parseCity(html);
  const dateStr = parseDate(html);
  const times = parseTimes(html);

  // Require main prayers:
  const required = ["الفجر", "الظهر", "العصر", "المغرب", "العشاء"];
  const missing = required.filter((k) => !times[k]);
  if (missing.length) {
    throw new Error("Missing times: " + missing.join(", "));
  }

  const out = {
    generatedAt: new Date().toISOString(),
    source: "shobiddak.com",
    town_id: 237,
    city_ar: city || "باقة الغربية",
    date_ar: dateStr,
    times_ar: {
      "الفجر": times["الفجر"],
      "الشروق": times["الشروق"] || null,
      "الظهر": times["الظهر"],
      "العصر": times["العصر"],
      "المغرب": times["المغرب"],
      "العشاء": times["العشاء"]
    }
  };

  fs.writeFileSync("prayers_237.json", JSON.stringify(out, null, 2));
  console.log("Wrote prayers_237.json for:", out.city_ar);
}

main();
