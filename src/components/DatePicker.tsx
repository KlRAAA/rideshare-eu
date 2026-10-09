'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { FaCalendarAlt, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import Select from './Select';

const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ARROW =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rsu-color-primary)]';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toDateString(year: number, month: number, day: number) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function parseDateString(s: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) };
}

function formatDisplay(s: string): string {
  const parsed = parseDateString(s);
  if (!parsed) return '';
  return `${MONTH_LABELS[parsed.month].slice(0, 3)} ${parsed.day}, ${parsed.year}`;
}

interface DatePickerProps {
  value: string; // YYYY-MM-DD or ''
  onChange: (value: string) => void;
  min?: string; // YYYY-MM-DD
  max?: string; // YYYY-MM-DD
  id?: string;
  disabled?: boolean;
  className?: string;
}

export default function DatePicker({ value, onChange, min, max, id, disabled = false, className = '' }: DatePickerProps) {
  const today = new Date();
  const minParsed = min ? parseDateString(min) : null;
  const minStr = minParsed ? toDateString(minParsed.year, minParsed.month, minParsed.day) : null;
  const maxParsed = max ? parseDateString(max) : null;
  const maxStr = maxParsed ? toDateString(maxParsed.year, maxParsed.month, maxParsed.day) : null;
  // Where the calendar opens when nothing is picked: the earliest allowed
  // month, or the latest when only a latest date is set (past dates).
  const startAt = minParsed ?? maxParsed;

  const [open, setOpen] = useState(false);
  const valueId = `${useId()}-value`;
  const [viewYear, setViewYear] = useState(startAt?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(startAt?.month ?? today.getMonth());
  const [pendingDate, setPendingDate] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function openPicker() {
    if (disabled) return;
    const parsed = parseDateString(value);
    setViewYear(parsed?.year ?? startAt?.year ?? today.getFullYear());
    setViewMonth(parsed?.month ?? startAt?.month ?? today.getMonth());
    setPendingDate(value);
    setOpen(true);
  }

  // The previous or next month, within the years the picker offers.
  function shiftMonth(by: -1 | 1) {
    const m = viewMonth + by;
    const year = viewYear + Math.floor(m / 12);
    if (year < firstYear || year > lastYear) return;
    setViewYear(year);
    setViewMonth((m + 12) % 12);
  }

  function isDisabledDay(year: number, month: number, day: number) {
    const d = toDateString(year, month, day);
    return (minStr != null && d < minStr) || (maxStr != null && d > maxStr);
  }

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInView = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevView = new Date(viewYear, viewMonth, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInView) / 7) * 7;
  const trailingCount = totalCells - startWeekday - daysInView;

  const cells: { year: number; month: number; day: number; inMonth: boolean }[] = [];
  for (let i = 0; i < startWeekday; i++) {
    const day = daysInPrevView - startWeekday + 1 + i;
    const month = viewMonth === 0 ? 11 : viewMonth - 1;
    const year = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ year, month, day, inMonth: false });
  }
  for (let day = 1; day <= daysInView; day++) {
    cells.push({ year: viewYear, month: viewMonth, day, inMonth: true });
  }
  for (let k = 0; k < trailingCount; k++) {
    const day = k + 1;
    const month = viewMonth === 11 ? 0 : viewMonth + 1;
    const year = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ year, month, day, inMonth: false });
  }

  // Every year from min to max; without them, this year and the next two.
  const firstYear = minParsed?.year ?? (maxParsed ? Math.min(today.getFullYear(), maxParsed.year) - 2 : today.getFullYear());
  const lastYear = maxParsed?.year ?? firstYear + 2;
  const yearOptions = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i);

  return (
    <div ref={ref} className={`relative ${disabled ? 'opacity-60' : ''}`}>
      <button
        id={id}
        type="button"
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={`${valueId}`}
        disabled={disabled}
        className={`w-full flex items-center justify-between text-left disabled:cursor-not-allowed ${className}`}
      >
        <span id={valueId} className={value ? '' : 'text-gray-400'}>{value ? formatDisplay(value) : 'Select date'}</span>
        <FaCalendarAlt className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-2" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 md:absolute md:inset-auto md:z-20 md:mt-2 md:left-1/2 md:-translate-x-1/2 md:bg-transparent md:p-0"
          onClick={() => setOpen(false)}
        >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[320px] max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-lg p-4 md:w-[300px] md:max-w-[calc(100vw-2rem)] md:max-h-none md:overflow-visible"
        >
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Select Date</p>

          <div className="flex items-center gap-1.5 mb-3">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className={ARROW}>
              <FaChevronLeft aria-hidden className="h-3 w-3" />
            </button>
            <Select
              aria-label="Month"
              value={viewMonth}
              onChange={(e) => setViewMonth(Number(e.target.value))}
              wrapperClassName="flex-1 min-w-0"
              className="px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
            >
              {MONTH_LABELS.map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Year"
              value={viewYear}
              onChange={(e) => setViewYear(Number(e.target.value))}
              wrapperClassName="w-[5.5rem] shrink-0"
              className="px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className={ARROW}>
              <FaChevronRight aria-hidden className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="text-center text-[10px] font-semibold text-gray-400 py-1">
                {label.charAt(0)}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, i) => {
              const dateStr = toDateString(cell.year, cell.month, cell.day);
              const isSelected = dateStr === pendingDate;
              const isToday = dateStr === toDateString(today.getFullYear(), today.getMonth(), today.getDate());
              const disabledDay = isDisabledDay(cell.year, cell.month, cell.day);
              return (
                <button
                  key={`${dateStr}-${i}`}
                  type="button"
                  disabled={disabledDay}
                  onClick={() => setPendingDate(dateStr)}
                  aria-label={formatDisplay(dateStr)}
                  aria-pressed={isSelected}
                  className={`h-9 w-full text-sm rounded-full flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-[color:var(--rsu-color-primary)] text-white font-semibold'
                      : disabledDay
                        ? 'text-gray-300 cursor-not-allowed'
                        : !cell.inMonth
                          ? 'text-gray-300 hover:bg-gray-100'
                          : isToday
                            ? 'text-[color:var(--rsu-color-primary)] font-semibold ring-1 ring-[color:var(--rsu-color-primary)] hover:bg-[color:var(--rsu-color-primary)]/10'
                            : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              if (pendingDate) onChange(pendingDate);
              setOpen(false);
            }}
            disabled={!pendingDate}
            className="rsu-btn-primary w-full mt-4 disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
        </div>
      )}
    </div>
  );
}
