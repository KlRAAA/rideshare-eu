import Card from '@/components/Card';
import { formatDateTime } from '@/lib/admin';
import { FUEL_TYPES, FUEL_TYPE_SHORT_LABELS, type FuelType, type OfficialFuelPrices } from '@/lib/fuelTypes';
import { CheckDoeButton, HeldDoeActions } from './DoeActions';

export interface DoeImport {
  id: string;
  sourceUrl: string | null;
  period: string | null;
  regular: number | null;
  premium: number | null;
  diesel: number | null;
  status: 'APPLIED' | 'HELD' | 'DISMISSED' | 'FAILED';
  reason: string | null;
  decidedById: string | null;
  createdAt: string;
}

const STATUS: Record<DoeImport['status'], { label: string; tone: string }> = {
  APPLIED: { label: 'Applied', tone: 'rsu-badge-success' },
  HELD: { label: 'Waiting for you', tone: 'rsu-badge-warning' },
  DISMISSED: { label: 'Kept current prices', tone: 'rsu-badge-neutral' },
  FAILED: { label: 'Couldn’t read', tone: 'border border-red-200 bg-red-50 text-red-600' },
};

const doePrice = (row: DoeImport, type: FuelType) => ({ REGULAR: row.regular, PREMIUM: row.premium, DIESEL: row.diesel })[type];
const peso = (n: number) => `₱${n.toFixed(2)}`;

function StatusChip({ status }: { status: DoeImport['status'] }) {
  return <span className={`rsu-badge ${STATUS[status].tone}`}>{STATUS[status].label}</span>;
}

export default function DoeCard({ imports, sourcePage, prices }: { imports: DoeImport[]; sourcePage: string; prices: OfficialFuelPrices }) {
  const [latest, ...older] = imports;
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-gray-900">Automatic from the DOE</h2>
          <p className="mt-1 max-w-prose text-xs text-gray-500">
            Every day at 10 AM and 3 PM the app reads the DOE&apos;s weekly price report for Region IV-A and sets each cap to the
            highest price the DOE found in Lucena. A change of more than 15% waits for you. You can still set a price by hand below.
          </p>
        </div>
        <CheckDoeButton />
      </div>

      {!latest ? (
        <p className="text-sm text-gray-500">Not checked yet.</p>
      ) : (
        <div className="space-y-2 rounded-xl border border-gray-200 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusChip status={latest.status} />
            <span className="font-semibold text-gray-900">{latest.period ?? 'Week not found'}</span>
            <span className="text-xs text-gray-500">read {formatDateTime(latest.createdAt)}</span>
          </div>
          {latest.reason && latest.status !== 'APPLIED' && <p className="text-sm text-gray-700">{latest.reason}</p>}
          {latest.status === 'APPLIED' && latest.decidedById && (
            <p className="text-xs text-gray-500">An admin applied these after the 15% check held them.</p>
          )}
          {latest.status !== 'FAILED' && (
            <dl className="grid grid-cols-3 gap-2 text-sm">
              {FUEL_TYPES.map((type) => {
                const value = doePrice(latest, type);
                const now = prices[type]?.pricePerLiter;
                return (
                  <div key={type}>
                    <dt className="text-xs text-gray-500">{FUEL_TYPE_SHORT_LABELS[type]}</dt>
                    <dd className="font-semibold tabular-nums text-gray-900">{value != null ? peso(value) : '—'}</dd>
                    {latest.status === 'HELD' && now != null && <dd className="text-xs tabular-nums text-gray-500">now {peso(now)}</dd>}
                  </div>
                );
              })}
            </dl>
          )}
          {latest.status === 'HELD' && <HeldDoeActions importId={latest.id} />}
          {latest.status === 'FAILED' && <p className="text-xs text-gray-600">Set this week&apos;s prices by hand below.</p>}
          {latest.sourceUrl && (
            <a href={latest.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-semibold underline text-gray-700">
              Open the DOE file
            </a>
          )}
        </div>
      )}

      {older.length > 0 && (
        <ul className="divide-y divide-gray-100 text-xs">
          {older.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span className="text-gray-700">{row.period ?? 'Week not found'}</span>
              <span className="flex items-center gap-2">
                <StatusChip status={row.status} />
                <span className="text-gray-500">{formatDateTime(row.createdAt)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <a href={sourcePage} target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-semibold underline text-gray-700">
        DOE South Luzon pump prices
      </a>
    </Card>
  );
}
