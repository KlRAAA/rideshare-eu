'use client';

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="rsu-btn-secondary no-print">
      Print or save as PDF
    </button>
  );
}
