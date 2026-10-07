import Link from 'next/link';
import LegalDocument, { LegalSection } from '@/components/LegalDocument';
import { getCurrentUser } from '@/lib/session';

export const metadata = { title: 'Terms of Use | RideShareEU' };

const CONTACT = 'rideshare.eu.system@gmail.com';

export default async function TermsPage() {
  const user = await getCurrentUser();
  const link = 'font-semibold text-[color:var(--rsu-color-primary)] hover:underline';

  return (
    <LegalDocument
      title="Terms of Use"
      signedIn={Boolean(user)}
      intro={
        <p>
          These terms apply to everyone who uses RideShareEU, a carpool app for the Manuel S. Enverga University
          Foundation (MSEUF) community, run by a student research team as part of a thesis pilot. By creating an
          account you agree to them and to the{' '}
          <Link href="/privacy" className={link}>
            Privacy Policy
          </Link>
          .
        </p>
      }
    >
      <LegalSection title="1. Who can use RideShareEU">
        <ul className="list-disc pl-5 space-y-1">
          <li>You must be an MSEUF student or staff member with a working MSEUF email address.</li>
          <li>You must be <strong>18 or older</strong>.</li>
          <li>One account per person. Use your real name and keep your details accurate.</li>
          <li>Keep your password private. You are responsible for what happens on your account.</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. What RideShareEU is, and is not">
        <p>
          RideShareEU helps members of the MSEUF community find each other to share rides they are already making.
          It is not a transport company, taxi or ride-hailing service. Drivers are fellow students and staff, not our
          employees or agents, and every ride is an arrangement between the people taking it.
        </p>
        <p>
          The <strong>fuel share</strong> shown on a trip is a suggested split of the fuel cost. It is paid directly
          between riders and the driver, never through the app. Drivers must not ask for more than the fuel share or
          use RideShareEU to run a for-hire service.
        </p>
      </LegalSection>

      <LegalSection title="3. If you drive">
        <ul className="list-disc pl-5 space-y-1">
          <li>Hold a valid driver&rsquo;s license and drive a registered, roadworthy car covered as the law requires.</li>
          <li>Enter your car&rsquo;s details and plate number accurately.</li>
          <li>Obey traffic laws. Never drive under the influence of alcohol or drugs, and do not smoke during a ride.</li>
          <li>Leave on time, or tell your riders early if plans change.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. If you ride">
        <ul className="list-disc pl-5 space-y-1">
          <li>Be at the meeting point on time, and cancel early if you can&rsquo;t make it.</li>
          <li>Wear your seatbelt and respect the driver, the car and the other riders.</li>
          <li>Settle the fuel share as agreed.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Rules for everyone">
        <ul className="list-disc pl-5 space-y-1">
          <li>Treat others with respect. No harassment, threats, discrimination or unwanted contact.</li>
          <li>
            Use what you learn about other users (names, plates, locations, messages) only for the ride. Do not share
            it with others or post it anywhere.
          </li>
          <li>Declare your gender honestly. Women+ trips depend on it.</li>
          <li>Rate and report honestly. Deliberately false reports are a violation.</li>
          <li>
            Do not create fake accounts, collect other users&rsquo; data, or try to get around the app&rsquo;s
            security or limits.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Safety">
        <p>
          In an emergency, call <strong>911</strong> first. Then report what happened in the app or through{' '}
          <Link href="/help" className={link}>
            Help
          </Link>
          .
        </p>
        <p>
          RideShareEU checks that each account has an MSEUF email address. It does not check driver&rsquo;s
          licenses, vehicle registration or insurance, and it does not run background checks. Use your own judgment
          about whom you ride with, and tell someone you trust about your trip.
        </p>
      </LegalSection>

      <LegalSection title="7. Warnings, suspensions and appeals">
        <p>
          If you break these terms, admins may send you an official warning, suspend your account for a period, or
          ban it permanently. Accounts can also be suspended automatically after repeated reports. If you think a
          decision was a mistake, contact us through Help or at{' '}
          <a href={`mailto:${CONTACT}`} className={link}>
            {CONTACT}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="8. Your content">
        <p>
          You keep ownership of what you post, such as trip details, messages, reviews and your photo. You allow us to
          store and show it to other users as needed to run the app.
        </p>
      </LegalSection>

      <LegalSection title="9. A pilot, provided as is">
        <p>
          RideShareEU is a research pilot. Features may change, it may be unavailable at times, and it may close when
          the study ends. To the extent the law allows, the research team is not responsible for what happens during
          rides arranged between users, or for any loss from the app being unavailable. Each user is responsible for
          their own conduct.
        </p>
      </LegalSection>

      <LegalSection title="10. Ending your account">
        <p>
          You can delete your account at any time in Profile. What happens to your data is explained in the{' '}
          <Link href="/privacy" className={link}>
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="11. Changes and governing law">
        <p>
          If we change these terms, we will update the date at the top and tell users in the app before the change
          takes effect. These terms are governed by the laws of the Philippines.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          Questions about these terms:{' '}
          <a href={`mailto:${CONTACT}`} className={link}>
            {CONTACT}
          </a>
          .
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
