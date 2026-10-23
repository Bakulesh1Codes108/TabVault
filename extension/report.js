// Builds the standalone HTML archive page and the CSV log lines.
(function (g) {
  const h = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

  function buildHtml(s) {
    let n = 0;
    const groups = s.windows.map((w, i) => `
      <section><h2>Window ${i + 1} <span>${w.tabs.length} tab${w.tabs.length === 1 ? "" : "s"}</span></h2><ol start="${n + 1}">
      ${w.tabs.map(t => { n++; const d = host(t.url); return `<li><span class="ic">${h((d[0] || "•").toUpperCase())}</span><div><a href="${h(t.url)}" target="_blank" rel="noopener">${h(t.title || t.url)}</a><small>${h(d)} · ${h(t.url)}</small></div></li>`; }).join("")}
      </ol></section>`).join("");
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tabs ${h(s.localDate)} ${h(s.localTime)}</title><style>
:root{--bg:#f6f7fb;--card:#fff;--fg:#1b1d24;--mut:#6b7080;--ac:#2453d6;--bd:#e3e6ee}
@media(prefers-color-scheme:dark){:root{--bg:#121318;--card:#1b1d25;--fg:#e9eaf0;--mut:#9095a6;--ac:#7aa2ff;--bd:#2b2e3a}}
*{box-sizing:border-box}body{margin:0;font:15px/1.45 -apple-system,BlinkMacSystemFont,sans-serif;background:var(--bg);color:var(--fg)}
main{max-width:860px;margin:auto;padding:28px 16px 60px}h1{margin:0 0 4px;font-size:26px}.meta{color:var(--mut);margin-bottom:18px}
.bar{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap}input{flex:1;min-width:180px;padding:10px 12px;border-radius:10px;border:1px solid var(--bd);background:var(--card);color:var(--fg);font:inherit}
button{padding:10px 14px;border-radius:10px;border:0;background:var(--ac);color:#fff;font:inherit;cursor:pointer}
section{background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:6px 16px;margin-bottom:14px}
h2{font-size:15px;margin:12px 0 4px}h2 span{color:var(--mut);font-weight:400;margin-left:6px}ol{list-style:none;padding:0;margin:0}
li{display:flex;gap:12px;padding:10px 0;border-top:1px solid var(--bd)}li:first-child{border-top:0}
.ic{flex:none;width:28px;height:28px;border-radius:8px;background:var(--bg);display:grid;place-items:center;font-weight:600;color:var(--ac)}
li div{min-width:0}a{color:var(--fg);font-weight:600;text-decoration:none}a:hover{color:var(--ac)}
small{display:block;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hide{display:none}
</style></head><body><main><h1>Closed tabs</h1>
<div class="meta">${h(s.localDate)} at ${h(s.localTime)} · ${s.count} tab${s.count === 1 ? "" : "s"} · ${s.windows.length} window${s.windows.length === 1 ? "" : "s"}</div>
<div class="bar"><input id="q" placeholder="Filter by title or address…"><button id="all">Open all</button></div>${groups}
</main><script>
q.oninput=()=>{const v=q.value.toLowerCase();document.querySelectorAll('li').forEach(l=>l.classList.toggle('hide',!l.textContent.toLowerCase().includes(v)))};
all.onclick=()=>{const l=[...document.querySelectorAll('li:not(.hide) a')];if(l.length>15&&!confirm('Open '+l.length+' tabs?'))return;l.forEach(a=>window.open(a.href,'_blank'))};
</script></body></html>`;
  }

  const csv = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  function buildLog(s) {
    let i = 0;
    return s.windows.flatMap((w, wi) => w.tabs.map(t => [s.localDate, s.localTime, s.stamp, wi + 1, ++i, t.title, t.url].map(csv).join(","))).join("\n") + "\n";
  }

  g.TabVaultReport = { buildHtml, buildLog };
})(globalThis);
