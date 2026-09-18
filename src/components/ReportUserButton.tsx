'use client';

import React, { useState } from 'react';
import { FaFlag } from 'react-icons/fa';
import ReportModal from './ReportModal';

export default function ReportUserButton({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:underline"
      >
        <FaFlag className="w-3 h-3" />
        Report user
      </button>
      {open && <ReportModal reportedUserName={userName} reportedUserId={userId} onClose={() => setOpen(false)} />}
    </>
  );
}
