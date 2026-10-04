import Card from '@/components/Card';
import { adminFetch } from '@/app/auth/admin/adminFetch';
import { formatDateTime } from '@/lib/admin';
import AnnouncementForm from './AnnouncementForm';
import EndAnnouncementButton from './EndAnnouncementButton';

interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  endsAt: string | null;
}

const isActive = (a: Announcement, now: number) => !a.endsAt || new Date(a.endsAt).getTime() > now;

export default async function AdminAnnouncementsPage() {
  const { announcements } = await adminFetch<{ announcements: Announcement[] }>('/api/admin/announcements');
  const now = Date.now();

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-sm font-bold text-gray-900">New announcement</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Every user gets a notification, and the newest active announcement shows at the top of their dashboard.
        </p>
        <AnnouncementForm />
      </Card>
      <Card>
        <h2 className="text-sm font-bold text-gray-900 mb-2">Posted</h2>
        {announcements.length === 0 ? (
          <p className="text-sm text-gray-500">No announcements yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {announcements.map((a) => {
              const active = isActive(a, now);
              return (
                <li key={a.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 break-words">{a.title}</p>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{a.body}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Posted {formatDateTime(a.createdAt)}
                      {a.endsAt ? ` · ${active ? 'ends' : 'ended'} ${formatDateTime(a.endsAt)}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                        active ? 'bg-green-50 text-green-800 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}
                    >
                      {active ? 'Active' : 'Ended'}
                    </span>
                    {active && <EndAnnouncementButton id={a.id} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
