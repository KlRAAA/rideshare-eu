import React from 'react';
import Link from 'next/link';
import { FaApple, FaAndroid, FaExternalLinkAlt } from 'react-icons/fa';
import HelpShell from '../help/HelpShell';
import { getCurrentUser } from '@/lib/session';
import { EVALUATION_FORM_URL, SITE_URL } from '@/lib/evaluation';

export const metadata = { title: 'Test RideShareEU' };

// The tester's guide for the thesis evaluation (UAT): public, readable before
// signing up, and the page the printed QR code opens.
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rsu-card flex flex-col gap-3">
      <h2 id={id} className="text-lg font-bold text-gray-900">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm text-gray-800">
          <span
            aria-hidden
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--rsu-color-primary)] text-xs font-bold text-white"
          >
            {i + 1}
          </span>
          <span className="pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  );
}

const Note = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-gray-600">{children}</p>;

const PROBLEMS: [string, React.ReactNode][] = [
  [
    'The sign-up code didn’t arrive',
    'Wait a minute and check Spam or Other in your school email, then tap Resend. The email must end in @student.mseuf.edu.ph or @mseuf.edu.ph.',
  ],
  [
    'My driver’s license is still being checked',
    'Most licenses are checked within a minute. If yours wasn’t, an admin will review it during the test. A sharp photo with all four corners showing helps.',
  ],
  [
    'No notifications on my phone',
    'On an iPhone, open RideShareEU from the home screen icon, not from Safari. Then Profile → Notifications → Turn on, and allow them. Also check that notifications for the site are allowed in your browser settings.',
  ],
  [
    'The map doesn’t show where the driver is',
    'The driver’s phone must allow location and keep RideShareEU open with the screen on. A web page can’t send location from the background.',
  ],
  [
    'A ride I expected doesn’t show in Find a Ride',
    'Check the date and time you searched for, and that the trip goes your way. “Show all trips” lists every trip to your destination at any time.',
  ],
  ['“The app is busy, try again in a moment”', 'Many people are using it at once. Wait a few seconds and try again.'],
];

export default async function TestPage() {
  const user = await getCurrentUser();
  return (
    <HelpShell signedIn={Boolean(user)} plain>
      <div className="mx-auto flex max-w-2xl flex-col gap-4 pb-10">
        <header className="flex flex-col gap-3 pt-2">
          <h1 className="text-3xl font-bold text-gray-900">Test RideShareEU</h1>
          <p className="text-base text-gray-700">
            Thank you for helping evaluate our thesis app, the carpool service for the MSEUF community. It runs in your
            phone’s browser, so there’s nothing to install from an app store. Trying it and answering the form takes about
            30 minutes.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <a href={SITE_URL} className="rsu-btn-primary inline-flex items-center gap-2 px-5">
              Open RideShareEU
              <FaExternalLinkAlt className="h-3 w-3" aria-hidden />
            </a>
            <figure className="hidden items-center gap-3 md:flex">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/test-qr.svg" alt="QR code for this page" width={96} height={96} className="rounded-lg border border-gray-200 bg-white p-1" />
              <figcaption className="max-w-[12rem] text-sm text-gray-600">On a computer? Scan this with your phone.</figcaption>
            </figure>
          </div>
        </header>

        <Section id="phone" title="1. Put it on your phone">
          <Note>Recommended. On an iPhone it’s also needed for notifications.</Note>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <FaApple aria-hidden /> iPhone (Safari)
              </p>
              <Steps items={['Open the link in Safari.', 'Tap Share, then Add to Home Screen.', 'Open RideShareEU from the new icon.']} />
            </div>
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <FaAndroid aria-hidden /> Android (Chrome)
              </p>
              <Steps items={['Open the link in Chrome.', 'Tap ⋮, then Install app (or Add to Home screen).', 'Open RideShareEU from the new icon.']} />
            </div>
          </div>
        </Section>

        <Section id="account" title="2. Create your account">
          <Steps
            items={[
              <>
                Tap <strong>Create one</strong> and enter your school email (ending in @student.mseuf.edu.ph or @mseuf.edu.ph).
              </>,
              'Enter the 6-digit code we email you. Check Spam if it isn’t there after a minute.',
              'Add your first and last name, choose a password, and pick your gender (used only for Women+ trips; “Prefer not to say” is fine).',
              <>
                If you’ll try driving, answer <strong>Yes</strong> to “Will you drive?” and take a photo of your driver’s license
                with the in-app camera.
              </>,
            ]}
          />
        </Section>

        <Section id="notifications" title="3. Turn on notifications">
          <Steps
            items={[
              <>
                Go to <strong>Profile → Notifications</strong> and tap <strong>Turn on</strong>.
              </>,
              'Allow notifications when your phone asks. That’s how you hear about requests, approvals and messages.',
            ]}
          />
        </Section>

        <Section id="try" title="4. Try it out">
          <Note>
            Pair up with another tester if you can: one drives, one rides, so you can go through a whole trip together. The
            thesis team will also post test trips during the evaluation.
          </Note>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-gray-900">As a passenger</p>
            <Steps
              items={[
                'Find a Ride: enter where you start, MSEUF as the destination, and a date and time.',
                'Open a result and tap Request to join.',
                'Once the driver approves, open the trip: chat with the driver and share your location before pickup.',
                'When the driver starts the trip, follow the car on the map.',
                'After the trip, rate your driver.',
              ]}
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-gray-900">As a driver (needs your driver’s license)</p>
            <Steps
              items={[
                'On Home, switch to Driver.',
                'Post a Trip: your route, the time you leave, and how many seats.',
                'In My Trips, approve or decline the riders who ask to join.',
                'At departure, tap Start Trip, then Picked up for each rider, and End Trip at campus.',
                'Rate your riders.',
              ]}
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-gray-900">Everyone</p>
            <Note>Look around Alerts, Profile and Help, and try reporting a problem from a trip page.</Note>
          </div>
        </Section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Everything here is a test</p>
          <p className="mt-1">
            Trips you see and post during the evaluation are test trips: nobody has to actually drive or ride, and no
            money changes hands. Other testers can see your trips, so don’t share anything private in chats. Test
            accounts and trips are deleted after the evaluation period.
          </p>
        </section>

        <Section id="evaluate" title="5. Send your evaluation">
          <Note>
            After you’ve tried RideShareEU, please answer the form. It asks which group you’re answering for (student,
            faculty, staff, ICTD, Sustainability or Transportation) and takes about 10 to 15 minutes. It doesn’t record your
            name or email.
          </Note>
          {EVALUATION_FORM_URL ? (
            <a href={EVALUATION_FORM_URL} className="rsu-btn-primary inline-flex w-fit items-center gap-2 px-5">
              Open the evaluation form
              <FaExternalLinkAlt className="h-3 w-3" aria-hidden />
            </a>
          ) : (
            <p className="text-sm font-semibold text-gray-900">The thesis team will share the form link with you.</p>
          )}
        </Section>

        <Section id="problems" title="Found a problem?">
          <Note>
            Tell us right away, even before the form: what you did, what you expected, and what happened. A screenshot
            helps.
          </Note>
          <Note>
            In the app: <Link href="/help" className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline">Help</Link>{' '}
            → Contact admin. Or tell a member of the thesis team.
          </Note>
        </Section>

        <Section id="help" title="If something goes wrong">
          <dl className="divide-y divide-gray-100">
            {PROBLEMS.map(([q, a]) => (
              <div key={q} className="py-3 first:pt-0 last:pb-0">
                <dt className="text-sm font-semibold text-gray-900">{q}</dt>
                <dd className="mt-1 text-sm text-gray-600">{a}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <p className="text-center text-xs text-gray-500">RideShareEU · Thesis evaluation · Manuel S. Enverga University Foundation</p>
      </div>
    </HelpShell>
  );
}
