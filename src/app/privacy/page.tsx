import Link from 'next/link';
import LegalDocument, { LegalSection } from '@/components/LegalDocument';
import { getCurrentUser } from '@/lib/session';

export const metadata = { title: 'Privacy Policy | RideShareEU' };

const CONTACT = 'rideshare.eu.system@gmail.com';

// Every statement here describes what the code actually does. When a feature
// changes what is collected, shown or shared, update this page and
// LEGAL_VERSION (src/components/LegalDocument.tsx).
export default async function PrivacyPage() {
  const user = await getCurrentUser();
  const mail = (
    <a href={`mailto:${CONTACT}`} className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
      {CONTACT}
    </a>
  );

  return (
    <LegalDocument
      title="Privacy Policy"
      signedIn={Boolean(user)}
      intro={
        <p>
          RideShareEU is a carpool app for the Manuel S. Enverga University Foundation (MSEUF) community, run by a
          student research team as part of a thesis pilot. This policy explains what personal information we
          collect, why, who can see it, and your rights under the Data Privacy Act of 2012 (Republic Act 10173).
          Questions or requests: {mail}.
        </p>
      }
    >
      <LegalSection title="1. What we collect">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Account:</strong> your MSEUF email, full name, university ID, password (stored only as a one-way
            hash, never readable), your role (taken from your email domain) and, if you add one, a profile photo.
          </li>
          <li>
            <strong>Gender (optional):</strong> what you choose to declare. It is used only to apply Women+ trip
            rules and defaults to &ldquo;Prefer not to say&rdquo;.
          </li>
          <li>
            <strong>Trips you post:</strong> start and destination addresses and map points, the route, departure
            time and schedule, seats, fuel price, notes, meeting point, and your car&rsquo;s make, model, colour,
            fuel efficiency and plate number.
          </li>
          <li>
            <strong>Rides you join:</strong> your join requests and their status, ratings and reviews you give and
            receive, and your ride preferences.
          </li>
          <li>
            <strong>Messages:</strong> trip chat messages, and help requests with the admins&rsquo; replies.
          </li>
          <li>
            <strong>Location:</strong> the addresses you type and the map pins you set when searching or posting.
            Live location is shared only if you turn on Live Location Sharing: during a trip, the host&rsquo;s
            phone sends its current position. We keep only the latest position on the trip, not a history.
          </li>
          <li>
            <strong>Safety records:</strong> reports you file or that name you, official warnings, suspensions, and
            admin notes about them.
          </li>
          <li>
            <strong>Technical:</strong> a sign-in cookie; security events such as failed sign-ins and blocked
            requests (with the IP address and a partly hidden email); error reports when something breaks; and
            visit counts that do not identify you.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. How we use it">
        <ul className="list-disc pl-5 space-y-1">
          <li>To match riders with drivers going the same way, and to show trips, fuel shares and notifications.</li>
          <li>To email you sign-up and password-reset codes, and notices about warnings or suspensions.</li>
          <li>To keep rides safe: Women+ and familiar-riders rules, reports, warnings and suspensions.</li>
          <li>To protect accounts: rate limits, sign-in checks and security logs.</li>
          <li>
            To evaluate the app for the thesis. Results are reported as totals and averages that do not identify
            anyone. Separate surveys and interviews ask for their own consent.
          </li>
        </ul>
        <p>We do not sell your information or use it for advertising.</p>
      </LegalSection>

      <LegalSection title="3. Who can see what">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Other signed-in students and staff</strong> see your name, photo, role, trust score and ratings
            (a review marked anonymous hides the reviewer&rsquo;s name), and the trips you post: route, time and your
            car&rsquo;s make, model and colour.
          </li>
          <li>
            <strong>Your host or your approved riders</strong> also see the car&rsquo;s plate number, the meeting
            point and the trip chat, and live location if the host shares it.
          </li>
          <li>
            <strong>Never shown to other users:</strong> your email, university ID, gender, and who reported you.
          </li>
          <li>
            <strong>Admins</strong> (appointed members of the team) can see account details including email,
            university ID and gender (to review Women+ reports), reports, help requests and open trips, so they can
            moderate the app. Admins cannot read trip chats. Every admin action is recorded.
          </li>
          <li>
            <strong>Police and legal requests</strong> are handled only by one designated data officer, and only
            with proper legal process (for example a subpoena, warrant or court order) or in an emergency where
            someone&rsquo;s life or safety is at risk. Trip chats and help requests are released only under a
            warrant or court order that names them. Every release is recorded.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Service providers and where your data is processed">
        <p>
          We use these providers to run the app. Each receives only what its job needs. Your account and trip data
          are stored in <strong>Singapore</strong>, so they leave the Philippines; some providers below also
          operate in other countries.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Railway:</strong> runs the app&rsquo;s server and database (Singapore).</li>
          <li><strong>Vercel:</strong> serves the website.</li>
          <li><strong>Brevo:</strong> sends sign-up codes and account notices (your email address and the message).</li>
          <li><strong>Mapbox:</strong> map images and driving routes, requested by your browser.</li>
          <li>
            <strong>OpenStreetMap services (Nominatim, Photon):</strong> turn typed addresses and map pins into places.
            Our server sends only the address text or coordinates, not who you are.
          </li>
          <li><strong>Sentry:</strong> error reports so we can fix problems.</li>
          <li><strong>Umami:</strong> counts page visits without cookies and without identifying you.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Cookies and browser storage">
        <p>
          We use one cookie, <code>rsu_session</code>, to keep you signed in for up to 7 days. Your browser also
          remembers your light or dark theme and unsent form drafts on your own device. There are no advertising or
          tracking cookies.
        </p>
      </LegalSection>

      <LegalSection title="6. How we protect it">
        <p>
          All connections use HTTPS. Names, gender and trip addresses are encrypted in the database; passwords are
          hashed. Sign-up codes expire after 10 minutes. Access is limited by role, sign-in attempts are rate-limited,
          and the server refuses requests that do not come through the website.
        </p>
      </LegalSection>

      <LegalSection title="7. How long we keep it">
        <ul className="list-disc pl-5 space-y-1">
          <li>Your data stays while your account is active.</li>
          <li>
            When you delete your account (Profile, then Delete account), we erase your name, email, university ID,
            photo, saved cars, preferences, notifications, chat messages, plate numbers, help requests and saved
            locations, cancel the trips you host and release seats you hold. Ratings and reports stay, but show as
            &ldquo;Deleted user&rdquo;, so other people&rsquo;s records and safety history remain accurate.
          </li>
          <li>Security events stored in the app are deleted after 30 days; server logs are kept briefly by our host.</li>
          <li>Backups are kept by the team on secured storage and replaced over time.</li>
          <li>
            When the thesis study ends, we will delete accounts and trip data, keeping only totals and averages that
            do not identify anyone.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Your rights">
        <p>Under the Data Privacy Act you have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>be informed about how your data is processed (this page);</li>
          <li>access a copy of your personal data;</li>
          <li>correct inaccurate data;</li>
          <li>object to processing, or withdraw consent by deleting your account;</li>
          <li>have your data erased or blocked;</li>
          <li>get your data in a portable format;</li>
          <li>claim damages; and</li>
          <li>
            file a complaint with the National Privacy Commission (
            <a href="https://privacy.gov.ph" className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
              privacy.gov.ph
            </a>
            ).
          </li>
        </ul>
        <p>
          You can change your photo, gender and preferences and delete your account yourself in Profile. For anything
          else, email {mail} from your MSEUF address. We reply within 15 working days.
        </p>
      </LegalSection>

      <LegalSection title="9. Age">
        <p>RideShareEU is for MSEUF students and staff aged 18 or older. We do not knowingly accept younger users.</p>
      </LegalSection>

      <LegalSection title="10. Changes to this policy">
        <p>
          If we change this policy, we will update the date at the top and tell users in the app before the change
          takes effect.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p>
          Privacy questions and requests: {mail}. See also the{' '}
          <Link href="/terms" className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
            Terms of Use
          </Link>
          .
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
