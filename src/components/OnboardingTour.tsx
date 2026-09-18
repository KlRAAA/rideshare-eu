'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Joyride, STATUS, type EventData, type Step } from 'react-joyride';
import { apiFetch } from '@/lib/api';

// Real dashboard elements only — see the `data-tour` attributes on
// Header.tsx and dashboard/page.tsx. The last two steps have no live target:
// a first-time user has no matches yet (no trip to attach a real "Report"
// button or a masked profile card to), so they're deliberately centered
// informational steps rather than a spotlight faked onto an unrelated element.
const STEPS: Step[] = [
  {
    target: '[data-tour="main-nav"]',
    content: 'This is your navigation — Dashboard, My Trips, Notifications, and Profile are always one tap away.',
  },
  {
    target: '[data-tour="post-ride"]',
    content: 'Driving somewhere? Post a ride here to offer seats to other students on your route.',
  },
  {
    target: '[data-tour="find-ride"]',
    content: "Need a ride instead? Search here — the matching algorithm ranks rides by route overlap and timing for you.",
  },
  {
    target: '[data-tour="upcoming-trips"]',
    content:
      "Once you post or request a ride, it shows up here. A join request needs the host's approval before it's confirmed.",
  },
  {
    target: 'body',
    placement: 'center',
    content:
      "If anything ever feels wrong with a ride or a person you've matched with, you can privately report it from their profile or the trip page. Your identity is never shared with the person you report — not even that a report was filed.",
  },
  {
    target: 'body',
    placement: 'center',
    content:
      "Until you're matched with someone, a few details (like exact vehicle info) stay hidden on their profile. That's intentional — it becomes visible once a request is approved, to keep things safer before you've actually connected.",
  },
];

interface OnboardingTourProps {
  hasSeenOnboarding: boolean;
}

// Same maroon "Create New Trip" and every other primary button uses
// (globals.css's --rsu-color-primary) — this fallback is that variable's own
// literal value, used only for the brief window before the effect below can
// read the live CSS custom property (document isn't available during this
// client component's server-side render pass, so it can't be read inline).
const FALLBACK_PRIMARY_COLOR = '#800000';

export default function OnboardingTour({ hasSeenOnboarding }: OnboardingTourProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [run, setRun] = useState(false);
  const [primaryColor, setPrimaryColor] = useState(FALLBACK_PRIMARY_COLOR);

  // Fires once per mount: either this is a genuinely first-time user, or
  // "Show tutorial again" navigated here with ?tour=1 to force a replay
  // without touching the DB flag at all.
  useEffect(() => {
    const forcedReplay = searchParams.get('tour') === '1';
    if (!hasSeenOnboarding || forcedReplay) setRun(true);

    const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--rsu-color-primary').trim();
    if (themeColor) setPrimaryColor(themeColor);
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
      steps={STEPS}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      locale={{ back: 'Back', close: 'Close', last: 'Finish', next: 'Next', skip: 'Skip' }}
      options={{
        buttons: ['back', 'skip', 'primary'],
        showProgress: true,
        skipBeacon: true,
        primaryColor,
        zIndex: 10000,
      }}
    />
  );
}
