'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FaClock } from 'react-icons/fa';

type Period = 'AM' | 'PM';

const MINUTE_OPTIONS = [0, 15, 30, 45];
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
const MAX_MINUTE_OPTION = MINUTE_OPTIONS[MINUTE_OPTIONS.length - 1];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function parse24(v: string): { hour24: number; minute: number } | null {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  return { hour24: Number(m[1]), minute: Number(m[2]) };
}

function to12(hour24: number): { hour12: number; period: Period } {
  const period: Period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, period };
}

function to24(hour12: number, period: Period): number {
  const base = hour12 % 12;
  return period === 'PM' ? base + 12 : base;
}

function formatDisplay12(hour24: number, minute: number): string {
  const { hour12, period } = to12(hour24);
  return `${hour12}:${pad2(minute)} ${period}`;
}

interface TimePickerProps {
  value: string; // HH:MM 24h, or ''
  onChange: (value: string) => void;
  min?: string; // HH:MM 24h — only meaningful for "today"; caller decides when to pass it
  disabled?: boolean;
  className?: string;
}

const DEFAULT_HOUR12 = 7;
const DEFAULT_MINUTE = 0;
const DEFAULT_PERIOD: Period = 'AM';

export default function TimePicker({ value, onChange, min, disabled = false, className = '' }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [pendingHour12, setPendingHour12] = useState(DEFAULT_HOUR12);
  const [pendingMinute, setPendingMinute] = useState(DEFAULT_MINUTE);
  const [pendingPeriod, setPendingPeriod] = useState<Period>(DEFAULT_PERIOD);
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
    const parsed = parse24(value);
    if (parsed) {
      const { hour12, period } = to12(parsed.hour24);
      setPendingHour12(hour12);
      setPendingMinute(Math.floor(parsed.minute / 15) * 15);
      setPendingPeriod(period);
    } else {
      setPendingHour12(DEFAULT_HOUR12);
      setPendingMinute(DEFAULT_MINUTE);
      setPendingPeriod(DEFAULT_PERIOD);
    }
    setOpen(true);
  }

  const minParsed = min ? parse24(min) : null;

  function isHourDisabled(hour12: number, period: Period) {
    if (!minParsed) return false;
    const hour24 = to24(hour12, period);
    if (hour24 < minParsed.hour24) return true;
    if (hour24 === minParsed.hour24 && minParsed.minute > MAX_MINUTE_OPTION) return true;
    return false;
  }

  function isMinuteDisabled(minute: number) {
    if (!minParsed) return false;
    const hour24 = to24(pendingHour12, pendingPeriod);
    if (hour24 < minParsed.hour24) return true;
    if (hour24 === minParsed.hour24 && minute < minParsed.minute) return true;
    return false;
  }

  const parsedValue = parse24(value);

  return (
    <div ref={ref} className={`relative ${disabled ? 'opacity-60' : ''}`}>
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className={`w-full flex items-center gap-2.5 text-left disabled:cursor-not-allowed ${className}`}
      >
        <FaClock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <span className={value ? '' : 'text-gray-400'}>
          {parsedValue ? formatDisplay12(parsedValue.hour24, parsedValue.minute) : 'Select time'}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 md:absolute md:inset-auto md:z-20 md:mt-2 md:left-1/2 md:-translate-x-1/2 md:bg-transparent md:p-0"
          onClick={() => setOpen(false)}
        >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[280px] max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-lg p-4 md:w-[280px] md:max-w-[calc(100vw-2rem)] md:max-h-none md:overflow-visible"
        >
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-500 text-center mb-2">Hour</p>
              <div className="h-40 overflow-y-auto rounded-lg border border-gray-100">
                {HOUR_OPTIONS.map((h) => {
                  const isSelected = h === pendingHour12;
                  const hourDisabled = isHourDisabled(h, pendingPeriod);
                  return (
                    <button
                      key={h}
                      type="button"
                      disabled={hourDisabled}
                      onClick={() => setPendingHour12(h)}
                      className={`w-full py-2 text-sm text-center transition-colors ${
                        isSelected
                          ? 'bg-[color:var(--rsu-color-primary)]/10 text-[color:var(--rsu-color-primary)] font-semibold'
                          : hourDisabled
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-500 text-center mb-2">Minute</p>
              <div className="h-40 overflow-y-auto rounded-lg border border-gray-100">
                {MINUTE_OPTIONS.map((m) => {
                  const isSelected = m === pendingMinute;
                  const minuteDisabled = isMinuteDisabled(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={minuteDisabled}
                      onClick={() => setPendingMinute(m)}
                      className={`w-full py-2 text-sm text-center transition-colors ${
                        isSelected
                          ? 'bg-[color:var(--rsu-color-primary)]/10 text-[color:var(--rsu-color-primary)] font-semibold'
                          : minuteDisabled
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pad2(m)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {(['AM', 'PM'] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPendingPeriod(p)}
                className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                  pendingPeriod === p
                    ? 'bg-[color:var(--rsu-color-primary)] text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              onChange(`${pad2(to24(pendingHour12, pendingPeriod))}:${pad2(pendingMinute)}`);
              setOpen(false);
            }}
            className="rsu-btn-primary w-full"
          >
            Set Time
          </button>
        </div>
        </div>
      )}
    </div>
  );
}
