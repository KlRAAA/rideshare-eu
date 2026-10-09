import Card from '@/components/Card';
import { adminFetch } from '@/app/auth/admin/adminFetch';
import { formatDateTime } from '@/lib/admin';
import {
  DOE_PUMP_PRICES_URL,
  FUEL_TYPES,
  FUEL_TYPE_LABELS,
  FUEL_TYPE_SHORT_LABELS,
  stalePriceReminder,
  type FuelType,
  type OfficialFuelPrices,
} from '@/lib/fuelTypes';
import FuelPriceForm from './FuelPriceForm';
import DoeCard, { type DoeImport } from './DoeCard';

interface HistoryRow {
  id: string;
  fuelType: FuelType;
  pricePerLiter: number;
  createdAt: string;
  setBy: { id: string; fullName: string } | null; // null: applied automatically from a DOE file
  doe: { period: string | null; sourceUrl: string | null } | null;
}

export default async function AdminFuelPricePage() {
  const [{ prices }, { history }, doe] = await Promise.all([
    adminFetch<{ prices: OfficialFuelPrices }>('/api/fuel-price'),
    adminFetch<{ history: HistoryRow[] }>('/api/admin/fuel-price/history'),
    adminFetch<{ imports: DoeImport[]; sourcePage: string }>('/api/admin/fuel-price/doe'),
  ]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Hosts can enter their car&apos;s official price or less when posting a trip, never more. Trips already posted keep
        their price.
      </p>
      <DoeCard imports={doe.imports} sourcePage={doe.sourcePage} prices={prices} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {FUEL_TYPES.map((type) => {
          const price = prices[type];
          const reminder = stalePriceReminder(type, price);
          return (
            <Card key={type} className="flex flex-col">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{FUEL_TYPE_LABELS[type]}</p>
              <p className="text-3xl font-extrabold text-gray-900 tabular-nums mt-1">
                {price ? `₱${price.pricePerLiter.toFixed(2)}/L` : 'Not set'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {price ? `Updated ${formatDateTime(price.updatedAt)}` : 'Hosts with this fuel type have no cap yet.'}
              </p>
              {reminder && (
                <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {reminder}{' '}
                  <a href={DOE_PUMP_PRICES_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                    Open DOE pump prices
                  </a>
                </p>
              )}
              <div className="mt-auto">
                <FuelPriceForm fuelType={type} current={price ? price.pricePerLiter : null} />
              </div>
            </Card>
          );
        })}
      </div>
      <Card>
        <h2 className="text-sm font-bold text-gray-900 mb-2">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">No official price has been set yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {history.map((h) => (
              <li key={h.id} className="py-2 flex justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-semibold text-gray-600 w-16 shrink-0">{FUEL_TYPE_SHORT_LABELS[h.fuelType]}</span>
                  <span className="tabular-nums font-semibold text-gray-900">₱{h.pricePerLiter.toFixed(2)}</span>
                </span>
                <span className="text-xs text-gray-500 text-right">
                  {h.setBy?.fullName ?? 'DOE update'}
                  {h.doe?.period ? ` · DOE ${h.doe.period}` : ''} · {formatDateTime(h.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
