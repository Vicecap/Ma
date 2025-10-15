<div id="match-container" data-match-id="724867"></div>

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
</template>

<script>
const container = document.querySelector("#match-container");
const matchId = container.dataset.matchId; // 🆔 dynamically from Blogger
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
  else container.innerHTML = `<div class="match-widget"><p>${msg}</p></div>`;
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

  // stats
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

  // 🆕 Grouped match events
  const allEvents = Array.isArray(comp.details) ? comp.details :
                    Array.isArray(comp.details?.events) ? comp.details.events : [];

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

        // player color
        let playerColor = "inherit";
        if (typeText.includes("goal")) playerColor = "green";
        else if (typeText.includes("yellow")) playerColor = "goldenrod";
        else if (typeText.includes("red")) playerColor = "red";

        return `
        <div class="event-item" style="display:flex; justify-content:space-between; align-items:center; margin:5px 0;">
          <div style="flex:1; text-align:left; color:${!isHome ? playerColor : "inherit"};">
            ${!isHome ? `${icon} ${player}` : ""}
          </div>
          <div style="width:40px; text-align:center; font-weight:bold; background:#cce5ff; border-radius:4px;">
            ${time}
          </div>
          <div style="flex:1; text-align:right; color:${isHome ? playerColor : "inherit"};">
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

  // info
  q(".info", tpl).innerHTML +=
    stat("Tickets", (comp.tickets || []).map(t =>
      `<a href="${t.links?.[0]?.href || '#'}">${t.summary}</a>`
    ).join(" | ") || "Check official site") +
    stat("Weather", (comp.weather?.temperature || "N/A") +
      (comp.weather?.condition ? `-${comp.weather.condition}` : "")) +
    stat("Referee", comp.officials?.[0]?.displayName || "TBD");

  // odds 💰
  let oddsHtml = "";
  if (Array.isArray(comp.pickcenter) && comp.pickcenter.length) {
    const pc = comp.pickcenter[0];
    const moneyline = {
      home: pc.odds?.moneyline?.home || "-",
      draw: pc.odds?.moneyline?.draw || "-",
      away: pc.odds?.moneyline?.away || "-"
    };
    const overUnder = {
      over: pc.odds?.total?.over || "-",
      under: pc.odds?.total?.under || "-"
    };
    oddsHtml = `
      <div class="odds-grid">
        <div class="odds-card"><h4>Home Win</h4><div class="odds-value">${moneyline.home}</div></div>
        <div class="odds-card"><h4>Draw</h4><div class="odds-value">${moneyline.draw}</div></div>
        <div class="odds-card"><h4>Away Win</h4><div class="odds-value">${moneyline.away}</div></div>
        <div class="odds-card"><h4>Over 2.5</h4><div class="odds-value">${overUnder.over}</div></div>
        <div class="odds-card"><h4>Under 2.5</h4><div class="odds-value">${overUnder.under}</div></div>
      </div>`;
  }
  if (oddsHtml) {
    q(".info-grid", tpl).innerHTML += `
      <div class="info-card odds">
        <h3>💰 Betting Odds</h3>
        ${oddsHtml}
      </div>`;
  }

  container.innerHTML = "";
  container.appendChild(tpl);
}

// auto refresh every 30 seconds
loadMatch();
setInterval(loadMatch, 30000);
</script>
