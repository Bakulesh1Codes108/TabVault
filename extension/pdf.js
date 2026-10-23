// Tiny dependency-free PDF writer: A4 pages, Helvetica, clickable link annotations.
(function (g) {
  const W = 595, H = 842, M = 48, LINE_W = W - 2 * M;
  const MAP = { "\u2018": "'", "\u2019": "'", "\u201C": '"', "\u201D": '"', "\u2013": "-", "\u2014": "-", "\u2026": "...", "\u00A0": " ", "\u2022": "*" };

  function clean(s) {
    s = String(s || "").replace(/[\u2018\u2019\u201C\u201D\u2013\u2014\u2026\u00A0\u2022]/g, c => MAP[c]);
    let out = "";
    for (const ch of s) {
      const c = ch.codePointAt(0);
      if (c < 32) out += " ";
      else if (c <= 255) out += ch;
      else out += "?"; // non-Latin scripts: kept in full in the HTML copy
    }
    return out.replace(/\?{2,}/g, "??");
  }
  const esc = s => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  function wrap(text, size, bold, maxW) {
    const cw = size * (bold ? 0.56 : 0.52), max = Math.max(8, Math.floor(maxW / cw));
    const words = text.split(/\s+/).filter(Boolean), lines = [];
    let cur = "";
    for (let w of words) {
      while (w.length > max) { // hard-break long words / URLs
        if (cur) { lines.push(cur); cur = ""; }
        lines.push(w.slice(0, max)); w = w.slice(max);
      }
      if (!cur) cur = w;
      else if ((cur + " " + w).length <= max) cur += " " + w;
      else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  }

  function buildPdf(session) {
    const pages = [];
    let page, y;
    const newPage = () => { page = { ops: [], annots: [] }; pages.push(page); y = H - M; };
    const ensure = h => { if (y - h < M + 20) newPage(); };
    const text = (s, x, yy, size, bold, rgb) =>
      page.ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${rgb || "0.1 0.1 0.12"} rg ${x} ${yy.toFixed(1)} Td (${esc(s)}) Tj ET`);

    newPage();
    text("TabVault - Closed Tabs", M, y - 20, 22, true, "0.13 0.28 0.75"); y -= 34;
    text(clean(`${session.localDate} at ${session.localTime}  |  ${session.count} tab(s) in ${session.windows.length} window(s)`), M, y - 12, 11, false, "0.35 0.35 0.4"); y -= 22;
    page.ops.push(`0.8 0.82 0.88 RG 0.8 w ${M} ${y} m ${W - M} ${y} l S`); y -= 14;

    let n = 0;
    session.windows.forEach((win, wi) => {
      ensure(40);
      text(`Window ${wi + 1}  (${win.tabs.length} tab${win.tabs.length === 1 ? "" : "s"})`, M, y - 13, 13, true, "0.2 0.2 0.25"); y -= 24;
      for (const t of win.tabs) {
        n++;
        const tl = wrap(`${n}. ${clean(t.title || t.url)}`, 11, true, LINE_W);
        const ul = wrap(clean(t.url), 9, false, LINE_W - 14);
        ensure(tl.length * 14 + ul.length * 11 + 10);
        for (const l of tl) { text(l, M, y - 11, 11, true); y -= 14; }
        const top = y;
        for (const l of ul) { text(l, M + 14, y - 9, 9, false, "0.1 0.35 0.85"); y -= 11; }
        page.annots.push({ x1: M + 12, y1: y - 1, x2: W - M, y2: top + 1, url: t.url });
        y -= 9;
      }
      y -= 6;
    });

    // Assemble PDF objects
    const objs = [];
    const add = s => { objs.push(s); return objs.length; };
    const catalog = add(null), pagesId = add(null);
    const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const kids = [];
    pages.forEach((p, i) => {
      p.ops.push(`BT /F1 8 Tf 0.55 0.55 0.6 rg ${M} 24 Td (TabVault  -  page ${i + 1} of ${pages.length}) Tj ET`);
      const stream = p.ops.join("\n");
      const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      const annIds = p.annots.map(a => add(
        `<< /Type /Annot /Subtype /Link /Rect [${a.x1} ${a.y1.toFixed(1)} ${a.x2} ${a.y2.toFixed(1)}] /Border [0 0 0] /A << /S /URI /URI (${esc(clean(a.url))}) >> >>`));
      kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${content} 0 R${annIds.length ? ` /Annots [${annIds.map(id => id + " 0 R").join(" ")}]` : ""} >>`));
    });
    objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + " 0 R").join(" ")}] /Count ${kids.length} >>`;

    let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    const offsets = [];
    objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("");
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info << /Title (TabVault ${esc(clean(session.localDate + " " + session.localTime))}) /Producer (TabVault) >> >>\nstartxref\n${xref}\n%%EOF`;
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }

  function toBase64(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  g.TabVaultPDF = { buildPdf, toBase64 };
})(globalThis);
