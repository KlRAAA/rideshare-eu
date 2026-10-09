'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const EVERY_MS = 3000;
const FOR_MS = 90 * 1000;

// While the automatic check runs (a few seconds), reload the page's data so
// the result shows without a manual refresh.
export default function CheckingRefresh() {
  const router = useRouter();
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > FOR_MS) return clearInterval(id);
      router.refresh();
    }, EVERY_MS);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
