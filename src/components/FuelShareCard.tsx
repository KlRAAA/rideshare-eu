import React from 'react';

// The maroon "Voluntary Fuel Share" callout. Framed as a suggested contribution,
// never a fare — the thesis is explicit that no payments pass through the system.
export default function FuelShareCard({ amount }: { amount: number }) {
  return (
    <div className="bg-[color:var(--rsu-color-primary)] text-white rounded-2xl p-5 shadow-md">
      <h3 className="text-sm font-bold mb-1">Voluntary Fuel Share</h3>
      <p className="text-xs text-white/80 mb-3">
        Calculated based on distance and current occupancy — not a fare, arranged directly between riders.
      </p>
      <p className="text-2xl font-bold">₱{amount.toFixed(2)}</p>
    </div>
  );
}
