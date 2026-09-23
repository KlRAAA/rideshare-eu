import { redirect } from 'next/navigation';

// No content of its own — "/" always sends straight to the login page. Without
// this, the bare root URL 404s (there's no page.tsx here otherwise), which is
// the first thing anyone hits when opening a shared link (e.g. a tunnel URL
// for phone testing) that doesn't already include a path.
export default function RootPage() {
  redirect('/login');
}
