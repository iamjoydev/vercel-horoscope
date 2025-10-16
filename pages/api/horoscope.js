import { DateTime } from "luxon";
import * as Astronomy from "astronomy-engine";

/*
 API: /api/horoscope
 - auto-detects visitor IP via headers (Vercel provides x-forwarded-for)
 - uses ipapi.co to get lat/lon/timezone
 - computes Sun and Moon longitudes using astronomy-engine
 - calculates Tithi and Nakshatra
 - generates Bengali narrative horoscopes for all 12 signs in your style
 - returns JSON like:
   {
     "date":"16/10/2025",
     "horoscope": {
       "à¦®à§‡à¦·": { "text": "...", "health": "...", "advice": "..." },
       ...
     },
     "location": { city, region, country, lat, lon, timeZone }
   }
*/

async function fetchGeo(ip) {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!res.ok) throw new Error("geo lookup failed");
    return await res.json();
  } catch (e) {
    return null;
  }
}

// Simple deterministic PRNG from seed string (xorshift-ish)
function seededRandom(seedStr) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619) >>> 0;
  }
  return function() {
    h += 0x6D2B79F5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bengali zodiac signs
const SIGNS = [
  "à¦®à§‡à¦·","à¦¬à§ƒà¦·","à¦®à¦¿à¦¥à§à¦¨","à¦•à¦°à§à¦•à¦Ÿ","à¦¸à¦¿à¦‚à¦¹","à¦•à¦¨à§à¦¯à¦¾",
  "à¦¤à§à¦²à¦¾","à¦¬à§ƒà¦¶à§à¦šà¦¿à¦•","à¦§à¦¨à§","à¦®à¦•à¦°","à¦•à§à¦®à§à¦­","à¦®à§€à¦¨"
];

// Small library of template phrases in Bengali (to be combined to your narrative style)
const TEMPLATES = {
  lead: [
    "à¦†à¦œ à¦†à¦ªà¦¨à¦¾à¦° à¦¸à§ƒà¦œà¦¨à¦¶à§€à¦² à¦¶à¦•à§à¦¤à¦¿ à¦œà¦¾à¦—à§à¦°à¦¤ à¦¹à¦¬à§‡à¥¤ à¦…à¦¨à§‡à¦•à§‡à¦‡ à¦†à¦ªà¦¨à¦¾à¦° à¦¨à¦¤à§à¦¨ à¦†à¦‡à¦¡à¦¿à§Ÿà¦¾à¦•à§‡ à¦ªà§à¦°à¦¶à¦‚à¦¸à¦¾ à¦•à¦°à¦¬à§‡à¥¤",
    "à¦†à¦œ à¦§à§ˆà¦°à§à¦¯ à¦“ à¦¬à¦¿à¦šà¦•à§à¦·à¦£à¦¤à¦¾ à¦•à¦¾à¦œà§‡ à¦¦à§‡à¦¬à§‡â€”à¦à¦•à¦Ÿà§ à¦¸à¦¾à¦¬à¦§à¦¾à¦¨ à¦¥à¦¾à¦•à§à¦¨, à¦¤à¦¬à§‡ à¦¸à§à¦¯à§‹à¦— à¦†à¦›à§‡à¥¤",
    "à¦†à¦œ à¦†à¦ªà¦¨à¦¾à¦° à¦®à¦¨ à¦•à¦°à§à¦®à§‡ à¦à¦•à¦¾à¦—à§à¦° à¦¥à¦¾à¦•à¦¬à§‡; à¦¨à¦¤à§à¦¨ à¦¸à¦¿à¦¦à§à¦§à¦¾à¦¨à§à¦¤ à¦—à§à¦°à¦¹à¦£à§‡ à¦¸à¦¾à¦«à¦²à§à¦¯ à¦®à¦¿à¦²à¦¬à§‡à¥¤",
    "à¦†à¦œ à¦¸à§à¦¬à¦¾à¦­à¦¾à¦¬à¦¿à¦•à§‡à¦° à¦šà§‡à¦¯à¦¼à§‡ à¦¬à§‡à¦¶à¦¿ à¦¯à§‹à¦—à¦¾à¦¯à§‹à¦— à¦˜à¦Ÿà¦¬à§‡â€”à¦®à¦¿à¦¥à¦¸à§à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾ à¦«à¦²à¦¦à¦¾à¦¯à¦¼à¦• à¦¹à¦¬à§‡à¥¤",
    "à¦†à¦¤à§à¦®à¦¬à¦¿à¦¶à§à¦²à§‡à¦·à¦£ à¦“ à¦¶à§ƒà¦™à§à¦–à¦²à¦¾ à¦†à¦œ à¦¬à¦¿à¦¶à§‡à¦· à¦«à¦² à¦¦à§‡à¦¬à§‡à¥¤"
  ],
  healthTips: [
    "à¦—à¦²à¦¾ à¦“ à¦¶à§à¦¬à¦¾à¦¸à¦¨à¦¾à¦²à¦¾à§Ÿ à¦¹à¦¾à¦²à¦•à¦¾ à¦…à¦¸à§à¦¬à¦¿à¦§à¦¾ à¦¹à¦¤à§‡ à¦ªà¦¾à¦°à§‡ â€” à¦—à¦°à¦® à¦ªà¦¾à¦¨à§€à§Ÿ à¦¸à¦¹à¦¨à§€à§Ÿ à¦¹à¦¬à§‡à¥¤",
    "à¦¹à¦œà¦® à¦¬à¦¾ à¦ªà§‡à¦Ÿà§‡à¦° à¦¸à¦®à¦¸à§à¦¯à¦¾ à¦à§œà¦¾à¦¤à§‡ à¦¹à¦¾à¦²à¦•à¦¾ à¦–à¦¾à¦¬à¦¾à¦° à¦–à¦¾à¦¨à¥¤",
    "à¦šà§‹à¦– à¦“ à¦®à¦¾à¦¥à¦¾à§Ÿ à¦•à§à¦²à¦¾à¦¨à§à¦¤à¦¿ à¦à§œà¦¾à¦¤à§‡ à¦®à¦¾à¦à§‡à¦®à¦§à§à¦¯à§‡ à¦¬à¦¿à¦°à¦¤à¦¿ à¦¨à¦¿à¦¨à¥¤",
    "à¦¹à¦¾à¦²à¦•à¦¾ à¦¬à§à¦¯à¦¾à¦¯à¦¼à¦¾à¦® à¦¬à¦¾ à¦¹à¦¾à¦à¦Ÿà¦¾ à¦¸à§à¦¬à¦¾à¦¸à§à¦¥à§à¦¯à¦•à§‡ à¦¸à§à¦¦à§ƒà§ à¦°à¦¾à¦–à¦¬à§‡à¥¤",
    "à¦¬à¦¿à¦¶à§à¦°à¦¾à¦® à¦“ à¦ªà¦°à§à¦¯à¦¾à¦ªà§à¦¤ à¦ªà¦¾à¦¨à¦¿ à¦—à§à¦°à¦¹à¦£ à¦°à¦¾à¦–à§à¦¨à¥¤"
  ],
  adviceShort: [
    "à¦¨à¦¿à¦œà§‡à¦° à¦¸à¦®à§Ÿ à¦¦à¦¿à¦¨, à¦¬à¦¿à¦¶à§à¦°à¦¾à¦®à§‡ à¦«à¦¾à¦à¦•à¦¿ à¦¨à¦¿à§Ÿà§‡ à¦•à¦¾à¦œ à¦•à¦°à§à¦¨à¥¤",
    "à¦¨à¦¤à§à¦¨ à¦†à¦‡à¦¡à¦¿à§Ÿà¦¾à¦•à§‡ à¦¨à§‹à¦Ÿ à¦•à¦°à§‡ à¦°à¦¾à¦–à§à¦¨; à¦¸à¦¨à§à¦§à§à¦¯à¦¾à¦¯à¦¼ à¦ªà§à¦¨à¦°à§à¦¬à¦¿à¦¬à§‡à¦šà¦¨à¦¾ à¦•à¦°à§à¦¨à¥¤",
    "à¦ªà¦°à¦¿à¦¬à¦¾à¦°à§‡à¦° à¦¸à¦¦à¦¸à§à¦¯à¦¦à§‡à¦° à¦¸à¦™à§à¦—à§‡ à¦¸à¦®à§Ÿ à¦•à¦¾à¦Ÿà¦¾à¦¨; à¦®à¦¨ à¦¶à¦¾à¦¨à§à¦¤ à¦¹à¦¬à§‡à¥¤",
    "à¦…à¦°à§à¦¥-à¦¬à§à¦¯à¦¬à¦¸à§à¦¥à¦¾à¦¯à¦¼ à¦¸à¦¤à¦°à§à¦• à¦¥à¦¾à¦•à§à¦¨; à¦…à¦ªà§à¦°à¦¯à¦¼à§‹à¦œà¦¨à§€à¦¯à¦¼ à¦–à¦°à¦š à¦à¦¡à¦¼à¦¾à¦¨à¥¤",
    "à¦—à¦­à§€à¦° à¦¶à§à¦¬à¦¾à¦¸ à¦¨à¦¿à¦¯à¦¼à§‡ à¦§à§à¦¯à¦¾à¦¨ à¦šà§‡à¦·à§à¦Ÿà¦¾ à¦•à¦°à§à¦¨â€”à¦®à¦¨à§‡ à¦¶à§€à¦¤à¦²à¦¤à¦¾ à¦†à¦¨à¦¬à§‡à¥¤"
  ]
};

// Map some nakshatras/tithi to small flavor lines to influence narrative
const NAK_FLAVOR = {
  "à¦…à¦¶à§à¦¬à¦¿à¦¨à§€": "à¦¶à§à¦°à§ à¦•à¦°à¦¾à¦° à¦¶à¦•à§à¦¤à¦¿ à¦à¦¬à¦‚ à¦¤à¦¾à§œà¦¨à¦¾ à¦†à¦›à§‡à¥¤",
  "à¦­à¦°à¦£à§€": "à¦¸à§ƒà¦œà¦¨à¦¶à§€à¦² à¦“ à¦¸à¦¹à¦®à¦°à§à¦®à¦¿à¦¤à¦¾à¦ªà§‚à¦°à§à¦£ à¦ªà¦°à¦¿à¦¬à§‡à¦¶à§‡ à¦¥à¦¾à¦•à¦¬à§‡à¦¨à¥¤",
  "à¦•à§ƒà¦¤à§à¦¤à¦¿à¦•à¦¾": "à¦ªà¦°à¦¿à¦¶à§à¦°à¦®à§‡à¦° à¦«à¦² à¦†à¦œ à¦ªà§à¦°à¦¤à¦¿à¦«à¦²à¦¿à¦¤ à¦¹à¦¬à§‡à¥¤",
  "à¦°à§‹à¦¹à¦¿à¦£à§€": "à¦ªà¦¾à¦°à¦¿à¦¬à¦¾à¦°à¦¿à¦• à¦®à§‡à¦²à¦¾à¦®à§‡à¦¶à¦¾ à¦à¦¬à¦‚ à¦¸à§à¦¨à§‡à¦¹ à¦¬à¦¾à¦¡à¦¼à¦¬à§‡à¥¤",
  "à¦®à§ƒà¦—à¦¶à¦¿à¦°à¦¾": "à¦‰à§Žà¦¸à¦¾à¦¹ à¦“ à¦…à¦¨à§à¦¸à¦¨à§à¦§à¦¾à¦¨à¦¶à§€à¦²à¦¤à¦¾ à¦¬à¦¾à§œà¦¬à§‡à¥¤",
  "à¦†à¦°à§à¦¦à§à¦°à¦¾": "à¦†à¦¬à§‡à¦— à¦“ à¦…à¦¨à§€à¦¹à¦¾ à¦®à¦¿à¦¶à§à¦° à¦…à¦¨à§à¦­à¦¬ à¦¹à¦¤à§‡ à¦ªà¦¾à¦°à§‡à¥¤",
  "à¦ªà§à¦¨à¦°à§à¦¬à¦¸à§": "à¦¸à§à¦¥à¦¿à¦°à¦¤à¦¾ à¦“ à¦ªà§à¦¨à¦°à§à¦œà§à¦œà§€à¦¬à¦¨à§‡à¦° à¦¸à¦®à§Ÿà¥¤",
  "à¦ªà§à¦·à§à¦¯à¦¾": "à¦¸à¦¹à¦¯à§‹à¦—à¦¿à¦¤à¦¾ à¦“ à¦¸à¦®à¦¯à¦¼à§‹à¦ªà¦¯à§‹à¦—à§€ à¦¸à¦¿à¦¦à§à¦§à¦¾à¦¨à§à¦¤ à¦—à§à¦°à¦¹à¦£ à¦¸à¦®à§à¦­à¦¬à¥¤",
  "à¦…à¦¶à§à¦²à§‡à¦·à¦¾": "à¦¸à¦¤à¦°à§à¦•à¦¤à¦¾à¦° à¦¸à¦¾à¦¥à§‡ à¦¸à¦®à§à¦ªà¦°à§à¦• à¦¸à¦¾à¦®à¦²à¦¾à¦¨à¥¤",
  "à¦®à¦˜à¦¾": "à¦¸à¦®à§à¦®à¦¾à¦¨ à¦“ à¦ªà§à¦°à¦¸à§à¦•à¦¾à¦°à§‡à¦° à¦¸à¦®à§à¦­à¦¾à¦¬à¦¨à¦¾ à¦†à¦›à§‡à¥¤"
};

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export default async function handler(req, res) {
  try {
    // Get client IP (Vercel sets x-forwarded-for)
    const clientIp = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "8.8.8.8").split(",")[0].trim();

    // Geo lookup
    const geo = await fetchGeo(clientIp) || {};
    const lat = geo.latitude || 28.6139;
    const lon = geo.longitude || 77.2090;
    const city = geo.city || "New Delhi";
    const region = geo.region || "Delhi";
    const country = geo.country_name || "India";
    const tz = req.query.tz || geo.timezone || "Asia/Kolkata";

    // Date/time in user's timezone
    const now = DateTime.now().setZone(tz);
    const isoDate = now.toISODate(); // YYYY-MM-DD
    const displayDate = now.toFormat("dd/MM/yyyy");

    // Astronomy calculations (Sun, Moon longitudes)
    const sunLon = Astronomy.EclipticLongitude("Sun", now.toJSDate());
    const moonLon = Astronomy.EclipticLongitude("Moon", now.toJSDate());

    // Tithi calculation (each 12 degrees is a tithi)
    const tithiIndex = Math.floor(((moonLon - sunLon + 360) % 360) / 12) + 1;

    // Nakshatra calculation
    const nakIndex = Math.floor((moonLon % 360) / (360 / 27));
    const nakshatras = [
      "à¦…à¦¶à§à¦¬à¦¿à¦¨à§€","à¦­à¦°à¦£à§€","à¦•à§ƒà¦¤à§à¦¤à¦¿à¦•à¦¾","à¦°à§‹à¦¹à¦¿à¦£à§€","à¦®à§ƒà¦—à¦¶à¦¿à¦°à¦¾","à¦†à¦°à§à¦¦à§à¦°à¦¾",
      "à¦ªà§à¦¨à¦°à§à¦¬à¦¸à§","à¦ªà§à¦·à§à¦¯à¦¾","à¦…à¦¶à§à¦²à§‡à¦·à¦¾","à¦®à¦˜à¦¾","à¦ªà§‚à¦°à§à¦¬à¦«à¦¾à¦²à§à¦—à§à¦¨à§€","à¦‰à¦¤à§à¦¤à¦°à¦«à¦¾à¦²à§à¦—à§à¦¨à§€",
      "à¦¹à¦¸à§à¦¤à¦¾","à¦šà¦¿à¦¤à§à¦°à¦¾","à¦¸à§à¦¬à¦¾à¦¤à§€","à¦¬à¦¿à¦¶à¦¾à¦–à¦¾","à¦…à¦¨à§à¦°à¦¾à¦§à¦¾","à¦œà§à¦¯à§‡à¦·à§à¦ à¦¾",
      "à¦®à§‚à¦²à¦¾","à¦ªà§‚à¦°à§à¦¬à¦¾à¦·à¦¾à¦¢à¦¼à¦¾","à¦‰à¦¤à§à¦¤à¦°à¦¾à¦·à¦¾à¦¢à¦¼à¦¾","à¦¶à§à¦°à¦¬à¦£à¦¾","à¦§à¦¨à¦¿à¦·à§à¦ à¦¾","à¦¶à¦¤à¦­à¦¿à¦·à¦¾",
      "à¦ªà§‚à¦°à§à¦¬à¦­à¦¾à¦¦à§à¦°à¦ªà¦¦à¦¾","à¦‰à¦¤à§à¦¤à¦°à¦­à¦¾à¦¦à§à¦°à¦ªà¦¦à¦¾","à¦°à§‡à¦¬à¦¤à§€"
    ];
    const nakshatra = nakshatras[nakIndex];

    // Build horoscope per sign (deterministic per date and sign: use isoDate+sign seed)
    const horoscope = {};

    for (let i = 0; i < SIGNS.length; i++) {
      const sign = SIGNS[i];
      const seed = `${isoDate}|${sign}`;
      const rng = seededRandom(seed);

      // Compose narrative in your style: lead + health + short advice
      const lead = pick(rng, TEMPLATES.lead);
      // flavor from nakshatra or tithi sometimes
      const flavor = NAK_FLAVOR[nakshatra] ? NAK_FLAVOR[nakshatra] : "";
      const health = pick(rng, TEMPLATES.healthTips);
      const advice = pick(rng, TEMPLATES.adviceShort);

      // Create multi-line text like your sample
      const text = `${lead} ${flavor}`.trim();

      horoscope[sign] = {
        text: text,
        health: health,
        advice: advice,
        tithi: `à¦¤à¦¿à¦¥à¦¿ ${tithiIndex}`,
        nakshatra: nakshatra
      };
    }

    const out = {
      date: displayDate,
      location: { city, region, country, lat, lon, timeZone: tz },
      sun_longitude: Number(sunLon.toFixed(6)),
      moon_longitude: Number(moonLon.toFixed(6)),
      tithi: tithiIndex,
      nakshatra,
      horoscope,
      meta: { generatedAt: new Date().toISOString(), method: "astronomy-engine + deterministic templates" }
    };

    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
    return res.status(200).json(out);

  } catch (err) {
    console.error("Horoscope API error:", err);
    res.status(500).json({ error: "Failed to generate horoscope" });
  }
}
