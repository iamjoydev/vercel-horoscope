(function(){
  // Simple embed script (call from any site)
  // Usage:
  // <div id="vh-root"></div>
  // <script src="https://your-deploy.vercel.app/embed.js" data-endpoint="https://your-deploy.vercel.app/api/horoscope"></script>

  async function renderRoot(el, endpoint) {
    el.innerHTML = "à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡...";
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      const date = data.date;
      const signs = data.horoscope;
      let html = `<div style="max-width:600px;margin:10px auto;padding:16px;border:1px solid #eee;border-radius:10px;background:#fffaf3;font-family:Segoe UI, Roboto, sans-serif">`;
      html += `<h3 style="text-align:center;color:#f96d06">ðŸª„ ${date} à¦°à¦¾à¦¶à¦¿à¦«à¦²</h3>`;
      for (const s of Object.keys(signs)) {
        html += `<div style="margin:10px 0;"><strong>${s}:</strong><div style="margin-left:8px">${signs[s].text}</div><div style="color:#666;margin-top:4px"><strong>à¦¸à§à¦¬à¦¾à¦¸à§à¦¥à§à¦¯:</strong> ${signs[s].health} <br/><strong>à¦ªà¦°à¦¾à¦®à¦°à§à¦¶:</strong> ${signs[s].advice}</div></div><hr/>`;
      }
      html += `</div>`;
      el.innerHTML = html;
    } catch (e) {
      el.innerHTML = "Horoscope load failed.";
    }
  }

  document.addEventListener("DOMContentLoaded", function(){
    const scripts = document.getElementsByTagName("script");
    for (let i=0;i<scripts.length;i++){
      const s = scripts[i];
      if (s.getAttribute("data-endpoint")) {
        const endpoint = s.getAttribute("data-endpoint");
        const targetId = s.getAttribute("data-target") || "vh-root";
        let el = document.getElementById(targetId);
        if (!el) { el = document.createElement("div"); el.id = targetId; s.parentNode.insertBefore(el, s); }
        renderRoot(el, endpoint);
      }
    }
  });
})();
