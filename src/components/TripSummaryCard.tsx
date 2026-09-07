import React from 'react';
import Card from './Card';
import Badge from './Badge';
import { formatDate, formatTime, recurrenceLabel } from '@/lib/format';
import { tripStatusBadge } from '@/lib/statusBadge';

interface TripSummaryVehicle {
  make: string;
  model: string;
  color: string;
  plate?: string | null;
}

export interface TripSummary {
  originAddress: string;
  destinationAddress: string;
  departureTime: string;
  recurrenceType: string;
  totalSeats: number;
  filledSeats: number;
  vehicle: TripSummaryVehicle;
  status: string;
  driverNotes?: string | null;
  meetingPointAddress?: string | null;
}

// The Route / Schedule / Vehicle / Seats block shared by the My Trips detail
// page and the Ride Details page. Plate visibility is decided server-side
// (masked to null for anyone but the host and approved co-riders), so this
// just renders whatever it's given.
export default function TripSummaryCard({ trip }: { trip: TripSummary }) {
  const status = tripStatusBadge(trip.status);
  const seatsLeft = trip.totalSeats - trip.filledSeats;

  return (
    <Card>
      <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-3">
        <h2 className="text-sm font-bold text-gray-900">Trip details</h2>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <div className="text-sm text-gray-600 space-y-2">
        <p>
          <span className="font-semibold block text-gray-800">Route</span>
          {trip.originAddress} → {trip.destinationAddress}
        </p>
        <p suppressHydrationWarning>
          <span className="font-semibold block text-gray-800">Schedule</span>
          {formatTime(trip.departureTime)} ({formatDate(trip.departureTime)} · {recurrenceLabel(trip.recurrenceType)})
        </p>
        <p>
          <span className="font-semibold block text-gray-800">Vehicle</span>
          {trip.vehicle.make} {trip.vehicle.model} ({trip.vehicle.color})
          {trip.vehicle.plate && <span className="text-gray-500"> · Plate {trip.vehicle.plate}</span>}
        </p>
        <p>
          <span className="font-semibold block text-gray-800">Seats</span>
          {seatsLeft} available ({trip.filledSeats}/{trip.totalSeats} filled)
        </p>
        {trip.meetingPointAddress && (
          <p>
            <span className="font-semibold block text-gray-800">Meeting point</span>
            {trip.meetingPointAddress}
          </p>
        )}
        {trip.driverNotes && (
          <p>
            <span className="font-semibold block text-gray-800">Driver notes</span>
            {trip.driverNotes}
          </p>
        )}
      </div>
    </Card>
  );
}
