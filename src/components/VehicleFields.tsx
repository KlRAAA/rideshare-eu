'use client';

import Select from '@/components/Select';
import { FUEL_TYPES, FUEL_TYPE_LABELS, isFuelType } from '@/lib/fuelTypes';
import { MIN_FUEL_EFFICIENCY_KM_L, MAX_FUEL_EFFICIENCY_KM_L, type VehicleFieldValues } from '@/lib/vehicles';

const LABEL = 'block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1';
const INPUT = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]';

interface VehicleFieldsProps {
  value: VehicleFieldValues;
  onChange: (next: VehicleFieldValues) => void;
  idPrefix: string;
}

export default function VehicleFields({ value, onChange, idPrefix }: VehicleFieldsProps) {
  const set = (key: keyof VehicleFieldValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [key]: e.target.value });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label htmlFor={`${idPrefix}-make`} className={LABEL}>Vehicle Make</label>
          <input id={`${idPrefix}-make`} type="text" maxLength={40} placeholder="Toyota" value={value.make} onChange={set('make')} className={INPUT} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-model`} className={LABEL}>Model</label>
          <input id={`${idPrefix}-model`} type="text" maxLength={40} placeholder="Vios" value={value.model} onChange={set('model')} className={INPUT} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-color`} className={LABEL}>Color</label>
          <input id={`${idPrefix}-color`} type="text" maxLength={30} placeholder="White" value={value.color} onChange={set('color')} className={INPUT} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-plate`} className={LABEL}>Plate Number</label>
          <input id={`${idPrefix}-plate`} type="text" maxLength={15} placeholder="ABC 1234" value={value.plate} onChange={set('plate')} className={INPUT} />
        </div>
      </div>
      <p className="text-[11px] text-gray-400">
        The plate is only shown to riders you&apos;ve approved — never in public search results.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label htmlFor={`${idPrefix}-fuel-type`} className={LABEL}>Fuel Type</label>
        <Select
          id={`${idPrefix}-fuel-type`}
          value={value.fuelType}
          onChange={(e) => isFuelType(e.target.value) && onChange({ ...value, fuelType: e.target.value })}
          className={`${INPUT} pr-9`}
        >
          {FUEL_TYPES.map((t) => (
            <option key={t} value={t}>{FUEL_TYPE_LABELS[t]}</option>
          ))}
        </Select>
        <p className="text-[11px] text-gray-400 mt-1">Sets which official fuel price applies.</p>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-efficiency`} className={LABEL}>Fuel Efficiency (km/L)</label>
        <input
          id={`${idPrefix}-efficiency`}
          type="number"
          min={MIN_FUEL_EFFICIENCY_KM_L}
          max={MAX_FUEL_EFFICIENCY_KM_L}
          step="0.1"
          placeholder="e.g., 14"
          value={value.fuelEfficiency}
          onChange={set('fuelEfficiency')}
          className={INPUT}
        />
        <p className="text-[11px] text-gray-400 mt-1">Used to estimate each passenger&apos;s fuel share automatically.</p>
      </div>
      </div>
    </div>
  );
}
