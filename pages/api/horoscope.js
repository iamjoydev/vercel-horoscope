import { DateTime } from "luxon";
import * as Astronomy from "astronomy-engine";

export const runtime = "nodejs"; // ensure compatibility on Vercel

// Bengali Zodiac signs
const SIGNS = [
  "মেষ","বৃষ","মিথুন","কর্কট","সিংহ","কন্যা",
  "তুলা","বৃশ্চিক","ধনু","মকর","কুম্ভ","মীন"
];

// Phrase templates
const TEMPLATES = {
  lead: [
    "আজ আপনার সৃজনশীল শক্তি জাগ্রত হবে। নতুন আইডিয়াকে প্রশংসা করা হতে পারে।",
    "আজ ধৈর্য ও বিচক্ষণতা কাজে দেবে—একটি বড় সিদ্ধান্ত আসতে পারে।",
    "আজ আপনার মন কর্মে একাগ্র থাকবে; নতুন পরিকল্পনা সফল মিলবে।",
    "আজ সম্পর্কের চেষ্টায় বিশেষ ফলদায়ক হতে পারে।",
    "আত্মবিশ্লেষণ ও শ্রদ্ধা আজ বিশেষ ফল দেবে।"
  ],
  health: [
    "গলা ও শ্বাসনালার যত্নে স্বাস্থ্য ভালো থাকবে।",
    "হজম বা পেটের সমস্যা এড়াতে খাবার খান পরিমিতভাবে।",
    "চোখ ও মাথাব্যথা এড়াতে পর্যাপ্ত বিশ্রাম নিন।",
    "হাঁটা বা যোগব্যায়াম আপনাকে সতেজ রাখবে।",
    "পর্যাপ্ত পানি পান করুন ও শরীরচর্চা বজায় রাখুন।"
  ],
  advice: [
    "নিজের সময় দিন, বিশ্রামও প্রয়োজনীয়।",
    "নতুন আইডিয়াকে নোট করে রাখুন, কাজে লাগবে।",
    "পরিবারের সঙ্গে সময় কাটান।",
    "ভালো সিদ্ধান্ত নিতে তাড়াহুড়ো করবেন না।",
    "সততা ও মনোযোগ আজ সফলতার চাবিকাঠি।"
  ]
};

const NAKSHATRA_DESC = {
  "অশ্বিনী": "শুরু করার শক্তি ও তেজ বৃদ্ধি পাবে।",
  "ভরণী": "সৃজনশীল কাজে সাফল্য আসতে পারে।",
  "কৃত্তিকা": "অস্থিরতা এড়িয়ে স্থির মনোযোগ রাখুন।",
  "রোহিণী": "সম্পর্ক ও প্রেমে শান্তি বজায় রাখুন।",
  "মৃগশিরা": "উৎসাহে দিনটি ভরপুর থাকবে।",
  "আর্দ্রা": "অভ্যন্তরীণ শান্তির সন্ধান পাবেন।",
  "পুনর্বসু": "ভালো কাজের ফল পাবেন।",
  "পুষ্যা": "সম্মান ও স্বীকৃতি আসবে।",
  "অশ্লেষা": "গোপন বিষয়ে আজ সতর্ক থাকুন।",
  "মঘা": "নেতৃত্বের ক্ষমতা প্রকাশ পাবে।"
};

// Deterministic RNG (so same sign/date gives same result)
function seededRandom(seedStr) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619) >>> 0;
  }
  return () => {
    h += 0x6D2B79F5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Fetch geolocation info
async function fetchGeo(ip) {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { cache: "no-store" });
    if (!res.ok) throw new Error("Geo lookup failed");
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function GET(req) {
  try {
    // Get IP (Vercel adds x-forwarded-for)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "8.8.8.8";

    // Get geolocation
    const geo = await fetchGeo(ip) || {};
    const lat = geo.latitude || 22.5726;
    const lon = geo.longitude || 88.3639;
    const city = geo.city || "Kolkata";
    const region = geo.region || "West Bengal";
    const country = geo.country_name || "India";
    const tz = geo.timezone || "Asia/Kolkata";

    // Local date/time
    const now = DateTime.now().setZone(tz);
    const isoDate = now.toISODate();
    const displayDate = now.toFormat("dd/MM/yyyy");

    // Astronomy: Sun and Moon longitudes
    const sun = Astronomy.EclipticLongitude("Sun", now.toJSDate());
    const moon = Astronomy.EclipticLongitude("Moon", now.toJSDate());

    const tithi = Math.floor(((moon - sun + 360) % 360) / 12) + 1;
    const nakIndex = Math.floor((moon % 360) / (360 / 27));
    const nakshatras = [
      "অশ্বিনী","ভরণী","কৃত্তিকা","রোহিণী","মৃগশিরা","আর্দ্রা","পুনর্বসু","পুষ্যা","অশ্লেষা",
      "মঘা","পূর্বফাল্গুনী","উত্তরফাল্গুনী","হস্তা","চিত্তা","স্বাতী","বিশাখা","অনুরাধা",
      "জ্যেষ্ঠা","মূলা","পূর্বাষাঢ়া","উত্তরাষাঢ়া","শ্রবণা","ধনিষ্ঠা","শতভিষা","পূর্বভাদ্রপদ",
      "উত্তরভাদ্রপদ","রেবতী"
    ];
    const nakshatra = nakshatras[nakIndex];
    const flavor = NAKSHATRA_DESC[nakshatra] || "";

    // Generate horoscopes
    const horoscope = {};
    for (const sign of SIGNS) {
      const rng = seededRandom(`${isoDate}-${sign}`);
      horoscope[sign] = {
        text: `${pick(rng, TEMPLATES.lead)} ${flavor}`.trim(),
        health: pick(rng, TEMPLATES.health),
        advice: pick(rng, TEMPLATES.advice),
        tithi: `তিথি ${tithi}`,
        nakshatra
      };
    }

    return new Response(
      JSON.stringify({
        date: displayDate,
        location: { city, region, country, lat, lon, timeZone: tz },
        sun_longitude: Number(sun.toFixed(6)),
        moon_longitude: Number(moon.toFixed(6)),
        tithi,
        nakshatra,
        horoscope,
        meta: {
          generatedAt: new Date().toISOString(),
          engine: "astronomy-engine + Luxon",
          ip
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "s-maxage=900" }
      }
    );
  } catch (err) {
    console.error("Horoscope API Error:", err);
    return new Response(JSON.stringify({ error: "Failed to generate horoscope" }), { status: 500 });
  }
}
