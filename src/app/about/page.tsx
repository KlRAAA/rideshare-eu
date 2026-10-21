import Link from 'next/link';
import { getCurrentUser } from '@/lib/session';
import HelpShell from '../help/HelpShell';

export const metadata = { title: 'About | RideShareEU' };

const H2 = 'text-base font-bold text-gray-900';
const P = 'mt-2 text-sm leading-relaxed text-gray-700';
const LIST = 'mt-2 space-y-1.5 text-sm leading-relaxed text-gray-700 list-disc pl-5';

// Worked example on this page, kept as numbers so the sum is computed, not typed.
const EXAMPLE = { km: 20, kmPerLitre: 12, pricePerLitre: 60, seats: 3 };
const exampleLitres = EXAMPLE.km / EXAMPLE.kmPerLitre;
const exampleShare = (exampleLitres * EXAMPLE.pricePerLitre) / EXAMPLE.seats;

// Public: what a rider or driver might want to check about how the app works.
export default async function AboutPage() {
  const user = await getCurrentUser();

  return (
    <HelpShell signedIn={Boolean(user)}>
      <article className="max-w-2xl space-y-8 pb-8">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">How RideShareEU works</h1>
          <p className={P}>
            Carpooling for Enverga students, faculty and staff. Drivers post the trips they already make; riders going the same way at
            the same time ask to join. The app never handles money.
          </p>
        </header>

        <section aria-labelledby="fuel">
          <h2 id="fuel" className={H2}>
            How the fuel share is worked out
          </h2>
          <p className={P}>Each seat shows a suggested fuel share: the fuel the trip uses, split across the seats the driver offers.</p>
          <p className="mt-3 rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">
            (distance ÷ km per litre) × fuel price ÷ seats offered
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <caption className="pb-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Example</caption>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="py-1.5 pr-4 text-gray-600">Route</td>
                  <td className="py-1.5 text-right text-gray-900">{EXAMPLE.km} km</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 text-gray-600">Car</td>
                  <td className="py-1.5 text-right text-gray-900">{EXAMPLE.kmPerLitre} km per litre</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 text-gray-600">Fuel used</td>
                  <td className="py-1.5 text-right text-gray-900">
                    {EXAMPLE.km} ÷ {EXAMPLE.kmPerLitre} = {exampleLitres.toFixed(2)} L
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 text-gray-600">Fuel price</td>
                  <td className="py-1.5 text-right text-gray-900">₱{EXAMPLE.pricePerLitre.toFixed(2)} per litre</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 text-gray-600">Seats offered</td>
                  <td className="py-1.5 text-right text-gray-900">{EXAMPLE.seats}</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 font-semibold text-gray-900">Fuel share per seat</td>
                  <td className="py-1.5 text-right font-semibold text-gray-900">₱{exampleShare.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className={LIST}>
            <li>The driver enters today&apos;s pump price. It can&apos;t be higher than the official Department of Energy price for that fuel (Lucena&apos;s highest monitored price, updated from the DOE&apos;s weekly list).</li>
            <li>It&apos;s worked out once, when the trip is posted, and doesn&apos;t change as seats fill. Everyone sees the same number.</li>
            <li>The driver&apos;s own seat isn&apos;t counted: riders share the fuel, not the car.</li>
            <li>It&apos;s a suggestion. Paying is voluntary and arranged between you, outside the app.</li>
          </ul>
        </section>

        <section aria-labelledby="matching">
          <h2 id="matching" className={H2}>
            How rides are matched
          </h2>
          <p className={P}>Find a Ride first keeps only the trips you can actually join:</p>
          <ul className={LIST}>
            <li>it runs on your date and still has a free seat;</li>
            <li>the driver passes your pickup before your drop-off;</li>
            <li>at least 40% of your route is on the driver&apos;s route;</li>
            <li>it leaves within the time window you chose;</li>
            <li>its rules let you join (Women+ or familiar riders only).</li>
          </ul>
          <p className={P}>
            The rest are ranked by one score: route overlap counts for half, how close the departure is to your time for 30%, and seats
            and preferences for 20%. Each result shows why it matched.
          </p>
        </section>

        <section aria-labelledby="rules">
          <h2 id="rules" className={H2}>
            Rules for every trip
          </h2>
          <ul className={LIST}>
            <li>
              <strong>Up to 4 riders per car.</strong> More overloads a car, and a van carrying paying riders can count as a colorum
              vehicle.
            </li>
            <li>
              <strong>One trip at a time.</strong> You can&apos;t drive or ride two trips that overlap, counting the trip&apos;s travel time
              and 10 minutes before and after.
            </li>
            <li>
              <strong>Cancelling.</strong> A driver can cancel until the trip starts. A rider can cancel until the driver marks them
              picked up. Add a reason: the other side is told.
            </li>
            <li>
              <strong>Repeated cancelling</strong> pauses new requests for a while and is flagged to the admins.
            </li>
            <li>
              <strong>Late drivers.</strong> Riders are told when the driver hasn&apos;t started 15 minutes after departure; after an hour
              the trip counts as a no-show.
            </li>
            <li>
              <strong>Ratings.</strong> After each ride, riders rate the driver and the driver rates the riders (1 to 5 stars). Your trust
              score is the average of the ratings you&apos;ve received. Rate your last ride before you request or post the next one.
            </li>
          </ul>
        </section>

        <section aria-labelledby="safety">
          <h2 id="safety" className={H2}>
            Safety
          </h2>
          <ul className={LIST}>
            <li>Only MSEUF accounts: sign-up needs a school email and a one-time code.</li>
            <li>Every driver&apos;s license is checked before they can post a trip.</li>
            <li>Women+ trips are only for women and non-binary riders, posted by women and non-binary drivers.</li>
            <li>You can share your location with your driver before pickup, and follow the car on the map during the trip.</li>
            <li>
              Report anyone you rode with from the trip page. In an emergency, call <strong>911</strong>; see{' '}
              <Link href="/help" className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
                Help
              </Link>
              .
            </li>
          </ul>
        </section>

        <section aria-labelledby="data">
          <h2 id="data" className={H2}>
            Your data
          </h2>
          <p className={P}>
            What we keep, why, and for how long is in the{' '}
            <Link href="/privacy" className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
              Privacy Policy
            </Link>
            ; the rules of use are in the{' '}
            <Link href="/terms" className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
              Terms of Use
            </Link>
            .
          </p>
        </section>
      </article>
    </HelpShell>
  );
}
