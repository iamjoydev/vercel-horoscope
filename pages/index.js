import { useEffect, useState } from "react";

export default function Home() {
  const [json, setJson] = useState(null);

  useEffect(() => {
    fetch("/api/horoscope").then(r => r.json()).then(setJson).catch(()=>{});
  }, []);

  return (
    <div style={{ fontFamily: "Segoe UI, Roboto, sans-serif", padding: 20 }}>
      <h1 style={{ color: "#f96d06" }}>ðŸª„ à¦¦à§ˆà¦¨à¦¿à¦• à¦°à¦¾à¦¶à¦¿à¦«à¦² (Demo)</h1>
      {json ? (
        <div style={{ maxWidth: 900 }}>
          <div style={{ marginBottom: 12 }}>
            <strong>à¦¤à¦¾à¦°à¦¿à¦–:</strong> {json.date} â€” <strong>à¦¸à§à¦¥à¦¾à¦¨:</strong> {json.location.city}, {json.location.country}
          </div>
          <pre style={{ background: "#f7f7f7", padding: 12, borderRadius: 6 }}>
            {JSON.stringify(json, null, 2)}
          </pre>
        </div>
      ) : (
        <p>à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à¦¿â€¦</p>
      )}
    </div>
  );
}
