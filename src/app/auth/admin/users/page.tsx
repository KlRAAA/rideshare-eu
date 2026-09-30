import Link from 'next/link';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import { adminFetch } from '@/app/auth/admin/adminFetch';

interface AdminUserRow {
  id: string;
  email: string;
  universityId: string;
  fullName: string;
  role: string;
  isAdmin: boolean;
  isBanned: boolean;
  trustScore: number;
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const { users } = await adminFetch<{ users: AdminUserRow[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`);

  return (
    <div className="space-y-3">
      <form action="/auth/admin/users" className="flex gap-2" role="search">
        <label htmlFor="admin-user-search" className="sr-only">
          Search users
        </label>
        <input
          id="admin-user-search"
          name="q"
          defaultValue={q}
          placeholder="Name, email or university ID"
          className="flex-1 min-w-0 px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
        />
        <button type="submit" className="rsu-btn-primary shrink-0">
          Search
        </button>
      </form>
      <Card className="!p-0 overflow-hidden">
        {users.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No users match “{q}”.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {users.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/auth/admin/users/${u.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900 truncate">{u.fullName}</span>
                    <span className="block text-xs text-gray-500 truncate">{u.email}</span>
                  </span>
                  <span className="flex flex-wrap justify-end gap-1 shrink-0">
                    {u.isAdmin && <Badge tone="primary">Admin</Badge>}
                    {u.isBanned && <Badge tone="warning">Banned</Badge>}
                    <Badge tone="neutral">{u.role.toLowerCase()}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {!q && <p className="text-xs text-gray-400">Showing the 50 newest accounts. Search to find anyone else.</p>}
    </div>
  );
}
