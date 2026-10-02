'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { MIN_FUEL_PRICE_PER_LITER, MAX_FUEL_PRICE_PER_LITER } from '@/lib/constants';
import { FUEL_TYPE_SHORT_LABELS, type FuelType } from '@/lib/fuelTypes';

export default function FuelPriceForm({ fuelType, current }: { fuelType: FuelType; current: number | null }) {
  const name = FUEL_TYPE_SHORT_LABELS[fuelType];
  const inputId = `official-fuel-price-${fuelType.toLowerCase()}`;
  const router = useRouter();
  const [value, setValue] = useState(current != null ? String(current) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(value);
    if (value.trim() === '' || !Number.isFinite(price) || price < MIN_FUEL_PRICE_PER_LITER || price > MAX_FUEL_PRICE_PER_LITER) {
      setError(`Enter a price between ₱${MIN_FUEL_PRICE_PER_LITER} and ₱${MAX_FUEL_PRICE_PER_LITER}.`);
      return;
    }
    if (!window.confirm(`Set the official ${name} price to ₱${price.toFixed(2)}/L for everyone?`)) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/admin/fuel-price', { method: 'PUT', body: JSON.stringify({ fuelType, pricePerLiter: price }) });
      setSaved(true);
      router.refresh();
    } catch {
      setError('Couldn’t save the price. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
      <label htmlFor={inputId} className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
        New {name} price (₱/liter)
        <input
          id={inputId}
          type="number"
          step="0.01"
          min={MIN_FUEL_PRICE_PER_LITER}
          max={MAX_FUEL_PRICE_PER_LITER}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          className="rsu-input-no-spinner mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm normal-case tracking-normal font-normal"
        />
      </label>
      <button type="submit" disabled={busy} className="rsu-btn-primary disabled:opacity-60">
        {busy ? 'Saving…' : `Set ${name} price`}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {saved && !error && <p className="text-xs text-green-700">Saved.</p>}
    </form>
  );
}
