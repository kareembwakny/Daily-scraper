// scrape_shobiddak_237.js
import fs from "fs";
import { chromium } from "playwright";

const URL = "https://www.shobiddak.com/prayers/prayer_today?town_id=237";

function cleanTime(s) {
  if (!s) return null;
  const m = s.match(/([0-2]?\d):([0-5]\d)/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function normalizeArabKey(k) {
  return (k || "").replace(/\s+/g, " ").trim();
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const context = await browser.newContext({
    locale: "ar",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  // Sometimes there is an ad/vignette overlay; try to close common patterns.
  const closeSelectors = [
    'button[aria-label="Close"]',
    'button[aria-label="إغلاق"]',
    'text=إغلاق',
    'text=Close',
    'text=×',
    '.close',
    '#close',
  ];

  for (const sel of closeSelectors) {
    try {
      const loc = page.locator(sel).first();
      if (await loc.count()) {
        await loc.click({ timeout: 1500 }).catch(() => {});
      }
    } catch {}
  }

  // Grab rendered text from the page.
  const bodyText = await page.locator("body").innerText();

  // Extract city
  let city = "باقة الغربية";
  const cityMatch =
    bodyText.match(/أوقات الصلاة في\s*([^\n\r]+?)\s*(?:اليوم|غداً|مواقيت|$)/) ||
    bodyText.match(/مواقيت الصلاة في\s*([^\n\r]+?)\s*(?:اليوم|غداً|$)/);
  if (cityMatch && cityMatch[1]) city = cityMatch[1].trim();

  // Extract the 6 items (الفجر/الشروق/الظهر/العصر/المغرب/العشاء)
  // We parse from rendered text (more robust than depending on HTML structure).
  const keys = ["الفجر", "الشروق", "الظهر", "العصر", "المغرب", "العشاء"];
  const times = {};

  for (const k of keys) {
    // Match patterns like: "الفجر 05:12" or "الفجر : 05:12"
    const re = new RegExp(`${k}\\s*[:：]?\\s*([0-2]?\\d:[0-5]\\d)`, "m");
    const m = bodyText.match(re);
    if (m && m[1]) times[k] = cleanTime(m[1]);
  }

  await browser.close();

  // Validate required (at minimum: 5 prayers; shروق optional sometimes)
  const required = ["الفجر", "الظهر", "العصر", "المغرب", "العشاء"];
  const missing = required.filter((k) => !times[k]);

  if (missing.length) {
    // Save debug snapshot to inspect if parsing failed
    fs.writeFileSync("debug_body.txt", bodyText);
    throw new Error(
      `Failed to parse required prayers: ${missing.join(
        ", "
      )}. Saved debug_body.txt`
    );
  }

  const out = {
    generatedAt: new Date().toISOString(),
    source: "shobiddak.com",
    town_id: 237,
    city_ar: normalizeArabKey(city),
    times_ar: {
      "الفجر": times["الفجر"],
      "الشروق": times["الشروق"] || null,
      "الظهر": times["الظهر"],
      "العصر": times["العصر"],
      "المغرب": times["المغرب"],
      "العشاء": times["العشاء"],
    },
    url: URL,
  };

  fs.writeFileSync("prayers_237.json", JSON.stringify(out, null, 2));
  console.log("✅ Wrote prayers_237.json:", out.city_ar, out.times_ar);
}

main().catch((e) => {
  console.error("❌ Scrape failed:", e?.message || e);
  process.exit(1);
});
