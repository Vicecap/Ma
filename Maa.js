// match-widget.js (host on GitHub Pages)

(function(){
  const q = (s, p=document) => p.querySelector(s);
  const el = (t, c, h="") => `<${t} class="${c}">${h}</${t}>`;
  const stat = (l, v) => el("div", "stat-item", el("span", "stat-label", l) + el("span", "stat-value", v));
  const form = f => f?.split('').map(ch =>
    `<span class="form-letter ${ch==="W"?"win":ch==="D"?"draw":"loss"}">${ch}</span>`
  ).join('') || "N/A";

  const containers = document.querySelectorAll(".match-widget-container");
  containers.forEach(container => {
    const matchId = container.dataset.matchId;
    const storageKey = "matchArchive_" + matchId;

    async function loadMatch() {
      try {
        const res = await fetch(`https://streams.vicecaptain.totalsportslive.co.zw?id=${matchId}`);
        const data = await res.json();
        const match = data.events?.find(ev=>ev.id==matchId) || data.event || data || null;
        if(!match) return loadFromStorage("❌ Match not found in API");
        localStorage.setItem(storageKey, JSON.stringify(match));
        displayMatch(match);
      } catch(e) {
        console.error(e);
        loadFromStorage("⚠️ Failed to fetch, showing archive");
      }
    }

    function loadFromStorage(msg){
      const match = JSON.parse(localStorage.getItem(storageKey) || "null");
      if(match) displayMatch(match,true);
      else container.innerHTML = `<div class="match-widget"><p>${msg}</p></div>`;
    }

    function displayMatch(match,arch=false){
      const comp = match.competitions[0],
            home = comp.competitors.find(c=>c.homeAway==="home"),
            away = comp.competitors.find(c=>c.homeAway==="away");

      container.innerHTML = `
      <div class="match-widget">
        <div class="header">
          <h2>⚽ ${home.team.name} vs ${away.team.name}</h2>
          <div class="league-info">${(match.season?.year + " " + (match.season?.slug || "Season")).replace(/-/g," ") + (arch?" (archived)":"")}</div>
        </div>
        <div class="teams-section">
          <div style="display:flex;align-items:center;justify-content:center;">
            <img src="${home.team.logo}" width="75">
            <div style="width:40px;text-align:center;">VS</div>
            <img src="${away.team.logo}" width="75">
          </div>
        </div>
        <div class="info-grid">
          <div class="info-card stats"><h3>📊 Live Statistics</h3></div>
          <div class="info-card events"><h3>⚽ Match Events</h3></div>
        </div>
      </div>`;

      const statsEl = q(".stats", container);
      const stats = {};
      (home.statistics||[]).forEach(h=>{
        const a = (away.statistics||[]).find(x=>x.name===h.name);
        stats[h.name] = {home:h.displayValue||h.value, away:a?.displayValue||a?.value};
      });
      q(".stats", container).innerHTML += Object.entries(stats).map(([k,v])=>stat(k,`${v.home} - ${v.away}`)).join("") +
        stat("Home Form",form(home.form)) +
        stat("Away Form",form(away.form));

      // events
      const allEvents = Array.isArray(comp.details)?comp.details:Array.isArray(comp.details?.events)?comp.details.events:[];
      const eventIcons = {goal:"⚽","goal - header":"⚽","goal - penalty":"⚽ (P)","penalty goal":"⚽ (P)","penalty missed":"❌ (P)",yellowcard:"🟨",redcard:"🟥","yellow card":"🟨","red card":"🟥",substitution:"🔁",owngoal:"🥅 (OG)"};

      function eventHalf(ev){ const t=ev.clock?.value||0; if(t<=2700)return"1st Half"; if(t<=5400)return"2nd Half"; if(t<=6300)return"Extra Time"; return"Penalty Shootout"; }

      const grouped = {};
      for(const ev of allEvents){
        const half=eventHalf(ev);
        if(!grouped[half]) grouped[half]=[];
        grouped[half].push(ev);
      }

      let eventsHTML="";
      for(const [half,list] of Object.entries(grouped)){
        const halfHTML=list.sort((a,b)=>(a.clock?.value||0)-(b.clock?.value||0)).map(ev=>{
          const typeText = ev.type?.text?.toLowerCase()||"";
          const icon = eventIcons[typeText]||"•";
          const time = ev.clock?.displayValue||"FT";
          const player = ev.athletesInvolved?.[0]?.displayName||"Unknown";
          const teamId = ev.team?.id||"";
          const isHome = comp.competitors?.find(c=>c.id==teamId)?.homeAway==="home";
          let playerColor="";
          if(typeText.includes("goal")) playerColor="green";
          else if(typeText.includes("yellow")) playerColor="orange";
          else if(typeText.includes("red")) playerColor="red";

          return `<div style="display:flex;justify-content:space-between;align-items:center;margin:5px 0;">
            <div style="flex:1;text-align:left;color:${!isHome?playerColor:"inherit"};">${!isHome?icon+" "+player:""}</div>
            <div style="width:40px;text-align:center;font-weight:bold;background:#cce5ff;border-radius:4px;">${time}</div>
            <div style="flex:1;text-align:right;color:${isHome?playerColor:"inherit"};">${isHome?player+" "+icon:""}</div>
          </div>`;
        }).join("");
        eventsHTML += `<div class="event-half"><h4 style="text-align:center;">${half}</h4>${halfHTML}</div>`;
      }

      q(".events", container).innerHTML += eventsHTML || "<p>No play-by-play events yet</p>";

    }

    loadMatch();
    setInterval(loadMatch,30000);
  });
})();
