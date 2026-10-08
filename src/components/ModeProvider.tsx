'use client';

import React, { createContext, useContext } from 'react';
import type { AppMode } from '@/lib/modeNav';

// The signed-in user's current mode (sub-project C), set once by the /auth
// layout so the header, bottom bar and pages don't each fetch it.
const ModeContext = createContext<AppMode>('PASSENGER');

export function ModeProvider({ mode, children }: { mode: AppMode; children: React.ReactNode }) {
  return <ModeContext.Provider value={mode}>{children}</ModeContext.Provider>;
}

export function useMode(): AppMode {
  return useContext(ModeContext);
}
