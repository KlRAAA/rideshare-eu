'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// The app's own confirm and prompt, in place of window.confirm / prompt /
// alert, which the browser draws in its own style. Built on <dialog>, which
// keeps keyboard focus inside, closes on Escape and dims the page. It's
// rendered at the end of <body>, so a caller may render it inside its own form.
//
//   const { confirm, ask, dialog } = useAppDialog();
//   if (!(await confirm({ title: 'End this trip?', confirmLabel: 'End trip' }))) return;
//   const reason = await ask({ title: 'Skip Monday?', label: 'Reason (optional)' }); // null = cancelled
//   ...render {dialog} once in the component.
interface BaseOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean; // a destructive action: the confirm button is red
}

export interface AskOptions extends BaseOptions {
  label: string;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
}

type Request =
  | (BaseOptions & { kind: 'confirm'; resolve: (ok: boolean) => void })
  | (AskOptions & { kind: 'ask'; resolve: (value: string | null) => void });

export function useAppDialog() {
  const [request, setRequest] = useState<Request | null>(null);

  const confirm = (options: BaseOptions) =>
    new Promise<boolean>((resolve) => setRequest({ ...options, kind: 'confirm', resolve }));
  const ask = (options: AskOptions) =>
    new Promise<string | null>((resolve) => setRequest({ ...options, kind: 'ask', resolve }));

  const dialog = request ? createPortal(
    <AppDialog
      request={request}
      onDone={(answer) => {
        setRequest(null);
        if (request.kind === 'confirm') request.resolve(answer !== null);
        else request.resolve(answer);
      }}
    />,
    document.body
  ) : null;

  return { confirm, ask, dialog };
}

// answer: null when cancelled; the typed text (or '' for a confirm) otherwise.
function AppDialog({ request, onDone }: { request: Request; onDone: (answer: string | null) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const ids = useId();
  const [text, setText] = useState('');
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.showModal();
    return () => el.close();
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // React passes events up through the portal: keep this submit from
    // reaching a form the caller rendered the dialog in.
    e.stopPropagation();
    if (request.kind === 'ask' && request.required && !text.trim()) {
      setMissing(true);
      return;
    }
    onDone(request.kind === 'ask' ? text.trim() : '');
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${ids}-title`}
      aria-describedby={request.message ? `${ids}-message` : undefined}
      // Escape: the browser fires "cancel"; answer as Cancel.
      onCancel={(e) => {
        e.preventDefault();
        onDone(null);
      }}
      // A tap on the dimmed area outside the box cancels too.
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === ref.current) onDone(null);
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-gray-200 bg-white p-0 text-gray-900 shadow-xl backdrop:bg-black/50"
    >
      <form onSubmit={submit} noValidate className="space-y-3 p-5">
        <h2 id={`${ids}-title`} className="text-base font-bold text-gray-900">
          {request.title}
        </h2>
        {request.message && (
          <p id={`${ids}-message`} className="text-sm text-gray-600">
            {request.message}
          </p>
        )}
        {request.kind === 'ask' && (
          <div>
            <label htmlFor={`${ids}-input`} className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-700">
              {request.label}
            </label>
            <textarea
              id={`${ids}-input`}
              autoFocus
              rows={3}
              maxLength={request.maxLength}
              placeholder={request.placeholder}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setMissing(false);
              }}
              aria-invalid={missing || undefined}
              aria-describedby={missing ? `${ids}-missing` : undefined}
              className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
            />
            {missing && (
              <p id={`${ids}-missing`} role="alert" className="mt-1 text-xs text-red-600">
                Write a short reason first.
              </p>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={() => onDone(null)} className="rsu-btn-secondary px-4 py-2 text-sm">
            {request.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="submit"
            autoFocus={request.kind === 'confirm'}
            className={`${request.danger ? 'rsu-btn-danger-solid' : 'rsu-btn-primary'} px-4 py-2 text-sm`}
          >
            {request.confirmLabel ?? 'OK'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
