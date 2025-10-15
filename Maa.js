// widget.js
function createWidget(container) {
  const FIXTURE_ID = container.getAttribute("data-fixture");
  const API_URL = `https://streams.vicecaptain.totalsportslive.co.zw?id=${FIXTURE_ID}`;
  const CACHE_KEY = `match_${FIXTURE_ID}`;
  const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes

  // Inject full widget skeleton
  container.innerHTML = `
  <div id="match-container"></div>
  <template id="fixture-template">
    <div class="match-widget">
      <div class="header">
        <h2>⚽ <span class="home-name"></span> vs <span class="away-name"></span></h2>
        <div class="league-info"></div>
      </div>
      <div class="adsense">📢[AdSense Ad Placement-Top]</div>
      <div class="teams-section">
        <div class="logos-row">
          <img class="home-logo" width="75">
          <div class="vs-text"></div>
          <img class="away-logo" width="75">
        </div>
        <div class="names-row">
          <div class="home-name"></div><div class="vs-spacer"></div><div class="away-name"></div>
        </div>
        <div class="live-info"></div>
      </div>
      <div class="info-grid">
        <div class="info-card stats"><h3>📊 Live Statistics</h3></div>
        <div class="info-card events"><h3>⚽ Match Events</h3></div>
        <div class="info-card info"><h3>🎫 Match Information</h3></div>
      </div>
      <div class="adsense">📢[AdSense Ad Placement-Bottom]</div>
    </div>
  </template>`;

  const q = (s, p = document) => p.querySelector(s);
  const el = (t, c, h = "") => `<${t} class="${c}">${h}</${t}>`;
  const stat = (l, v) => el("div", "stat-item", el("span", "stat-label", l) + el("span", "stat-value", v));
  const form = f => f?.split('').map(ch =>
    `<span class="form-letter ${ch === "W" ? "win" : ch === "D" ? "draw" : "loss"}">${ch}</span>`
  ).join('') || "N/A";

  async function loadMatch() {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      const match = data.events?.find(ev => ev.id == FIXTURE_ID) || data.event || data;
      if (!match) return loadFromStorage("❌ Match not found");
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: match, timestamp: Date.now() }));
      displayMatch(match);
    } catch (e) {
      console.error("Fetch failed:", e);
      loadFromStorage("⚠️ Showing archived data");
    }
  }

  function loadFromStorage(msg) {
    const cache = localStorage.getItem(CACHE_KEY);
    if (!cache) return container.innerHTML = `<p>${msg}</p>`;
    const { data, timestamp } = JSON.parse(cache);
    if (Date.now() - timestamp > CACHE_EXPIRY) return container.innerHTML = `<p>${msg}</p>`;
    displayMatch(data, true);
  }

  function displayMatch(match, archived = false) {
    const comp = match.competitions[0],
      home = comp.competitors.find(c => c.homeAway === "home"),
      away = comp.competitors.find(c => c.homeAway === "away"),
      tpl = q("#fixture-template").content.cloneNode(true);

    tpl.querySelectorAll(".home-name").forEach(e => e.textContent = home.team.name);
    tpl.querySelectorAll(".away-name").forEach(e => e.textContent = away.team.name);
    q(".home-logo", tpl).src = home.team.logo;
    q(".away-logo", tpl).src = away.team.logo;

    const isLive = match.status.type.state === "in",
          done = match.status.type.state === "post";

    q(".vs-text", tpl).innerHTML = (isLive || done)
      ? `<div class="score-row">${home.score} - ${away.score}</div>`
      : "VS";

    q(".live-info", tpl).innerHTML = `
      <p>${isLive ? "🔴 LIVE" : done ? "✅ FULL TIME" : "⏰ SCHEDULED"}</p>
      <p>${match.status.displayClock || ""}</p>`;

    // stats
    const stats = {};
    (home.statistics || []).forEach(h => {
      const a = (away.statistics || []).find(x => x.name === h.name);
      stats[h.name] = { home: h.displayValue || h.value, away: a?.displayValue || a?.value };
    });
    q(".stats", tpl).innerHTML += Object.entries(stats)
      .map(([k, v]) => stat(k, `${v.home} - ${v.away}`)).join("");

    // events
    const allEvents = Array.isArray(comp.details?.events) ? comp.details.events : [];
    const eventIcons = { goal: "⚽", yellowcard: "🟨", redcard: "🟥", substitution: "🔁" };
    const grouped = {};
    for (const ev of allEvents) {
      const half = ev.clock?.value <= 2700 ? "1st Half" : "2nd Half";
      if (!grouped[half]) grouped[half] = [];
      grouped[half].push(ev);
    }
    let eventsHTML = "";
    for (const [half, list] of Object.entries(grouped)) {
      const halfHTML = list.map(ev => {
        const type = ev.type?.text?.toLowerCase() || "";
        const icon = eventIcons[type] || "•";
        const time = ev.clock?.displayValue || "FT";
        const player = ev.athletesInvolved?.[0]?.displayName || "Unknown";
        const teamId = ev.team?.id;
        const isHome = comp.competitors.find(c => c.id == teamId)?.homeAway === "home";
        const color = type.includes("goal") ? "green" : type.includes("yellow") ? "gold" : type.includes("red") ? "red" : "inherit";
        return `
        <div class="event-item" style="display:flex;justify-content:space-between;align-items:center;margin:5px 0;">
          <div style="flex:1;text-align:left;color:${!isHome ? color : "inherit"};">${!isHome ? `${icon} ${player}` : ""}</div>
          <div style="width:40px;text-align:center;background:#cce5ff;border-radius:4px;font-weight:bold;">${time}</div>
          <div style="flex:1;text-align:right;color:${isHome ? color : "inherit"};">${isHome ? `${player} ${icon}` : ""}</div>
        </div>`;
      }).join("");
      eventsHTML += `<h4 style="text-align:center;">${half}</h4>${halfHTML}`;
    }
    q(".events", tpl).innerHTML += eventsHTML || "<p>No play-by-play yet</p>";

    // info
    q(".info", tpl).innerHTML += stat("Venue", comp.venue?.fullName || "TBD");

    q("#match-container").innerHTML = "";
    q("#match-container").appendChild(tpl);
  }

  loadMatch();
  setInterval(loadMatch, 30000);
}

// === Init all widgets ===
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".football-widget").forEach(createWidget);
});
