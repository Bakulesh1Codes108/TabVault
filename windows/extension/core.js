// AUTO-GENERATED from app/TabVault.js by tools/sync-core.js – do not edit here.
// TabVault – save all Safari tabs to PDF + HTML + CSV log in ~/Downloads/TabVault, then close them.
// Safety: only creates new files / appends to the log inside Downloads/TabVault. Never deletes files.
// Tabs are closed ONLY after the files are verified on disk.

function archivable(u) { return /^(https?|file|ftp):/i.test(u || ""); }
function pad(n) { return String(n).padStart(2, "0"); }

/* ---------------- PDF (dependency-free, clickable links) ---------------- */
var PW = 595, PH = 842, PM = 48, LINE_W = PW - 2 * PM;
var MAP = { "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "...", " ": " ", "•": "*" };
function clean(s) {
  s = String(s == null ? "" : s).replace(/[‘’“”–—… •]/g, function (c) { return MAP[c]; });
  var out = "";
  for (var ch of s) { var c = ch.codePointAt(0); out += c < 32 ? " " : (c <= 255 ? ch : "?"); }
  return out.replace(/\?{2,}/g, "??");
}
function pesc(s) { return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
function wrap(text, size, bold, maxW) {
  var cw = size * (bold ? 0.56 : 0.52), max = Math.max(8, Math.floor(maxW / cw));
  var words = text.split(/\s+/).filter(Boolean), lines = [], cur = "";
  words.forEach(function (w) {
    while (w.length > max) { if (cur) { lines.push(cur); cur = ""; } lines.push(w.slice(0, max)); w = w.slice(max); }
    if (!cur) cur = w; else if ((cur + " " + w).length <= max) cur += " " + w; else { lines.push(cur); cur = w; }
  });
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}
function buildPdf(s) {
  var pages = [], page, y;
  function newPage() { page = { ops: [], annots: [] }; pages.push(page); y = PH - PM; }
  function ensure(h) { if (y - h < PM + 20) newPage(); }
  function text(str, x, yy, size, bold, rgb) { page.ops.push("BT /" + (bold ? "F2" : "F1") + " " + size + " Tf " + (rgb || "0.1 0.1 0.12") + " rg " + x + " " + yy.toFixed(1) + " Td (" + pesc(str) + ") Tj ET"); }
  newPage();
  text("TabVault - Closed Tabs", PM, y - 20, 22, true, "0.13 0.28 0.75"); y -= 34;
  text(clean(s.localDate + " at " + s.localTime + "  |  " + s.count + " tab(s) in " + s.windows.length + " window(s)"), PM, y - 12, 11, false, "0.35 0.35 0.4"); y -= 22;
  page.ops.push("0.8 0.82 0.88 RG 0.8 w " + PM + " " + y + " m " + (PW - PM) + " " + y + " l S"); y -= 14;
  var n = 0;
  s.windows.forEach(function (win, wi) {
    ensure(40);
    text("Window " + (wi + 1) + "  (" + win.tabs.length + " tab" + (win.tabs.length === 1 ? "" : "s") + ")", PM, y - 13, 13, true, "0.2 0.2 0.25"); y -= 24;
    win.tabs.forEach(function (t) {
      n++;
      var tl = wrap(n + ". " + clean(t.title || t.url), 11, true, LINE_W), ul = wrap(clean(t.url), 9, false, LINE_W - 14);
      ensure(tl.length * 14 + ul.length * 11 + 10);
      tl.forEach(function (l) { text(l, PM, y - 11, 11, true); y -= 14; });
      var top = y;
      ul.forEach(function (l) { text(l, PM + 14, y - 9, 9, false, "0.1 0.35 0.85"); y -= 11; });
      page.annots.push({ x1: PM + 12, y1: y - 1, x2: PW - PM, y2: top + 1, url: t.url });
      y -= 9;
    });
    y -= 6;
  });
  var objs = [];
  function add(o) { objs.push(o); return objs.length; }
  var catalog = add(null), pagesId = add(null);
  var f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  var f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  var kids = [];
  pages.forEach(function (p, i) {
    p.ops.push("BT /F1 8 Tf 0.55 0.55 0.6 rg " + PM + " 24 Td (TabVault  -  page " + (i + 1) + " of " + pages.length + ") Tj ET");
    var stream = p.ops.join("\n");
    var content = add("<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream");
    var ann = p.annots.map(function (a) {
      return add("<< /Type /Annot /Subtype /Link /Rect [" + a.x1 + " " + a.y1.toFixed(1) + " " + a.x2 + " " + a.y2.toFixed(1) + "] /Border [0 0 0] /A << /S /URI /URI (" + pesc(clean(a.url)) + ") >> >>");
    });
    kids.push(add("<< /Type /Page /Parent " + pagesId + " 0 R /MediaBox [0 0 " + PW + " " + PH + "] /Resources << /Font << /F1 " + f1 + " 0 R /F2 " + f2 + " 0 R >> >> /Contents " + content + " 0 R" +
      (ann.length ? " /Annots [" + ann.map(function (id) { return id + " 0 R"; }).join(" ") + "]" : "") + " >>"));
  });
  objs[catalog - 1] = "<< /Type /Catalog /Pages " + pagesId + " 0 R >>";
  objs[pagesId - 1] = "<< /Type /Pages /Kids [" + kids.map(function (k) { return k + " 0 R"; }).join(" ") + "] /Count " + kids.length + " >>";
  var out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", offsets = [];
  objs.forEach(function (o, i) { offsets.push(out.length); out += (i + 1) + " 0 obj\n" + o + "\nendobj\n"; });
  var xref = out.length;
  out += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n" + offsets.map(function (o) { return String(o).padStart(10, "0") + " 00000 n \n"; }).join("");
  out += "trailer\n<< /Size " + (objs.length + 1) + " /Root " + catalog + " 0 R /Info << /Title (TabVault " + pesc(clean(s.localDate + " " + s.localTime)) + ") /Producer (TabVault) >> >>\nstartxref\n" + xref + "\n%%EOF";
  return out; // every char <= 0xFF -> written as Latin-1 bytes
}

/* ---------------- HTML + CSV ---------------- */
function h(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function host(u) { var m = /^[a-z]+:\/\/([^\/?#]+)/i.exec(u || ""); return m ? m[1].replace(/^www\./, "") : ""; }
var CSS = ":root{--bg:#f6f7fb;--card:#fff;--fg:#1b1d24;--mut:#6b7080;--ac:#2453d6;--bd:#e3e6ee}@media(prefers-color-scheme:dark){:root{--bg:#121318;--card:#1b1d25;--fg:#e9eaf0;--mut:#9095a6;--ac:#7aa2ff;--bd:#2b2e3a}}*{box-sizing:border-box}body{margin:0;font:15px/1.45 -apple-system,BlinkMacSystemFont,sans-serif;background:var(--bg);color:var(--fg)}main{max-width:860px;margin:auto;padding:28px 16px 60px}h1{margin:0 0 4px;font-size:26px}.meta{color:var(--mut);margin-bottom:18px}.bar{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap}input{flex:1;min-width:180px;padding:10px 12px;border-radius:10px;border:1px solid var(--bd);background:var(--card);color:var(--fg);font:inherit}button,.btn{padding:10px 14px;border-radius:10px;border:0;background:var(--ac);color:#fff;font:inherit;cursor:pointer;text-decoration:none}section{background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:6px 16px;margin-bottom:14px}h2{font-size:15px;margin:12px 0 4px}h2 span{color:var(--mut);font-weight:400;margin-left:6px}ol{list-style:none;padding:0;margin:0}li{display:flex;gap:12px;padding:10px 0;border-top:1px solid var(--bd)}li:first-child{border-top:0}.ic{flex:none;width:28px;height:28px;border-radius:8px;background:var(--bg);display:grid;place-items:center;font-weight:600;color:var(--ac)}li div{min-width:0}a{color:var(--fg);font-weight:600;text-decoration:none}a:hover{color:var(--ac)}small{display:block;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hide{display:none}";
var FILTER_JS = "q.oninput=function(){var v=q.value.toLowerCase();document.querySelectorAll('li').forEach(function(l){l.classList.toggle('hide',l.textContent.toLowerCase().indexOf(v)<0)})};";
function buildHtml(s) {
  var n = 0;
  var groups = s.windows.map(function (w, i) {
    var items = w.tabs.map(function (t) { n++; var d = host(t.url); return '<li><span class="ic">' + h((d[0] || "•").toUpperCase()) + '</span><div><a href="' + h(t.url) + '" target="_blank" rel="noopener">' + h(t.title || t.url) + "</a><small>" + h(d) + " · " + h(t.url) + "</small></div></li>"; }).join("");
    return "<section><h2>Window " + (i + 1) + " <span>" + w.tabs.length + " tab" + (w.tabs.length === 1 ? "" : "s") + "</span></h2><ol>" + items + "</ol></section>";
  }).join("");
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tabs ' + h(s.localDate) + " " + h(s.localTime) + "</title><style>" + CSS + "</style></head><body><main>" +
    '<h1>Closed tabs</h1><div class="meta">' + h(s.localDate) + " at " + h(s.localTime) + " · " + s.count + " tabs · " + s.windows.length + " window(s) · <a href=\"All%20sessions.html\">All sessions</a></div>" +
    '<div class="bar"><input id="q" placeholder="Filter by title or address…"><button id="all">Reopen all</button></div>' + groups +
    "</main><script>" + FILTER_JS + "all.onclick=function(){var l=[].slice.call(document.querySelectorAll('li:not(.hide) a'));if(l.length>15&&!confirm('Open '+l.length+' tabs?'))return;l.forEach(function(a){window.open(a.href,'_blank')})};</script></body></html>";
}
function csv(v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }
function buildLog(s) {
  var i = 0, lines = [];
  s.windows.forEach(function (w, wi) { w.tabs.forEach(function (t) { lines.push([s.localDate, s.localTime, s.stamp, wi + 1, ++i, t.title, t.url].map(csv).join(",")); }); });
  return lines.join("\n") + "\n";
}
function makeSession(wins) {
  var d = new Date(), seen = {}, out = [], count = 0;
  wins.forEach(function (w) {
    var tabs = [];
    w.urls.forEach(function (u, j) { if (archivable(u) && !seen[u]) { seen[u] = 1; tabs.push({ title: w.names[j] || "", url: u }); count++; } });
    if (tabs.length) out.push({ tabs: tabs });
  });
  return {
    stamp: d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + "." + pad(d.getMinutes()) + "." + pad(d.getSeconds()),
    localDate: d.toLocaleDateString("en-IN", { weekday: "short", year: "numeric", month: "short", day: "numeric" }),
    localTime: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    count: count, windows: out, saved: seen
  };
}

/* ---------------- Timeline page (All sessions.html) ---------------- */
// A scrollable, clickable timeline of every saved session. Clicking a session opens its PDF.
var FILE_RE = /^Tabs (\d{4})-(\d\d)-(\d\d) (\d\d)\.(\d\d)\.(\d\d)( \(\d+\))?\.(pdf|html)$/;
var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
var WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function clock(hh, mi) { return (hh % 12 || 12) + ":" + pad(mi) + " " + (hh < 12 ? "am" : "pm"); }
function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }

// Pairs "Tabs <stamp>.pdf" with "Tabs <stamp>.html"; newest first.
function sessionsFromFiles(files) {
  var by = {}, list = [];
  (files || []).forEach(function (f) {
    var m = FILE_RE.exec(f); if (!m) return;
    var base = f.replace(/\.(pdf|html)$/, "");
    if (!by[base]) {
      by[base] = { base: base, stamp: m[1] + "-" + m[2] + "-" + m[3] + " " + m[4] + "." + m[5] + "." + m[6],
                   y: +m[1], mo: +m[2], d: +m[3], hh: +m[4], mi: +m[5] };
      list.push(by[base]);
    }
    by[base][m[8]] = f;
  });
  return list.sort(function (a, b) { return a.base < b.base ? 1 : a.base > b.base ? -1 : 0; });
}

// Reads TabVault Log.csv → per-session tab count, top sites and searchable titles.
function logStats(text) {
  var F = '"((?:[^"]|"")*)"', row = new RegExp("^\\uFEFF?" + [F, F, F, F, F, F, F].join(",") + "\\s*$"), stats = {};
  function unq(s) { return s.replace(/""/g, '"'); }
  String(text || "").split(/\r?\n/).forEach(function (line) {
    var m = row.exec(line); if (!m) return;
    var key = unq(m[3]), st = stats[key] || (stats[key] = { count: 0, hosts: {}, text: "" });
    var d = host(unq(m[7]));
    st.count++;
    if (d) st.hosts[d] = (st.hosts[d] || 0) + 1;
    if (st.text.length < 4000) st.text += " " + unq(m[6]) + " " + d;
  });
  return stats;
}
function topHosts(hosts, n) {
  return Object.keys(hosts || {}).sort(function (a, b) { return hosts[b] - hosts[a] || (a < b ? -1 : 1); }).slice(0, n);
}

var TL_CSS = "header.top{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--bd)}.top-in{max-width:860px;margin:auto;padding:22px 16px 6px}.top-in .bar{margin-bottom:6px}main{padding-top:4px}" +
  ".strip{position:relative;display:flex;align-items:flex-end;gap:2px;overflow-x:auto;padding:4px 2px 10px;scrollbar-width:thin}" +
  ".chip{flex:none;width:44px;padding:4px 0 6px;border:1px solid transparent;border-radius:10px;background:none;color:var(--fg);display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;font:inherit}" +
  ".chip .m{font-size:10px;height:13px;line-height:13px;color:var(--ac);font-weight:700;text-transform:uppercase;letter-spacing:.05em}" +
  ".chip .bar{width:8px;height:38px;margin:0;border-radius:4px;background:var(--bd);display:flex;align-items:flex-end;overflow:hidden}.chip .bar i{display:block;width:100%;min-height:4px;background:var(--ac);border-radius:4px}" +
  ".chip b{font-size:14px;line-height:1.1}.chip small{font-size:10px;color:var(--mut);white-space:normal}.chip:hover{background:var(--card);border-color:var(--bd)}.chip.on{background:var(--card);border-color:var(--ac)}.chip.dim{opacity:.3}" +
  ".day{scroll-margin-top:200px;margin-top:24px}.day h2{font-size:15px;margin:0 0 10px;display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center}.day h2 em{font-style:normal;color:var(--mut);font-weight:400;font-size:13px;margin-left:0}" +
  ".rel{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#fff;background:var(--ac);border-radius:6px;padding:2px 7px}" +
  ".tl{list-style:none;margin:0;padding:0 0 0 24px;position:relative}.tl:before{content:'';position:absolute;left:7px;top:8px;bottom:8px;width:2px;border-radius:2px;background:var(--bd)}" +
  "li.ev{position:relative;display:flex;gap:6px;padding:0;margin:0 0 8px;border-top:0}" +
  ".dot{position:absolute;left:-22px;top:50%;width:12px;height:12px;margin-top:-6px;border-radius:50%;background:var(--bg);border:2px solid var(--ac);transition:background .15s}li.ev:hover .dot{background:var(--ac)}" +
  "a.node{flex:1;min-width:0;display:flex;align-items:center;gap:14px;padding:12px 14px;background:var(--card);border:1px solid var(--bd);border-radius:12px;color:var(--fg);font-weight:400;transition:border-color .15s,transform .15s}" +
  "a.node:hover,a.node:focus-visible{border-color:var(--ac);outline:none;transform:translateX(3px);color:var(--fg)}" +
  "time{flex:none;width:68px;color:var(--mut);font-size:13px;font-variant-numeric:tabular-nums}.what{flex:1;min-width:0}.what b{display:block}.go{flex:none;color:var(--ac);font-weight:600;font-size:13px}" +
  "a.alt{flex:none;display:grid;place-items:center;padding:0 12px;background:var(--card);border:1px solid var(--bd);border-radius:12px;color:var(--mut);font-size:12px;font-weight:600}a.alt:hover{border-color:var(--ac)}" +
  ".empty{background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:28px;text-align:center;color:var(--mut)}" +
  "@media(max-width:560px){.go{display:none}time{width:58px}a.node{gap:10px}}";

var TL_JS = "(function(){var strip=document.getElementById('strip'),q=document.getElementById('q'),chips=[].slice.call(document.querySelectorAll('.chip')),days=[].slice.call(document.querySelectorAll('.day'));" +
  "if(strip)strip.scrollLeft=strip.scrollWidth;" +
  "function k(d){return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}var now=new Date(),rel={};rel[k(now)]='Today';rel[k(new Date(now.getTime()-864e5))]='Yesterday';" +
  "days.forEach(function(s){var r=rel[s.getAttribute('data-day')];if(r){var b=document.createElement('span');b.className='rel';b.textContent=r;var h2=s.querySelector('h2');h2.insertBefore(b,h2.firstChild)}});" +
  "var lock=0;function mark(key){chips.forEach(function(c){var on=c.getAttribute('data-day')===key;c.classList.toggle('on',on);if(on&&strip)strip.scrollTo({left:c.offsetLeft-strip.clientWidth/2+c.offsetWidth/2,behavior:'smooth'})})}" +
  "chips.forEach(function(c){c.onclick=function(){var s=document.getElementById('d-'+c.getAttribute('data-day'));if(!s||s.classList.contains('hide'))return;lock=Date.now();mark(c.getAttribute('data-day'));var top=document.querySelector('header.top');window.scrollTo({top:s.getBoundingClientRect().top+window.pageYOffset-(top?top.offsetHeight:0)-12,behavior:'smooth'})}});" +
  "if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){if(Date.now()-lock<900)return;es.forEach(function(e){if(e.isIntersecting)mark(e.target.getAttribute('data-day'))})},{rootMargin:'-'+((document.querySelector('header.top')||{}).offsetHeight||200)+'px 0px -55% 0px'});days.forEach(function(s){io.observe(s)})}" +
  "if(days[0])mark(days[0].getAttribute('data-day'));" +
  "if(q)q.oninput=function(){var v=q.value.toLowerCase().trim();days.forEach(function(s){var any=false;[].forEach.call(s.querySelectorAll('.ev'),function(e){var hit=!v||e.getAttribute('data-q').indexOf(v)>=0;e.classList.toggle('hide',!hit);any=any||hit});s.classList.toggle('hide',!any);" +
  "var c=document.querySelector('.chip[data-day=\"'+s.getAttribute('data-day')+'\"]');if(c)c.classList.toggle('dim',!any)})};})();";

function buildIndex(sessions, stats) {
  stats = stats || {};
  var days = [], byDay = {}, totalTabs = 0;
  sessions.forEach(function (s) {
    var key = s.y + "-" + pad(s.mo) + "-" + pad(s.d), st = stats[s.stamp] || null;
    if (!byDay[key]) { byDay[key] = { key: key, s: s, items: [], tabs: 0 }; days.push(byDay[key]); }
    byDay[key].items.push({ s: s, st: st });
    if (st) { byDay[key].tabs += st.count; totalTabs += st.count; }
  });
  var size = function (d) { return d.tabs || d.items.length; };
  var max = Math.max.apply(null, days.map(size).concat([1]));

  // Horizontal day strip: oldest → newest, scrolled to the newest end on load.
  var lastMonth = "", chips = days.slice().reverse().map(function (d) {
    var s = d.s, wd = new Date(s.y, s.mo - 1, s.d).getDay(), mk = s.y + "-" + s.mo;
    var m = mk !== lastMonth ? MON[s.mo - 1] : ""; lastMonth = mk;
    var tip = WEEKDAY[wd] + " " + s.d + " " + MONTH[s.mo - 1] + " " + s.y + " – " + plural(d.items.length, "session") + (d.tabs ? ", " + plural(d.tabs, "tab") : "");
    return '<button class="chip" data-day="' + d.key + '" title="' + h(tip) + '"><span class="m">' + m + '</span><span class="bar"><i style="height:' + Math.max(10, Math.round(100 * size(d) / max)) + '%"></i></span><b>' + s.d + "</b><small>" + WD[wd] + "</small></button>";
  }).join("");

  // Vertical timeline grouped by day, newest first.
  var body = days.map(function (d) {
    var s = d.s, wd = new Date(s.y, s.mo - 1, s.d).getDay(), label = s.d + " " + MONTH[s.mo - 1] + " " + s.y;
    var items = d.items.map(function (it) {
      var x = it.s, st = it.st, hosts = st ? topHosts(st.hosts, 3) : [], more = st ? Object.keys(st.hosts).length - hosts.length : 0;
      var target = x.pdf || x.html, when = clock(x.hh, x.mi);
      var line = hosts.length ? hosts.join(" · ") + (more > 0 ? "  +" + more + " more" : "") : (x.pdf ? x.pdf : x.html);
      var q = (WEEKDAY[wd] + " " + label + " " + x.stamp + " " + when + " " + hosts.join(" ") + (st ? st.text : "")).toLowerCase();
      return '<li class="ev" data-q="' + h(q) + '"><span class="dot"></span><a class="node" href="' + encodeURIComponent(target) + '" target="_blank" title="Open ' + h(target) + '">' +
        "<time>" + when + '</time><span class="what"><b>' + (st ? plural(st.count, "tab") : "Saved session") + "</b><small>" + h(line) + "</small></span>" +
        '<span class="go">' + (x.pdf ? "Open PDF ›" : "Open page ›") + "</span></a>" +
        (x.pdf && x.html ? '<a class="alt" href="' + encodeURIComponent(x.html) + '" target="_blank" title="Clickable HTML page with Reopen all">HTML</a>' : "") + "</li>";
    }).join("");
    return '<section class="day" id="d-' + d.key + '" data-day="' + d.key + '"><h2>' + WEEKDAY[wd] + ", " + label + " <em>" + plural(d.items.length, "session") + (d.tabs ? " · " + plural(d.tabs, "tab") : "") + '</em></h2><ol class="tl">' + items + "</ol></section>";
  }).join("");

  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TabVault – Timeline</title><style>' + CSS + TL_CSS + "</style></head><body>" +
    '<header class="top"><div class="top-in"><h1>TabVault</h1><div class="meta">' + plural(sessions.length, "saved session") + (totalTabs ? " · " + plural(totalTabs, "tab") : "") + ' · <a href="TabVault%20Log.csv">Full log (CSV)</a></div>' +
    '<div class="bar"><input id="q" placeholder="Search by date, site or page title…"></div>' + (days.length ? '<div class="strip" id="strip">' + chips + "</div>" : "") + "</div></header>" +
    "<main>" + (body || '<div class="empty">No saved sessions yet. Click the TabVault button in your browser toolbar to save your first one.</div>') + "</main><script>" + TL_JS + "</script></body></html>";
}

