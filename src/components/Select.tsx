'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { FaCheck, FaChevronDown } from 'react-icons/fa';

// The app's own dropdown, in place of the browser's <select>, whose open list
// is drawn by the phone or OS and can't follow the app's theme. Same API as a
// <select>: <option> children, value, onChange(e) with e.target.value. Opens as
// a list under the field on wide screens and as a bottom sheet with large rows
// on phones. Keyboard: Enter/Space/arrows open; arrows, Home/End and the first
// letter move; Enter/Space pick; Escape or Tab closes.
interface SelectProps {
  id?: string;
  value: string | number;
  onChange: (e: { target: { value: string } }) => void;
  children: React.ReactNode;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  wrapperClassName?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled: boolean;
}

// <option value disabled>label</option> children, including ones inside fragments or arrays.
export function readOptions(children: React.ReactNode): SelectOption[] {
  const out: SelectOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<{ value?: string | number; disabled?: boolean; children?: React.ReactNode }>(child)) return;
    if (child.type === React.Fragment) {
      out.push(...readOptions(child.props.children));
      return;
    }
    const label = React.Children.toArray(child.props.children).join('');
    out.push({ value: String(child.props.value ?? label), label, disabled: Boolean(child.props.disabled) });
  });
  return out;
}

export default function Select({
  id,
  value,
  onChange,
  children,
  disabled = false,
  required = false,
  className = '',
  wrapperClassName = '',
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
}: SelectProps) {
  const autoId = useId();
  const buttonId = id ?? `select-${autoId}`;
  const listId = `${buttonId}-list`;
  const options = readOptions(children);
  const current = String(value);
  const selected = options.find((o) => o.value === current);
  // An empty disabled option ("Choose one") is the placeholder, not a choice.
  const placeholder = selected && selected.disabled ? selected.label : !selected ? options.find((o) => o.value === '')?.label : null;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const enabled = (i: number) => options[i] && !options[i].disabled;
  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) if (enabled(i)) return i;
    return from;
  };

  function openList() {
    if (disabled) return;
    const at = options.findIndex((o) => o.value === current && !o.disabled);
    setActive(at >= 0 ? at : step(-1, 1));
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }

  function pick(i: number) {
    if (!enabled(i)) return;
    if (options[i].value !== current) onChange({ target: { value: options[i].value } });
    close();
  }

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, listId]);

  function onButtonKey(e: React.KeyboardEvent) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  }

  function onListKey(e: React.KeyboardEvent) {
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((a) => step(a, 1)),
      ArrowUp: () => setActive((a) => step(a, -1)),
      Home: () => setActive(step(-1, 1)),
      End: () => setActive(step(options.length, -1)),
      Enter: () => pick(active),
      ' ': () => pick(active),
      Escape: () => close(),
    };
    if (e.key === 'Tab') return setOpen(false);
    if (keys[e.key]) {
      e.preventDefault();
      keys[e.key]();
      return;
    }
    // Type a letter to jump to the next option starting with it.
    if (e.key.length === 1) {
      const letter = e.key.toLowerCase();
      for (let n = 1; n <= options.length; n++) {
        const i = (active + n) % options.length;
        if (enabled(i) && options[i].label.toLowerCase().startsWith(letter)) return setActive(i);
      }
    }
  }

  return (
    <div ref={wrapRef} className={`relative ${wrapperClassName}`}>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        // A combobox's text is read as its value, after the field's label.
        role="combobox"
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onButtonKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        className={`w-full flex items-center justify-between gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rsu-color-primary)] focus-visible:border-[color:var(--rsu-color-primary)] disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      >
        <span className={`truncate ${placeholder != null ? 'text-gray-400' : ''}`}>{placeholder ?? selected?.label ?? ''}</span>
        <FaChevronDown aria-hidden className={`w-3 h-3 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* Phones: a dimmed backdrop under a bottom sheet. */}
          <div aria-hidden className="fixed inset-0 z-[70] bg-black/50 md:hidden" onClick={() => close(false)} />
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={ariaLabel ? undefined : buttonId}
            aria-label={ariaLabel}
            aria-activedescendant={`${listId}-${active}`}
            onKeyDown={onListKey}
            className="fixed inset-x-0 bottom-0 z-[71] max-h-[60vh] overflow-auto rounded-t-2xl border border-gray-200 bg-white p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-xl outline-none md:absolute md:inset-x-auto md:bottom-auto md:left-0 md:top-full md:mt-1 md:w-full md:max-h-64 md:rounded-xl md:p-1 md:shadow-lg"
          >
            {options.map((o, i) => {
              const isSelected = o.value === current && !o.disabled;
              return (
                <li
                  key={`${o.value}-${i}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={o.disabled || undefined}
                  onClick={() => pick(i)}
                  onMouseMove={() => enabled(i) && setActive(i)}
                  className={`flex min-h-12 items-center justify-between gap-3 rounded-xl px-4 text-base md:min-h-0 md:rounded-lg md:px-3 md:py-2 md:text-sm ${
                    o.disabled
                      ? 'cursor-default text-gray-400'
                      : `cursor-pointer ${isSelected ? 'font-semibold text-[color:var(--rsu-color-primary)]' : 'text-gray-800'} ${
                          i === active ? 'bg-[color:var(--rsu-color-primary)]/10' : ''
                        }`
                  }`}
                >
                  <span>{o.label}</span>
                  {isSelected && <FaCheck aria-hidden className="h-3.5 w-3.5 shrink-0" />}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
