'use client';

import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  MIN_SUGGEST_LENGTH,
  SUGGEST_DELAY_MS,
  moveHighlight,
  suggestionAnnouncement,
  type PlaceSuggestion,
} from '@/lib/addressSuggest';

interface AddressInputProps {
  id: string;
  value: string;
  // Every keystroke. Callers drop any exact spot they had, as before.
  onChange: (text: string) => void;
  // A suggestion was picked: its full label and exact coordinates.
  onSelect: (place: PlaceSuggestion) => void;
  // The field lost focus with typed text that wasn't picked from the list.
  onCommit?: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

// An address field with a list of Philippine places that updates as you type
// (WAI-ARIA combobox pattern): arrow keys move through it, Enter picks, Escape
// closes, and a screen reader hears how many places were found. Typing
// without picking still works; the caller looks that text up when the field
// is left (onCommit) and the map pin can correct it.
export default function AddressInput({
  id,
  value,
  onChange,
  onSelect,
  onCommit,
  placeholder,
  required,
  className = '',
}: AddressInputProps) {
  const listId = `${id}-suggestions`;
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [announcement, setAnnouncement] = useState('');
  // True after a keystroke, false once a place is picked: only typing fetches,
  // so the field doesn't reopen the list right after a choice.
  const typed = useRef(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (!typed.current) return;
    const query = value.trim();
    if (query.length < MIN_SUGGEST_LENGTH) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const thisRequest = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const { suggestions: found } = await apiFetch<{ suggestions: PlaceSuggestion[] }>(
          `/api/geocode/suggest?q=${encodeURIComponent(query)}`
        );
        if (thisRequest !== requestId.current || !typed.current) return; // a newer keystroke won
        setSuggestions(found);
        setHighlight(-1);
        setOpen(true);
        setAnnouncement(suggestionAnnouncement(found.length));
      } catch {
        if (thisRequest === requestId.current) setOpen(false);
      }
    }, SUGGEST_DELAY_MS);
    return () => clearTimeout(timer);
  }, [value]);

  function pick(place: PlaceSuggestion) {
    typed.current = false;
    requestId.current++;
    setOpen(false);
    setHighlight(-1);
    setAnnouncement(`Selected ${place.label}.`);
    onSelect(place);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (suggestions.length === 0) return;
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlight(e.key === 'ArrowDown' ? 0 : suggestions.length - 1);
        return;
      }
      setHighlight((h) => moveHighlight(h, e.key as 'ArrowDown' | 'ArrowUp', suggestions.length));
    } else if (e.key === 'Enter' && open && highlight >= 0) {
      e.preventDefault(); // pick the place instead of submitting the form
      pick(suggestions[highlight]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
      setHighlight(-1);
    }
  }

  const showList = open && value.trim().length >= MIN_SUGGEST_LENGTH;

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && highlight >= 0 ? `${listId}-${highlight}` : undefined}
        autoComplete="off"
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          typed.current = true;
          onChange(e.target.value);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setOpen(false);
          setHighlight(-1);
          if (typed.current && value.trim()) onCommit?.(value);
        }}
        className={className}
      />
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {showList && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          {suggestions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-500">No matching places. Keep typing, or set the spot on the map.</p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Suggested places" className="max-h-64 overflow-auto py-1">
              {suggestions.map((place, i) => (
                <li
                  key={place.label}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === highlight}
                  // mousedown, not click: keeps focus in the field so its blur
                  // doesn't close the list before the pick lands
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(place);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={`px-3 py-2 cursor-pointer ${
                    i === highlight ? 'bg-[color:var(--rsu-color-primary)]/15 shadow-[inset_3px_0_0_var(--rsu-color-primary)]' : ''
                  }`}
                >
                  <span className="block text-sm font-medium text-gray-900">{place.primary}</span>
                  {place.secondary && <span className="block text-xs text-gray-500">{place.secondary}</span>}
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-gray-100 px-3 py-1 text-[10px] text-gray-400">Places © OpenStreetMap contributors</p>
        </div>
      )}
    </div>
  );
}
