'use client';

import { useEffect, useState } from 'react';
import Badge from '@/components/Badge';
import VehicleFields from '@/components/VehicleFields';
import { apiFetch } from '@/lib/api';
import {
  EMPTY_VEHICLE_FIELDS,
  MAX_SAVED_VEHICLES,
  toFieldValues,
  vehicleSummary,
  type SavedVehicle,
  type VehicleFieldValues,
} from '@/lib/vehicles';

interface VehicleSectionProps {
  value: VehicleFieldValues;
  onChange: (next: VehicleFieldValues) => void;
  // Whether the car typed in "Use another car" should be added to My cars after posting.
  onSaveNewCarChange: (save: boolean) => void;
}

// New-trip car picker: pre-selects the default saved car so the usual trip
// needs no typing. The chosen car's fields are what gets posted either way.
export default function VehicleSection({ value, onChange, onSaveNewCarChange }: VehicleSectionProps) {
  const [cars, setCars] = useState<SavedVehicle[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [saveNewCar, setSaveNewCar] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ vehicles: SavedVehicle[] }>('/api/saved-vehicles')
      .then(({ vehicles }) => {
        if (cancelled) return;
        setCars(vehicles);
        if (vehicles.length > 0) {
          setSelectedId(vehicles[0].id);
          onChange(toFieldValues(vehicles[0]));
        }
      })
      .catch(() => {
        if (!cancelled) setCars([]);
      });
    return () => {
      cancelled = true;
    };
    // Runs once on mount; onChange is the parent's setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usingOtherCar = cars !== null && selectedId === null;
  const canSaveMore = (cars?.length ?? 0) < MAX_SAVED_VEHICLES;

  useEffect(() => {
    onSaveNewCarChange(usingOtherCar && saveNewCar && canSaveMore);
  }, [usingOtherCar, saveNewCar, canSaveMore, onSaveNewCarChange]);

  function pick(car: SavedVehicle) {
    setSelectedId(car.id);
    onChange(toFieldValues(car));
    setChoosing(false);
  }

  function useAnotherCar() {
    setSelectedId(null);
    onChange(EMPTY_VEHICLE_FIELDS);
    setChoosing(false);
  }

  if (cars === null) {
    return <div className="h-16 rounded-xl bg-gray-100 animate-pulse" aria-label="Loading your cars" />;
  }

  const selected = cars.find((c) => c.id === selectedId) ?? null;

  if (choosing) {
    return (
      <fieldset className="space-y-2">
        <legend className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Choose a car</legend>
        {cars.map((car) => (
          <button
            key={car.id}
            type="button"
            onClick={() => pick(car)}
            aria-pressed={car.id === selectedId}
            className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 rounded-xl border text-sm ${
              car.id === selectedId ? 'border-[color:var(--rsu-color-primary)] bg-gray-50' : 'border-gray-300'
            }`}
          >
            <span className="text-gray-900">{vehicleSummary(car)}</span>
            {car.isDefault && <Badge tone="primary">Default</Badge>}
          </button>
        ))}
        <button
          type="button"
          onClick={useAnotherCar}
          className="w-full text-left px-3 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm font-semibold text-[color:var(--rsu-color-primary)]"
        >
          + Use another car
        </button>
      </fieldset>
    );
  }

  if (selected) {
    return (
      <div>
        <p className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Your car</p>
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl">
          <span className="text-sm text-gray-900 min-w-0">{vehicleSummary(selected)}</span>
          <button
            type="button"
            onClick={() => setChoosing(true)}
            className="shrink-0 text-sm font-semibold text-[color:var(--rsu-color-primary)] hover:underline"
          >
            Change
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1">Manage your cars from your profile.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {cars.length > 0 && (
        <button
          type="button"
          onClick={() => setChoosing(true)}
          className="text-sm font-semibold text-[color:var(--rsu-color-primary)] hover:underline"
        >
          ← Use a saved car
        </button>
      )}
      <VehicleFields value={value} onChange={onChange} idPrefix="post-vehicle" />
      {canSaveMore ? (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={saveNewCar} onChange={(e) => setSaveNewCar(e.target.checked)} />
          Save this car to My cars for next time
        </label>
      ) : (
        <p className="text-[11px] text-gray-400">
          You already have {MAX_SAVED_VEHICLES} saved cars. Remove one from your profile to save this one.
        </p>
      )}
    </div>
  );
}
