'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Joyride, STATUS, type EventData, type Step } from 'react-joyride';
import { apiFetch } from '@/lib/api';
import { useMode } from '@/components/ModeProvider';
import type { AppMode } from '@/lib/modeNav';

// Five stops, each on a real button: the mode switch on Home, then the
// tabs. A tab exists twice (bottom bar on phones, header on computers), so
// each step points at whichever copy is on screen. Wording follows the mode.
function visible(key: string): () => HTMLElement | null {
  return () =>
    Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`)).find((el) => el.getBoundingClientRect().width > 0) ??
    null;
}

const tab = (key: string, title: string, content: string): Step => ({
  target: visible(`tab-${key}`),
  title,
  content,
  isFixed: true, // the bottom bar and the header don't scroll
});

function stepsFor(mode: AppMode): Step[] {
  const modeStep: Step = {
    target: visible('mode-switch'),
    title: 'Passenger or Driver',
    content:
      mode === 'DRIVER'
        ? 'You’re in Driver mode. Switch to Passenger when you need a ride instead.'
        : 'Ride with others as a Passenger. Switch to Driver to post your own trips. You can switch any time.',
  };
  if (mode === 'DRIVER') {
    return [
      modeStep,
      tab('post', 'Post a Trip', 'Your route, time and seats. Riders going your way can then ask to join. You need an approved driver’s license first.'),
      tab('trips', 'My Trips', 'Approve riders, confirm each trip day, and tap Start Trip when you leave so riders can follow you on the map.'),
      tab('notifications', 'Alerts', 'Join requests, messages, and a “Still driving tomorrow?” check the evening before.'),
      tab('profile', 'Profile and help', 'Your license, cars and phone notifications. Report a problem from the trip page; the person never sees who reported.'),
    ];
  }
  return [
    modeStep,
    tab('search', 'Find a Ride', 'Enter where you start and when. Rides on your way, near your time, come first.'),
    tab('trips', 'My Rides', 'Rides you asked to join. Each is confirmed when the driver approves, which opens the chat and the live map.'),
    tab('notifications', 'Alerts', 'Approvals, messages and trip updates. Turn on phone notifications in Profile so you don’t miss them.'),
    tab('profile', 'Profile and help', 'Your ride preferences and phone notifications. Report a problem from the trip page; the person never sees who reported.'),
  ];
}

interface OnboardingTourProps {
  hasSeenOnboarding: boolean;
}

// react-joyride renders its tooltip via inline JS-driven styles (its own
// `options` object), not CSS classes — so unlike the rest of the app, it is
// NOT covered by globals.css's class-based dark-mode overrides at all. Found
// by actually inspecting the rendered tooltip's computed background (still
// pure white in dark mode) rather than assuming the CSS layer reached it.
// These fallbacks are globals.css's own light-mode token values, used only
// for the brief window before the effect below can read the live CSS custom
// properties (document isn't available during this client component's
// server-side render pass, so they can't be read inline).
const FALLBACK_COLORS = {
  primaryColor: '#800000',
  backgroundColor: '#ffffff',
  textColor: '#111827',
  arrowColor: '#ffffff',
};

function readThemeColors() {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  const backgroundColor = read('--color-surface-alt', FALLBACK_COLORS.backgroundColor);
  return {
    primaryColor: read('--rsu-color-primary', FALLBACK_COLORS.primaryColor),
    backgroundColor,
    textColor: read('--color-text', FALLBACK_COLORS.textColor),
    arrowColor: backgroundColor,
  };
}

export default function OnboardingTour({ hasSeenOnboarding }: OnboardingTourProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = useMode();
  const [run, setRun] = useState(false);
  const [themeColors, setThemeColors] = useState(FALLBACK_COLORS);

  // Fires once per mount: either this is a genuinely first-time user, or
  // "Show tutorial again" navigated here with ?tour=1 to force a replay
  // without touching the DB flag at all.
  useEffect(() => {
    const forcedReplay = searchParams.get('tour') === '1';
    if (!hasSeenOnboarding || forcedReplay) setRun(true);

    setThemeColors(readThemeColors());

    // Re-reads if the theme changes while the tour happens to be open (the
    // toggle lives in the header the tour itself is pointing at in step 1) —
    // cheap enough to just always watch rather than special-case that one
    // step.
    const observer = new MutationObserver(() => setThemeColors(readThemeColors()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleEvent(data: EventData) {
    const { status } = data;
    const finished = status === STATUS.FINISHED || status === STATUS.SKIPPED;
    if (!finished) return;

    setRun(false);
    // Skipping and finishing are treated identically — either one means
    // "don't show this again automatically." Idempotent server-side, so a
    // replay triggered via ?tour=1 hitting this again on an already-true
    // account is harmless.
    apiFetch('/api/users/me/onboarding', { method: 'PATCH' }).catch(() => {
      // Best-effort: worst case the tour shows once more next login, which
      // is a minor inconvenience, not a broken flow — never block on this.
    });

    if (searchParams.get('tour') === '1') {
      router.replace('/auth/dashboard');
    }
  }

  return (
    <Joyride
      key={mode} // a mode switch mid-tour starts the right tour
      steps={stepsFor(mode)}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      locale={{ back: 'Back', close: 'Close', last: 'Finish', next: 'Next', skip: 'Skip' }}
      options={{
        buttons: ['back', 'skip', 'primary'],
        showProgress: true,
        skipBeacon: true,
        // Clears the sticky header when scrolling a step into view.
        scrollOffset: 120,
        zIndex: 10000,
        ...themeColors,
      }}
    />
  );
}
