import React from 'react';
import { FaRoute, FaClock, FaCar, FaUsers, FaMapMarkerAlt, FaStickyNote } from 'react-icons/fa';
import Tip from '@/components/Tip';
import { seatsFact } from '@/lib/tripFacts';
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
// One fact: an icon whose label shows in a tooltip, then the value (sub-project I).
function Row({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <dt className="mt-0.5 shrink-0 text-gray-400">
        <Tip label={label}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only">{label}</span>
        </Tip>
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

export default function TripSummaryCard({ trip }: { trip: TripSummary }) {
  const status = tripStatusBadge(trip.status);
  const seatsLeft = trip.totalSeats - trip.filledSeats;

  return (
    <Card>
      <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-3">
        <h2 className="text-sm font-bold text-gray-900">Trip details</h2>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <dl className="text-sm text-gray-600 space-y-2.5">
        <Row icon={FaRoute} label="Route">
          {trip.originAddress} → {trip.destinationAddress}
        </Row>
        <Row icon={FaClock} label="Schedule">
          <span suppressHydrationWarning>
            {formatTime(trip.departureTime)} ({formatDate(trip.departureTime)} · {recurrenceLabel(trip.recurrenceType)})
          </span>
        </Row>
        <Row icon={FaCar} label="Vehicle">
          {trip.vehicle.make} {trip.vehicle.model} ({trip.vehicle.color})
          {trip.vehicle.plate && <span className="text-gray-500"> · Plate {trip.vehicle.plate}</span>}
        </Row>
        <Row icon={FaUsers} label="Seats">
          {seatsFact(trip.totalSeats, trip.filledSeats).long}
        </Row>
        {trip.meetingPointAddress && (
          <Row icon={FaMapMarkerAlt} label="Meeting point">
            {trip.meetingPointAddress}
          </Row>
        )}
        {trip.driverNotes && (
          <Row icon={FaStickyNote} label="Driver notes">
            {trip.driverNotes}
          </Row>
        )}
      </dl>
    </Card>
  );
}
