'use client';

import { useEffect, useState } from 'react';
import { FaCar } from 'react-icons/fa';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import VehicleFields from '@/components/VehicleFields';
import { apiFetch } from '@/lib/api';
import {
  EMPTY_VEHICLE_FIELDS,
  MAX_SAVED_VEHICLES,
  toFieldValues,
  toVehiclePayload,
  vehicleFieldsError,
  vehicleSummary,
  type SavedVehicle,
  type VehicleFieldValues,
} from '@/lib/vehicles';

// null = not editing; 'new' = adding a car; otherwise the id being edited.
type Editing = null | 'new' | string;

export default function MyCarsCard() {
  const [cars, setCars] = useState<SavedVehicle[] | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [form, setForm] = useState<VehicleFieldValues>(EMPTY_VEHICLE_FIELDS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const { vehicles } = await apiFetch<{ vehicles: SavedVehicle[] }>('/api/saved-vehicles');
      setCars(vehicles);
    } catch {
      setCars([]);
      setError('Couldn’t load your cars. Refresh to try again.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(target: Editing, values: VehicleFieldValues) {
    setEditing(target);
    setForm(values);
    setError(null);
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setEditing(null);
      await load();
    } catch {
      setError('That didn’t save. Check the details and try again.');
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const problem = vehicleFieldsError(form);
    if (problem) {
      setError(problem);
      return;
    }
    const body = JSON.stringify(toVehiclePayload(form));
    run(() =>
      editing === 'new'
        ? apiFetch('/api/saved-vehicles', { method: 'POST', body })
        : apiFetch(`/api/saved-vehicles/${editing}`, { method: 'PATCH', body })
    );
  }

  function remove(car: SavedVehicle) {
    if (!window.confirm(`Remove ${car.make} ${car.model} from your cars? Trips you already posted keep it.`)) return;
    run(() => apiFetch(`/api/saved-vehicles/${car.id}`, { method: 'DELETE' }));
  }

  const formView = (
    <div className="space-y-3 mt-3">
      <VehicleFields value={form} onChange={setForm} idPrefix="my-car" />
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={save} className="rsu-btn-primary disabled:opacity-60">
          {editing === 'new' ? 'Add car' : 'Save changes'}
        </button>
        <button type="button" disabled={busy} onClick={() => setEditing(null)} className="rsu-btn-secondary disabled:opacity-60">
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <Card>
      <h3 className="text-sm font-bold text-gray-900 mb-1">My cars</h3>
      <p className="text-[11px] text-gray-400">Your default car is pre-selected when you post a trip.</p>

      {cars === null ? (
        <div className="h-12 mt-3 rounded-xl bg-gray-100 animate-pulse" aria-label="Loading your cars" />
      ) : (
        <ul className="mt-3 space-y-2">
          {cars.length === 0 && editing !== 'new' && (
            <li className="text-sm text-gray-500">No saved cars yet. Add one, or tick “Save this car” when you post a trip.</li>
          )}
          {cars.map((car) => (
            <li key={car.id} className="border border-gray-200 rounded-xl px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <FaCar className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
                <span className="text-sm text-gray-900 min-w-0 flex-1">{vehicleSummary(car)}</span>
                {car.isDefault && <Badge tone="primary">Default</Badge>}
              </div>
              {editing === car.id ? (
                formView
              ) : (
                <div className="flex flex-wrap gap-3 mt-2 text-xs font-semibold">
                  {!car.isDefault && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => apiFetch(`/api/saved-vehicles/${car.id}/default`, { method: 'POST' }))}
                      className="text-[color:var(--rsu-color-primary)] hover:underline disabled:opacity-60"
                    >
                      Make default
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => startEdit(car.id, toFieldValues(car))}
                    className="text-[color:var(--rsu-color-primary)] hover:underline disabled:opacity-60"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(car)}
                    className="text-red-600 hover:underline disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing === 'new' && formView}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {cars !== null && editing === null && cars.length < MAX_SAVED_VEHICLES && (
        <button
          type="button"
          onClick={() => startEdit('new', EMPTY_VEHICLE_FIELDS)}
          className="mt-3 text-sm font-semibold text-[color:var(--rsu-color-primary)] hover:underline"
        >
          + Add a car
        </button>
      )}
    </Card>
  );
}
