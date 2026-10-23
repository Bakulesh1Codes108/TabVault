const $ = id => document.getElementById(id);
const h = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const params = new URLSearchParams(location.search);
let history = [], current = null;

const matches = (s, q) => !q || (s.localDate + " " + s.localTime).toLowerCase().includes(q) || s.windows.some(w => w.tabs.some(t => (t.title + " " + t.url).toLowerCase().includes(q)));

function renderList() {
  const q = $("search").value.toLowerCase().trim();
  const items = history.filter(s => matches(s, q));
  $("list").innerHTML = items.map(s => `<button data-id="${s.id}" class="${current && current.id === s.id ? "on" : ""}"><b>${h(s.localDate)}</b><br><span class="mut">${h(s.localTime)} · ${s.count} tab${s.count === 1 ? "" : "s"}</span></button>`).join("") || `<p class="mut">Nothing found.</p>`;
  $("list").querySelectorAll("button").forEach(b => b.onclick = () => show(+b.dataset.id));
}

async function openFile(id) {
  try { await chrome.downloads.open(id); }
  catch (e) { try { chrome.downloads.show(id); } catch (_) { alert("The file was moved or deleted. Use “Save files again”."); } }
}

function show(id) {
  current = history.find(s => s.id === id) || history[0];
  renderList();
  if (!current) return;
  const q = $("search").value.toLowerCase().trim();
  const just = +params.get("id") === current.id;
  const f = current.files;
  let n = 0;
  $("detail").innerHTML =
    (just ? `<div class="banner"><b>Saved &amp; closed ${current.count} tab${current.count === 1 ? "" : "s"}.</b> PDF, HTML and log are in Downloads\\TabVault.</div>` : "") +
    `<h2 style="margin:0">${h(current.localDate)} · ${h(current.localTime)}</h2>
    <div class="mut">${current.count} tabs from ${current.windows.length} window(s)</div>
    ${current.fileError ? `<div class="err" style="margin-top:6px">Files weren’t saved (${h(current.fileError)}). Nothing was closed.</div>` : ""}
    <div class="acts">
      <button class="primary" id="restore">Reopen all</button>
      ${f ? `<button id="pdf">Open PDF</button><button id="html">Open HTML</button><button id="folder">Show in folder</button>` : ""}
      <button id="again">Save files again</button>
      <button id="del">Remove from history</button>
    </div>
    ${current.windows.map((w, i) => `<h3>Window ${i + 1}</h3><ol start="${n + 1}">${w.tabs.map(t => { n++; const hit = q && (t.title + " " + t.url).toLowerCase().includes(q); return `<li><a href="${h(t.url)}" target="_blank" rel="noopener">${hit ? "<mark>" + h(t.title || t.url) + "</mark>" : h(t.title || t.url)}</a><small>${h(t.url)}</small></li>`; }).join("")}</ol>`).join("")}`;

  $("restore").onclick = async () => {
    const urls = current.windows.flatMap(w => w.tabs.map(t => t.url));
    if (urls.length > 20 && !confirm(`Reopen ${urls.length} tabs?`)) return;
    for (const url of urls) await chrome.tabs.create({ url, active: false });
  };
  if (f) {
    $("pdf").onclick = () => openFile(f.pdf.id);
    $("html").onclick = () => openFile(f.html.id);
    $("folder").onclick = () => { try { chrome.downloads.show(f.pdf.id); } catch (e) { chrome.downloads.showDefaultFolder(); } };
  }
  $("again").onclick = async () => {
    const r = await chrome.runtime.sendMessage({ type: "rewrite", id: current.id });
    if (r && r.ok) { await load(); show(current.id); } else alert((r && r.error) || "Could not save.");
  };
  $("del").onclick = async () => {
    if (!confirm("Remove this session from TabVault history? Files in Downloads\\TabVault are not touched.")) return;
    history = history.filter(s => s.id !== current.id);
    await chrome.storage.local.set({ history });
    show(history[0] && history[0].id);
  };
}

async function load() { history = (await chrome.storage.local.get("history")).history || []; }

(async () => {
  await load();
  $("search").oninput = () => { renderList(); if (current) show(current.id); };
  if (history.length) show(+params.get("id") || history[0].id);
})();
