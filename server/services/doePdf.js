// Text of a PDF as printed lines: one array of cells per line, the text items
// sharing a baseline, left to right. The DOE files are exported from Excel, so
// each table cell is its own text item.
async function pdfLines(buffer) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // Untrusted input: no eval, no font loading (text only).
  const doc = await getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
  try {
    const lines = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const { items } = await (await doc.getPage(p)).getTextContent();
      const rows = new Map();
      for (const it of items) {
        if (!it.str?.trim()) continue;
        const y = Math.round(it.transform[5]);
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y).push({ x: it.transform[4], s: it.str.trim() });
      }
      for (const y of [...rows.keys()].sort((a, b) => b - a)) {
        lines.push(rows.get(y).sort((a, b) => a.x - b.x).map((r) => r.s));
      }
    }
    return lines;
  } finally {
    await doc.destroy();
  }
}

module.exports = { pdfLines };
