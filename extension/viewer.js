const ext = globalThis.browser || globalThis.chrome;
const $ = id => document.getElementById(id);
const h = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let history = [], current = null;

function download(name, data, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

function renderList() {
  const q = $("search").value.toLowerCase();
  const items = history.filter(s => !q || s.windows.some(w => w.tabs.some(t => (t.title + " " + t.url).toLowerCase().includes(q))));
  $("list").innerHTML = items.map(s => `<button data-id="${s.id}" class="${current && current.id === s.id ? "on" : ""}"><b>${h(s.localDate)}</b><br><span class="mut">${h(s.localTime)} · ${s.count} tabs</span></button>`).join("") || `<p class="mut">Nothing found.</p>`;
  $("list").querySelectorAll("button").forEach(b => b.onclick = () => show(+b.dataset.id));
}

function show(id) {
  current = history.find(s => s.id === id) || history[0];
  renderList();
  if (!current) return;
  const q = $("search").value.toLowerCase();
  const fileLine = current.files
    ? `<span class="ok">Saved in Downloads/TabVault as “Tabs ${h(current.stamp)}”.</span>`
    : `<span class="err">Files weren’t written (${h(current.fileError || "unknown")}). Use the download buttons below.</span>`;
  let n = 0;
  $("detail").innerHTML = `<h2 style="margin:0">${h(current.localDate)} · ${h(current.localTime)}</h2>
    <div class="mut">${current.count} tabs closed from ${current.windows.length} window(s)</div><div style="margin-top:6px">${fileLine}</div>
    <div class="acts"><button class="primary" id="restore">Reopen all</button><button id="pdf">Download PDF</button><button id="html">Download HTML</button><button id="del">Remove from history</button></div>
    ${current.windows.map((w, i) => `<h3>Window ${i + 1}</h3><ol start="${n + 1}">${w.tabs.map(t => { n++; const hit = q && (t.title + " " + t.url).toLowerCase().includes(q); return `<li${hit ? ' style="background:color-mix(in srgb,var(--ac) 15%,transparent);border-radius:6px"' : ""}><a href="${h(t.url)}" target="_blank" rel="noopener">${h(t.title || t.url)}</a><small>${h(t.url)}</small></li>`; }).join("")}</ol>`).join("")}`;
  $("restore").onclick = async () => {
    const urls = current.windows.flatMap(w => w.tabs.map(t => t.url));
    if (urls.length > 20 && !confirm(`Reopen ${urls.length} tabs?`)) return;
    for (const url of urls) await ext.tabs.create({ url, active: false });
  };
  $("pdf").onclick = () => download(`Tabs ${current.stamp}.pdf`, TabVaultPDF.buildPdf(current), "application/pdf");
  $("html").onclick = () => download(`Tabs ${current.stamp}.html`, TabVaultReport.buildHtml(current), "text/html");
  $("del").onclick = async () => {
    if (!confirm("Remove this session from TabVault history? (Files in Downloads are not touched.)")) return;
    history = history.filter(s => s.id !== current.id);
    await ext.storage.local.set({ history });
    show(history[0] && history[0].id);
  };
}

(async () => {
  history = (await ext.storage.local.get("history")).history || [];
  $("search").oninput = () => { renderList(); if (current) show(current.id); };
  const id = +new URLSearchParams(location.search).get("id");
  if (history.length) show(id || history[0].id);
})();
