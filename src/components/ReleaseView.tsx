import React from 'react';
import { formatDateTime } from '@/lib/admin';
import { basisLabel, RELEASE_FOOTER, tripRoleLabel, type Release, type ReleaseTrip } from '@/lib/dataRequests';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function repeatLabel(t: ReleaseTrip): string | null {
  if (t.recurrenceType === 'DAILY') return 'Repeats daily';
  if (t.recurrenceType === 'WEEKDAYS') return 'Repeats on weekdays';
  if (t.recurrenceType === 'CUSTOM') return `Repeats on ${t.customDays.map((d) => DAY_NAMES[d] ?? d).join(', ')}`;
  return null;
}

const phDate = (iso: string) => new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium' });

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900">{children}</dd>
    </>
  );
}

function TripBlock({ trip }: { trip: ReleaseTrip }) {
  const repeat = repeatLabel(trip);
  return (
    <section className="rsu-card break-inside-avoid">
      <h3 className="font-semibold text-gray-900">
        {formatDateTime(trip.departureTime)}
        {repeat && <span className="font-normal text-gray-500"> · {repeat}</span>}
      </h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm mt-2">
        <Row label="From">{trip.origin ?? 'Erased'}</Row>
        <Row label="To">{trip.destination ?? 'Erased'}</Row>
        {trip.meetingPoint && <Row label="Meeting point">{trip.meetingPoint}</Row>}
        <Row label="Trip status">{trip.status.toLowerCase()}</Row>
        <Row label="Role">
          {tripRoleLabel(trip.subjectRole)}
          {trip.subjectRequestStatus && ` (request ${trip.subjectRequestStatus.toLowerCase()})`}
        </Row>
        <Row label="Driver">{trip.driver ?? 'Unknown'}</Row>
        <Row label="Co-riders">{trip.coRiders.length ? trip.coRiders.join(', ') : 'None'}</Row>
        {trip.car && (
          <Row label="Car">
            {trip.car.make} {trip.car.model} ({trip.car.color}) · plate {trip.car.plate ?? 'not recorded'}
          </Row>
        )}
      </dl>
      {trip.messages && (
        <div className="mt-3 border-t border-gray-100 pt-2">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Trip chat</p>
          {trip.messages.length === 0 ? (
            <p className="text-sm text-gray-500">No messages.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {trip.messages.map((m, i) => (
                <li key={i}>
                  <span className="text-gray-500">{formatDateTime(m.sentAt)} · {m.sender ?? 'Unknown'}:</span> {m.body}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

// The printable summary of one data request release (superadmin spec §5).
export default function ReleaseView({ release }: { release: Release }) {
  const { request, subject } = release;
  const range =
    request.legalBasis === 'EMERGENCY'
      ? 'Emergency: minimum information only'
      : `${phDate(request.fromDate!)} to ${phDate(request.toDate!)}`;
  return (
    <article className="space-y-4">
      <style>{'@media print { header, nav, .no-print { display: none !important; } }'}</style>
      <section className="rsu-card">
        <h2 className="text-lg font-bold text-gray-900">Records release</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm mt-2">
          <Row label="Agency">{request.agency}</Row>
          <Row label="Officer">{request.officerName}</Row>
          <Row label="Reference">{request.referenceNumber}</Row>
          <Row label="Legal basis">{basisLabel(request.legalBasis)}</Row>
          <Row label="Covers">{range}</Row>
          <Row label="Generated">{formatDateTime(release.generatedAt)}</Row>
        </dl>
      </section>
      <section className="rsu-card">
        <h2 className="text-sm font-bold text-gray-900">Person</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm mt-2">
          <Row label="Name">{subject.name ?? 'Unknown'}</Row>
          <Row label="University ID">{subject.universityId ?? 'Not recorded'}</Row>
          <Row label="Role">{subject.role?.toLowerCase() ?? 'Unknown'}</Row>
        </dl>
        {subject.deleted && (
          <p className="text-xs text-amber-800 mt-2">This account was deleted; some details were erased.</p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-900">Trips ({release.trips.length})</h2>
        {release.trips.length === 0 ? (
          <p className="text-sm text-gray-500">No trips in this range.</p>
        ) : (
          release.trips.map((t, i) => <TripBlock key={i} trip={t} />)
        )}
      </section>
      {release.supportRequests && (
        <section className="rsu-card">
          <h2 className="text-sm font-bold text-gray-900">Support requests ({release.supportRequests.length})</h2>
          {release.supportRequests.map((s, i) => (
            <div key={i} className="mt-3">
              <p className="text-sm font-semibold text-gray-900">
                {s.subject} <span className="font-normal text-gray-500">· {formatDateTime(s.createdAt)}</span>
              </p>
              <ul className="space-y-1 text-sm mt-1">
                {s.messages.map((m, j) => (
                  <li key={j}>
                    <span className="text-gray-500">{formatDateTime(m.sentAt)} · {m.from}:</span> {m.body}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
      <p className="text-xs text-gray-500 border-t border-gray-200 pt-2">{RELEASE_FOOTER}</p>
    </article>
  );
}
