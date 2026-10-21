'use client';

import { useEffect, useState } from 'react';
import { FIELD_ERROR_EVENT, type FieldErrorDetail } from '@/lib/fieldError';

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

// Every form's required/format check, shown in the app's style instead of the
// browser's own "Please fill out this field" bubble. Mounted once in the root
// layout: it catches the browser's "invalid" event for any form, focuses the
// first field that needs fixing and shows a short message under it until the
// field is changed or left.
export function invalidMessage(field: Field): string {
  const raw = field.labels?.[0]?.textContent ?? field.getAttribute('aria-label') ?? '';
  const label = raw.replace(/\(.*?\)|\*/g, '').trim();
  const v = field.validity;
  if (v.valueMissing) {
    if (field instanceof HTMLInputElement && field.type === 'checkbox') return 'Tick this box to continue.';
    return label ? `${label} is required.` : 'This is required.';
  }
  if (v.typeMismatch && field.type === 'email') return 'Enter a valid email address, like name@student.mseuf.edu.ph.';
  if (v.tooShort && 'minLength' in field) return `${label || 'This'} needs at least ${field.minLength} characters.`;
  if ((v.rangeUnderflow || v.rangeOverflow) && field instanceof HTMLInputElement) {
    return `${label || 'This'} must be between ${field.min} and ${field.max}.`;
  }
  if (v.patternMismatch && field.title) return field.title;
  return field.validationMessage;
}

interface Hint {
  text: string;
  top: number;
  left: number;
  width: number;
}

export default function InvalidFieldHint() {
  const [hint, setHint] = useState<Hint | null>(null);

  useEffect(() => {
    let clearCurrent = () => {};
    // Red box, one short flash, scrolled to the middle of the screen (a phone's
    // bottom bar would otherwise hide a field near the bottom), and the message
    // under it until the field is changed or left.
    function show(field: HTMLElement, text: string) {
      clearCurrent();
      field.scrollIntoView({ block: 'center', behavior: 'smooth' });
      field.focus({ preventScroll: true });
      const r = field.getBoundingClientRect();
      setHint({ text, top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX, width: r.width });
      field.setAttribute('aria-invalid', 'true');
      field.classList.remove('rsu-flash');
      void field.offsetWidth; // restart the flash when the same field fails twice
      field.classList.add('rsu-flash');
      const events = ['input', 'blur', 'click', 'keydown'];
      const clear = () => {
        setHint(null);
        field.removeAttribute('aria-invalid');
        field.classList.remove('rsu-flash');
        events.forEach((name) => field.removeEventListener(name, clear));
      };
      events.forEach((name) => field.addEventListener(name, clear));
      clearCurrent = clear;
    }
    function onInvalid(e: Event) {
      const field = e.target as Field;
      e.preventDefault(); // no browser bubble
      // One message at a time: the first field that needs fixing.
      const first = field.form?.querySelector('input:invalid, textarea:invalid, select:invalid');
      if (first && first !== field) return;
      show(field, invalidMessage(field));
    }
    function onFieldError(e: Event) {
      const { id, message } = (e as CustomEvent<FieldErrorDetail>).detail;
      const field = document.getElementById(id);
      if (field) show(field, message);
    }
    document.addEventListener('invalid', onInvalid, true);
    window.addEventListener(FIELD_ERROR_EVENT, onFieldError);
    return () => {
      document.removeEventListener('invalid', onInvalid, true);
      window.removeEventListener(FIELD_ERROR_EVENT, onFieldError);
    };
  }, []);

  if (!hint) return null;
  return (
    <p
      role="alert"
      style={{ top: hint.top, left: hint.left, maxWidth: Math.max(hint.width, 220), background: '#b91c1c' }}
      className="pointer-events-none absolute z-[60] rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-lg"
    >
      {hint.text}
    </p>
  );
}
