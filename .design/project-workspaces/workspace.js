import { prepare, layout } from "../assets/pretext.js";

const variants = {
  signal: { name: "Signal Studio", note: "Balanced project command center" },
  atlas: { name: "Event Atlas", note: "Events-first analytical workspace" },
  ops: { name: "Dark Operations", note: "Dense live collection console" },
  ledger: { name: "Editorial Ledger", note: "Narrative project analytics" },
  grid: { name: "Compact Grid", note: "High-density operator workspace" },
  calm: { name: "Calm Monitor", note: "Low-noise analytics workspace" },
};

const projects = {
  afterservice: {
    name: "Afterservice", org: "Personal", mark: "A", domain: "afterservice.app", visitors: 184, events: 2814, returning: 117, rejected: 3,
    eventsList: [
      { name:"service_job_created", count:742, source:"server", route:"/jobs", trend:18.4 },
      { name:"site_visit", count:618, source:"browser", route:"/", trend:8.1 },
      { name:"page_view", count:516, source:"browser", route:"/dashboard", trend:12.2 },
      { name:"notification_sent", count:401, source:"server", route:"—", trend:6.7 },
      { name:"invoice_exported", count:289, source:"browser", route:"/invoices", trend:-2.4 },
      { name:"local_infra_verified", count:248, source:"server", route:"—", trend:31.0 },
    ],
  },
  logly: {
    name: "Logly", org: "Personal", mark: "L", domain: "logly-chi.vercel.app", visitors: 76, events: 1108, returning: 49, rejected: 0,
    eventsList: [
      { name:"site_visit", count:331, source:"browser", route:"/", trend:14.2 },
      { name:"page_view", count:286, source:"browser", route:"/events", trend:21.6 },
      { name:"project_switched", count:194, source:"browser", route:"/overview", trend:9.5 },
      { name:"event_detail_opened", count:139, source:"browser", route:"/events", trend:4.1 },
      { name:"collector_health_checked", count:96, source:"server", route:"—", trend:2.8 },
      { name:"api_key_created", count:62, source:"server", route:"—", trend:-8.0 },
    ],
  },
  plotkey: {
    name: "PlotKey", org: "MicrosaaS", mark: "P", domain: "plotkey.app", visitors: 329, events: 4927, returning: 211, rejected: 12,
    eventsList: [
      { name:"chart_created", count:1284, source:"browser", route:"/editor", trend:25.8 },
      { name:"site_visit", count:1011, source:"browser", route:"/", trend:11.2 },
      { name:"dataset_imported", count:882, source:"server", route:"—", trend:16.9 },
      { name:"chart_exported", count:763, source:"browser", route:"/editor", trend:7.7 },
      { name:"share_link_created", count:604, source:"server", route:"—", trend:32.2 },
      { name:"upgrade_viewed", count:383, source:"browser", route:"/settings", trend:-1.3 },
    ],
  },
};

const pageNames = { overview:"Overview", events:"Events", live:"Live", insights:"Insights", settings:"Settings" };
const pageIcons = { overview:"01", events:"02", live:"03", insights:"04", settings:"05" };
const state = {
  page: location.hash.replace("#", "") || "overview",
  project: new URLSearchParams(location.search).get("project") || "afterservice",
  range: "7d", source: "all", query: "",
};
if (!pageNames[state.page]) state.page = "overview";
if (!projects[state.project]) state.project = "afterservice";

const app = document.querySelector("#app");
const variant = variants[document.body.dataset.variant] || variants.signal;

function fmt(value) { return new Intl.NumberFormat("en").format(Math.round(value)); }
function multiplier() { return state.range === "24h" ? .17 : state.range === "30d" ? 3.72 : 1; }
function scopedEvents() {
  return projects[state.project].eventsList.filter((event) => (state.source === "all" || event.source === state.source) && event.name.includes(state.query.toLowerCase()));
}
function svgChart(seed = 0, compact = false) {
  const count = compact ? 18 : 28;
  const points = Array.from({length:count}, (_,i) => {
    const wave = Math.sin((i + seed) * .61) * 21 + Math.cos((i + seed) * .23) * 12;
    const y = 175 - (i * 2.1 + wave + (seed % 5) * 3);
    return [i * (640/(count-1)), Math.max(35,Math.min(218,y))];
  });
  const line = points.map(p => p.join(",")).join(" ");
  const area = `0,238 ${line} 640,238`;
  const second = points.map(([x,y],i) => `${x},${Math.min(220,y+38+Math.sin(i)*8)}`).join(" ");
  return `<div class="chart"><div class="chart-legend"><span>Events</span><span>Visitors</span></div><svg viewBox="0 0 640 250" role="img" aria-label="Event and visitor trend for ${projects[state.project].name}"><line class="gridline" x1="0" y1="50" x2="640" y2="50"/><line class="gridline" x1="0" y1="110" x2="640" y2="110"/><line class="gridline" x1="0" y1="170" x2="640" y2="170"/><line class="gridline" x1="0" y1="230" x2="640" y2="230"/><polygon class="area" points="${area}"/><polyline class="line" points="${line}"/><polyline class="line secondary" points="${second}"/><text class="axis" x="0" y="248">${state.range === "24h" ? "12am" : "26 Aug"}</text><text class="axis" x="294" y="248">${state.range === "24h" ? "12pm" : "30 Aug"}</text><text class="axis" x="590" y="248">Now</text></svg></div>`;
}
function rangeControl() { return `<div class="range" aria-label="Date range">${["24h","7d","30d"].map(r => `<button type="button" data-range="${r}" class="${state.range===r?"active":""}">${r}</button>`).join("")}</div>`; }
function metrics() {
  const p = projects[state.project], m = multiplier();
  return `<section class="metrics" aria-label="${p.name} summary"><article class="metric"><span>Visitors</span><strong>${fmt(p.visitors*m)}</strong><small>+12.4% vs prior</small></article><article class="metric"><span>New visitors</span><strong>${fmt((p.visitors-p.returning)*m)}</strong><small>${Math.round((p.visitors-p.returning)/p.visitors*100)}% share</small></article><article class="metric"><span>Returning</span><strong>${fmt(p.returning*m)}</strong><small>${Math.round(p.returning/p.visitors*100)}% share</small></article><article class="metric"><span>Events</span><strong>${fmt(p.events*m)}</strong><small>+8.1% vs prior</small></article></section>`;
}
function bars(limit = 6) {
  const rows = scopedEvents().slice(0,limit), max = Math.max(...rows.map(e=>e.count),1), m=multiplier();
  return `<div class="bar-list">${rows.map(e=>`<div><div class="bar-top"><span>${e.name}</span><strong class="mono">${fmt(e.count*m)}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(5,e.count/max*100)}%"></div></div></div>`).join("") || `<p>No event names match these filters.</p>`}</div>`;
}
function recentList(limit = 6) {
  const rows = scopedEvents().slice(0,limit);
  return `<ul class="list">${rows.map((e,i)=>`<li class="list-row" data-open-event="${e.name}"><span><span class="row-title">${e.name}</span><span class="row-meta">${e.source} · ${e.route} · ${i*3+1} min ago</span></span><span class="badge good">accepted</span></li>`).join("")}</ul>`;
}
function pageHead(kicker,title,description,actions="") { return `<header class="page-head"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p data-pretext contenteditable="true">${description}</p></div><div class="actions">${actions}</div></header>`; }

function overviewPage() {
  const p=projects[state.project];
  return `${pageHead("Project overview",`${p.name} at a glance`,`Everything here belongs to ${p.name}. Switch the project in the sidebar and the entire workspace changes.`,`${rangeControl()}<button class="button" data-page="live">Watch live</button>`)}${metrics()}<section class="grid"><article class="panel"><div class="panel-head"><div><h2>Event volume</h2><p>Complete selected window, never paginated totals</p></div><button class="icon-button" aria-label="Chart menu">···</button></div>${svgChart(p.events%9)}</article><aside class="stack"><article class="panel"><div class="panel-head"><div><h2>Top events</h2><p>Ranked by selected range</p></div><button class="button" data-page="events">Explore</button></div><div class="panel-body">${bars(5)}</div></article><article class="panel"><div class="panel-head"><div><h2>Collection health</h2><p>Latest trusted project delivery</p></div><span class="badge good">Healthy</span></div><ul class="list"><li class="list-row"><span><strong>Last event</strong><span class="row-meta">18 seconds ago</span></span><span class="mono">200</span></li><li class="list-row"><span><strong>Rejected</strong><span class="row-meta">Current window</span></span><span class="mono">${p.rejected}</span></li></ul></article></aside></section><section class="panel" style="margin-top:20px"><div class="panel-head"><div><h2>Recent signals</h2><p>The latest accepted events for ${p.name}</p></div><button class="button" data-page="events">All events</button></div>${recentList(6)}</section>`;
}

function eventsPage() {
  const p=projects[state.project], rows=scopedEvents(), total=rows.reduce((n,e)=>n+e.count,0)*multiplier();
  return `${pageHead("Event analytics","Events",`Understand which event names are growing, when they happen, and inspect the exact accepted records for ${p.name}.`,`${rangeControl()}<button class="button">Save view</button>`)}<section class="event-summary"><article class="event-total"><div><p class="eyebrow">Filtered event count</p><strong>${fmt(total)}</strong><p>${rows.length} automatically discovered event names</p></div><footer><span>${p.name} only</span><span>${state.range}</span></footer></article><article class="panel"><div class="panel-head"><div><h2>Filtered event trend</h2><p>Counts update with every filter below</p></div><span class="badge good">project scoped</span></div>${svgChart(p.events%7,true)}</article></section><section class="grid equal" style="margin-bottom:20px"><article class="panel"><div class="panel-head"><div><h2>Count by event name</h2><p>What users are doing across this filter window</p></div><span class="mono">${fmt(total)}</span></div><div class="panel-body">${bars(6)}</div></article><article class="panel"><div class="panel-head"><div><h2>Event momentum</h2><p>Change against the previous matching window</p></div></div><ul class="list">${rows.map(e=>`<li class="list-row"><span><span class="row-title">${e.name}</span><span class="row-meta">${fmt(e.count*multiplier())} events</span></span><span class="${e.trend<0?"badge warn":"badge good"}">${e.trend>0?"+":""}${e.trend}%</span></li>`).join("")}</ul></article></section><section class="panel"><div class="events-toolbar"><div class="filterbar"><label class="search-wrap"><span class="sr-only">Search event names</span><input class="search" data-event-query value="${state.query}" placeholder="Search event names"></label><select class="select" data-source aria-label="Filter by source"><option value="all" ${state.source==="all"?"selected":""}>All sources</option><option value="browser" ${state.source==="browser"?"selected":""}>Browser</option><option value="server" ${state.source==="server"?"selected":""}>Server</option></select><button class="button">+ Filter</button></div><button class="button">Columns</button></div><div class="table-wrap"><table><thead><tr><th style="width:30%">Event</th><th>Count</th><th>Source</th><th>Route</th><th>Latest</th><th>Trend</th></tr></thead><tbody>${rows.map((e,i)=>`<tr data-open-event="${e.name}"><td class="event-cell"><strong>${e.name}</strong><small>auto-discovered</small></td><td class="numeric">${fmt(e.count*multiplier())}</td><td><span class="badge">${e.source}</span></td><td class="mono">${e.route}</td><td>${i*3+1}m ago</td><td><span class="${e.trend<0?"badge warn":"badge good"}">${e.trend>0?"+":""}${e.trend}%</span></td></tr>`).join("")}</tbody></table></div><footer class="table-foot"><span>${rows.length} event names · ${fmt(total)} events</span><span>Rows open event detail</span></footer></section>`;
}

function livePage() {
  const p=projects[state.project];
  return `${pageHead("Live stream","Live events",`Watch accepted events arrive for ${p.name}. This stream never mixes data from another project.`, `<span class="live-indicator">Connected</span><button class="button">Pause</button>`)}<section class="grid"><article class="panel"><div class="panel-head"><div><h2>Incoming now</h2><p>Newest first · refreshes automatically</p></div><span class="badge good">18s ago</span></div><ul class="timeline">${[...p.eventsList,...p.eventsList.slice(0,3)].map((e,i)=>`<li data-open-event="${e.name}"><span class="timeline-dot"></span><span><span class="row-title">${e.name}</span><span class="row-meta">${e.source} · ${e.route}</span></span><time>${String(14-Math.floor(i/5)).padStart(2,"0")}:${String(58-i*4).padStart(2,"0")}:${String(42-i*3).padStart(2,"0")}</time></li>`).join("")}</ul></article><aside class="stack"><article class="panel"><div class="panel-head"><div><h2>Last 15 minutes</h2><p>Delivery pulse</p></div></div><div class="panel-body"><div class="metric" style="border:0;padding:4px"><span>Accepted events</span><strong>${fmt(p.events*.043)}</strong><small>+9.7% vs prior 15m</small></div><div class="mini-bars">${[18,28,15,34,41,25,47,54,39,62,48,72,66,82,76,91,68,88].map(n=>`<i style="height:${n}%"></i>`).join("")}</div></div></article><article class="panel"><div class="panel-head"><div><h2>Delivery checks</h2><p>Project collector boundary</p></div></div><ul class="list"><li class="list-row"><span>Allowed origin</span><span class="badge good">passing</span></li><li class="list-row"><span>Client key</span><span class="badge good">valid</span></li><li class="list-row"><span>Server signature</span><span class="badge good">verified</span></li><li class="list-row"><span>Schema</span><span class="badge good">v1</span></li></ul></article></aside></section>`;
}

function insightsPage() {
  const p=projects[state.project];
  return `${pageHead("Project insights","Insights",`A focused explanation of ${p.name}'s event mix. No funnels, replay, or identity profiles.`,rangeControl())}${metrics()}<section class="grid equal"><article class="panel"><div class="panel-head"><div><h2>Top event names</h2><p>Share of all accepted events</p></div></div><div class="panel-body">${bars(6)}</div></article><article class="panel"><div class="panel-head"><div><h2>Source mix</h2><p>Browser proxy vs trusted server</p></div></div><div class="panel-body"><div style="display:grid;place-items:center;min-height:230px"><div style="width:180px;height:180px;border-radius:50%;background:conic-gradient(var(--accent) 0 61%,var(--surface-2) 61% 100%);display:grid;place-items:center"><div style="width:116px;height:116px;border-radius:50%;background:var(--surface);display:grid;place-items:center;text-align:center"><strong class="mono" style="font-size:24px">61%</strong><small>browser</small></div></div></div></div></article><article class="panel"><div class="panel-head"><div><h2>Top routes</h2><p>Pathname only, no full URLs</p></div></div><ul class="list">${p.eventsList.filter(e=>e.route!=="—").slice(0,5).map((e,i)=>`<li class="list-row"><span><strong class="mono">${e.route}</strong><span class="row-meta">${e.name}</span></span><strong class="mono">${fmt(e.count*.74)}</strong></li>`).join("")}</ul></article><article class="panel"><div class="panel-head"><div><h2>Visitor mix</h2><p>Project-scoped visitor-days</p></div></div><div class="panel-body"><div class="bar-list"><div><div class="bar-top"><span>returning</span><strong>${Math.round(p.returning/p.visitors*100)}%</strong></div><div class="bar-track"><div class="bar-fill" style="width:${p.returning/p.visitors*100}%"></div></div></div><div><div class="bar-top"><span>new</span><strong>${Math.round((p.visitors-p.returning)/p.visitors*100)}%</strong></div><div class="bar-track"><div class="bar-fill" style="width:${(p.visitors-p.returning)/p.visitors*100}%"></div></div></div></div></div></article></section>`;
}

function settingsPage() {
  const p=projects[state.project];
  return `${pageHead("Project configuration","Settings",`Origins, credentials, retention, and privacy rules for ${p.name}. These settings never apply across projects.`,`<button class="button primary">Save changes</button>`)}<section class="settings-layout"><nav class="settings-nav" aria-label="Settings sections"><button class="active">General</button><button>Collection</button><button>API keys</button><button>Data & privacy</button><button>Danger zone</button></nav><div><article class="panel settings-section"><div class="panel-head"><div><h2>Project identity</h2><p>The slug is generated from the project name</p></div></div><div class="form-row"><label>Project name<small>Shown throughout this workspace</small></label><input class="field" value="${p.name}"></div><div class="form-row"><label>Project slug<small>Generated automatically</small></label><input class="field mono" value="${p.name.toLowerCase().replaceAll(" ","-")}" disabled></div></article><article class="panel settings-section"><div class="panel-head"><div><h2>Collection</h2><p>Trusted boundaries for this project</p></div><span class="badge good">Healthy</span></div><div class="form-row"><label>Allowed origins<small>One HTTPS origin per line</small></label><textarea class="field" style="min-height:88px;padding-top:10px">https://${p.domain}</textarea></div><div class="form-row"><label>Client ingest key<small>Safe only in the same-origin proxy</small></label><div class="code-field"><span>lgly_client_••••••••••8f2a</span><button class="button">Rotate</button></div></div><div class="form-row"><label>Server write key<small>Keep on trusted servers only</small></label><div class="code-field"><span>lgly_server_••••••••••c931</span><button class="button">Rotate</button></div></div></article><article class="panel settings-section"><div class="panel-head"><div><h2>Data and privacy</h2><p>Thin analytics, bounded collection</p></div></div><div class="form-row"><label>Retention<small>Automatic event cleanup</small></label><select class="field"><option>90 days</option><option>30 days</option><option>180 days</option></select></div><div class="form-row"><label>Collection policy<small>Cannot be disabled per project</small></label><div><span class="badge good">Privacy guardrails active</span><p style="color:var(--muted)">No email addresses, raw authenticated IDs, form values, or cross-project identity.</p></div></div></article></div></section>`;
}

function renderShell() {
  const p=projects[state.project];
  app.innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="brand" href="#overview"><span class="brand-mark">LY</span><span>Logly</span></a><div class="project-switcher"><button class="project-button" aria-expanded="false"><span class="project-logo">${p.mark}</span><span class="project-copy"><span class="project-name">${p.name}</span><span class="project-org">${p.org} · project workspace</span></span><span>⌄</span></button><div class="project-menu"><div class="project-menu-label">Switch project</div>${Object.entries(projects).map(([key,item])=>`<button class="project-option ${key===state.project?"active":""}" data-project="${key}"><span>${item.mark}</span><span><strong>${item.name}</strong><small>${item.org}</small></span><b class="project-check">${key===state.project?"✓":""}</b></button>`).join("")}<div class="project-menu-label">Manage in settings, not navigation</div></div></div><nav class="nav"><div class="nav-label">${p.name}</div>${Object.entries(pageNames).map(([key,name])=>`<button class="nav-link ${state.page===key?"active":""}" data-page="${key}"><span class="nav-icon">${pageIcons[key]}</span><span>${name}</span></button>`).join("")}</nav><footer class="sidebar-foot"><div class="health"><span class="health-dot"></span>Collector healthy</div><div>Last ${p.name} event 18s ago</div></footer></aside><div class="main"><header class="topbar"><div class="breadcrumb"><span>${p.org}</span><i>/</i><strong>${p.name}</strong><i>/</i><span>${pageNames[state.page]}</span></div><div class="top-actions"><span class="badge">${variant.name}</span><button class="icon-button" aria-label="Help">?</button><button class="icon-button" aria-label="Account">IY</button></div></header><main class="content" id="page"></main></div></div><nav class="mobile-bar" aria-label="Mobile navigation">${Object.entries(pageNames).map(([key,name])=>`<button class="${state.page===key?"active":""}" data-page="${key}"><span>${pageIcons[key]}</span>${name}</button>`).join("")}</nav><dialog class="detail"><header class="detail-head"><div><strong data-detail-name>Event detail</strong><div class="row-meta">${p.name} · ${p.org}</div></div><button class="icon-button" data-close aria-label="Close">×</button></header><div class="detail-body"><span class="badge good">Accepted</span><h2>Event record</h2><dl class="properties"><dt>Project</dt><dd>${p.name}</dd><dt>Source</dt><dd data-detail-source>server</dd><dt>Version</dt><dd>1</dd><dt>Received</dt><dd>2026-09-04 14:58:42</dd><dt>Visitor</dt><dd>project-scoped</dd></dl><p style="color:var(--muted)">No email, raw authenticated ID, form value, or cross-project identity is stored.</p></div></dialog>`;
  renderPage();
  bindShell();
}

function renderPage() {
  const target=document.querySelector("#page");
  const renderers={overview:overviewPage,events:eventsPage,live:livePage,insights:insightsPage,settings:settingsPage};
  target.innerHTML=renderers[state.page]();
  bindPage();
  prepareText();
}

function bindShell() {
  const button=document.querySelector(".project-button"), menu=document.querySelector(".project-menu");
  button.addEventListener("click",()=>{ const open=menu.classList.toggle("open"); button.setAttribute("aria-expanded",String(open)); });
  document.querySelectorAll("[data-project]").forEach(el=>el.addEventListener("click",()=>{ state.project=el.dataset.project; const url=new URL(location.href); url.searchParams.set("project",state.project); history.replaceState({},"",url); renderShell(); }));
  document.querySelectorAll("[data-page]").forEach(el=>el.addEventListener("click",()=>navigate(el.dataset.page)));
  document.querySelector("[data-close]").addEventListener("click",()=>document.querySelector(".detail").close());
}
function navigate(page) { state.page=page; location.hash=page; renderShell(); window.scrollTo({top:0,behavior:"smooth"}); }
function bindPage() {
  document.querySelectorAll("[data-range]").forEach(el=>el.addEventListener("click",()=>{state.range=el.dataset.range;renderPage();}));
  document.querySelector("[data-source]")?.addEventListener("change",e=>{state.source=e.target.value;renderPage();});
  document.querySelector("[data-event-query]")?.addEventListener("input",e=>{state.query=e.target.value;renderPage();document.querySelector("[data-event-query]")?.focus();});
  document.querySelectorAll("[data-page]").forEach(el=>el.addEventListener("click",()=>navigate(el.dataset.page)));
  document.querySelectorAll("[data-open-event]").forEach(el=>el.addEventListener("click",()=>{ const name=el.dataset.openEvent, event=projects[state.project].eventsList.find(x=>x.name===name); document.querySelector("[data-detail-name]").textContent=name; document.querySelector("[data-detail-source]").textContent=event?.source||"server"; document.querySelector(".detail").showModal(); }));
}

let prepared=new Map();
async function prepareText() {
  await document.fonts.ready;
  prepared=new Map();
  document.querySelectorAll("[data-pretext]").forEach(el=>prepared.set(el,prepare(el.textContent||"",getComputedStyle(el).font)));
  relayout();
  document.querySelectorAll("[data-pretext]").forEach(el=>new MutationObserver(()=>{prepared.set(el,prepare(el.textContent||"",getComputedStyle(el).font));relayout();}).observe(el,{characterData:true,childList:true,subtree:true}));
}
function relayout(){ for(const [el,handle] of prepared){ if(!el.clientWidth)continue; const lh=parseFloat(getComputedStyle(el).lineHeight)||21; el.style.minHeight=`${Math.ceil(layout(handle,el.clientWidth,lh).height)}px`; } }
new ResizeObserver(relayout).observe(document.body);
window.addEventListener("hashchange",()=>{const next=location.hash.slice(1);if(pageNames[next]){state.page=next;renderShell();}});
renderShell();
