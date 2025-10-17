(function() {
  // Create container if not present
  if (!document.querySelector("#match-container")) {
    const div = document.createElement("div");
    div.id = "match-container";
    document.body.appendChild(div);
  }

  // Inject template HTML
  const template = document.createElement("template");
  template.innerHTML = `
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
  document.body.appendChild(template);

  // === JS Logic ===
  const container = document.querySelector(".match-widget-container");
  const matchId = container?.dataset.matchId || "758373";
  const storageKey = "matchArchive_" + matchId;

  const q = (s, p = document) => p.querySelector(s);
  const el = (t, c, h = "") => `<${t} class="${c}">${h}</${t}>`;
  const stat = (l, v) => el("div", "stat-item", el("span", "stat-label", l) + el("span", "stat-value", v));
  const form = f => f?.split('').map(ch =>
    `<span class="form-letter ${ch === "W" ? "win" : ch === "D" ? "draw" : "loss"}">${ch}</span>`
  ).join('') || "N/A";

  async function loadMatch() {
    try {
      const res = await fetch(`https://streams.vicecaptain.totalsportslive.co.zw?id=${matchId}`);
      const data = await res.json();
      const match = data.events?.find(ev => ev.id == matchId) || data.event || data || null;

      if (!match) return loadFromStorage("❌ Match not found in API");

      localStorage.setItem(storageKey, JSON.stringify(match));
      displayMatch(match);
    } catch (e) {
      console.error(e);
      loadFromStorage("⚠️ Failed to fetch, showing archive");
    }
  }

  function loadFromStorage(msg) {
    const match = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (match) displayMatch(match, true);
    else q("#match-container").innerHTML = `<div class="match-widget"><p>${msg}</p></div>`;
  }

  function displayMatch(match, arch = false) {
    const comp = match.competitions[0],
          home = comp.competitors.find(c => c.homeAway === "home"),
          away = comp.competitors.find(c => c.homeAway === "away"),
          tpl = q("#fixture-template").content.cloneNode(true);

    tpl.querySelectorAll(".home-name").forEach(e => e.textContent = home.team.name);
    tpl.querySelectorAll(".away-name").forEach(e => e.textContent = away.team.name);
    q(".league-info", tpl).textContent = (match.season?.year + " " + (match.season?.slug || "Season")).replace(/-/g, " ") + (arch ? " (archived)" : "");
    q(".home-logo", tpl).src = home.team.logo;
    q(".away-logo", tpl).src = away.team.logo;

    const isLive = match.status.type.state === "in",
          done = match.status.type.state === "post",
          btn = isLive
            ? '<span class="live-btn live">🔴 LIVE</span>'
            : done
            ? '<span class="live-btn final">✅ FULL TIME</span>'
            : '<span class="live-btn scheduled">⏰ SCHEDULED</span>';

    q(".vs-text", tpl).innerHTML = (isLive || done) ? `<div class="score-row">${home.score} - ${away.score}</div>` : "VS";
    q(".live-info", tpl).innerHTML = `
      ${!isLive && !done ? `<p>📅 ${new Date(match.date).toLocaleString()}</p>` : ""}
      <p>${btn} ${match.status.displayClock || ""}</p>
      <p>🏟️ ${comp.venue?.fullName || "TBD"} (${comp.venue?.capacity || "?"})</p>
      <p>👥 Attendance: ${comp.attendance || "TBD"}</p>
      <p>📺 ${comp.broadcasts?.map(b => b.names.join(", ")).join(" | ") || "TBD"}</p>`;

    const stats = {};
    (home.statistics || []).forEach(h => {
      const a = (away.statistics || []).find(x => x.name === h.name);
      stats[h.name] = { home: h.displayValue || h.value, away: a?.displayValue || a?.value };
    });
    (away.statistics || []).forEach(a => {
      if (!stats[a.name]) {
        const h = (home.statistics || []).find(x => x.name === a.name);
        stats[a.name] = { home: h?.displayValue || h?.value, away: a.displayValue || a.value };
      }
    });
    q(".stats", tpl).innerHTML += Object.entries(stats)
      .map(([k, v]) => stat(k, `${v.home} - ${v.away}`)).join("") +
      stat("Home Form", form(home.form)) +
      stat("Away Form", form(away.form));

    const allEvents =
      match.competitions?.[0]?.playByPlay?.events ||
      Array.isArray(comp.details) ? comp.details :
      Array.isArray(comp.details?.events) ? comp.details.events :
      [];

    const eventIcons = {
      goal: "⚽",
      "goal - header": "⚽",
      "goal - penalty": "⚽ (P)",
      "penalty goal": "⚽ (P)",
      "penalty missed": "❌ (P)",
      yellowcard: "🟨",
      redcard: "🟥",
      "yellow card": "🟨",
      "red card": "🟥",
      substitution: "🔁",
      owngoal: "🥅 (OG)",
    };

    function eventHalf(ev) {
      const t = ev.clock?.value || 0;
      if (t <= 2700) return "1st Half";
      if (t <= 5400) return "2nd Half";
      if (t <= 6300) return "Extra Time";
      return "Penalty Shootout";
    }

    const grouped = {};
    for (const ev of allEvents) {
      const half = eventHalf(ev);
      if (!grouped[half]) grouped[half] = [];
      grouped[half].push(ev);
    }

    let eventsHTML = "";
    for (const [half, list] of Object.entries(grouped)) {
      const halfHTML = list
        .sort((a, b) => (a.clock?.value || 0) - (b.clock?.value || 0))
        .map(ev => {
          const typeText = ev.type?.text?.toLowerCase() || "";
          const icon = eventIcons[typeText] || "•";
          const time = ev.clock?.displayValue || "FT";
          const player = ev.athletesInvolved?.[0]?.displayName || "Unknown";
          const teamId = ev.team?.id || "";
          const isHome = comp.competitors?.find(c => c.id == teamId)?.homeAway === "home";

          return `
          <div class="event-item" style="display:flex; justify-content:space-between; align-items:center; margin:5px 0;">
            <div style="flex:1; text-align:left;">
              ${!isHome ? `${icon} ${player}` : ""}
            </div>
            <div style="width:40px; text-align:center; font-weight:bold; background:#cce5ff; border-radius:4px;">
              ${time}
            </div>
            <div style="flex:1; text-align:right;">
              ${isHome ? `${player} ${icon}` : ""}
            </div>
          </div>`;
        }).join("");

      eventsHTML += `
        <div class="event-half">
          <h4 class="half-title" style="text-align:center;">${half}</h4>
          ${halfHTML}
        </div>`;
    }

    q(".events", tpl).innerHTML += eventsHTML || "<p>No play-by-play events yet</p>";

    q("#match-container").innerHTML = "";
    q("#match-container").appendChild(tpl);
  }

  loadMatch();
  setInterval(loadMatch, 30000);
})();
