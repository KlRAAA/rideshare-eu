import Card from '@/components/Card';
import { apiFetch } from '@/lib/api-server';
import { formatDateTime } from '@/lib/admin';
import FuelPriceForm from './FuelPriceForm';

interface HistoryRow {
  id: string;
  pricePerLiter: number;
  createdAt: string;
  setBy: { id: string; fullName: string };
}

export default async function AdminFuelPricePage() {
  const [{ official, updatedAt }, { history }] = await Promise.all([
    apiFetch<{ official: number | null; updatedAt: string | null }>('/api/fuel-price'),
    apiFetch<{ history: HistoryRow[] }>('/api/admin/fuel-price/history'),
  ]);

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Official price</p>
        <p className="text-3xl font-extrabold text-gray-900 tabular-nums mt-1">
          {official != null ? `₱${official.toFixed(2)}/L` : 'Not set'}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {updatedAt ? `Updated ${formatDateTime(updatedAt)}. ` : ''}
          Hosts can enter this price or less when posting a trip, never more. Trips already posted keep their price.
        </p>
        <FuelPriceForm current={official} />
      </Card>
      <Card>
        <h2 className="text-sm font-bold text-gray-900 mb-2">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">No official price has been set yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {history.map((h) => (
              <li key={h.id} className="py-2 flex justify-between gap-3 text-sm">
                <span className="tabular-nums font-semibold text-gray-900">₱{h.pricePerLiter.toFixed(2)}</span>
                <span className="text-xs text-gray-500 text-right">
                  {h.setBy.fullName} · {formatDateTime(h.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
