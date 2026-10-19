/**
 * RideShareEU evaluation form (Google Forms), built in one run.
 *
 * How to use (about 2 minutes):
 *   1. Go to https://script.google.com with the Google account that should
 *      own the form and the responses (the thesis team's account).
 *   2. New project. Delete the sample code, paste this whole file, Save.
 *   3. Choose the function createRideShareEUEvaluation and press Run.
 *      Google asks for permission to create a form and a spreadsheet: allow.
 *   4. Open View > Logs (or Execution log). It prints three links:
 *      the form to share, the form editor, and the responses spreadsheet.
 *   5. Send the share link to the team; it goes on the /test page.
 *
 * Running it again creates a second, separate form. Questions match
 * docs/evaluation/evaluation-instrument.md; keep the two in step.
 */

const LIKERT_LOW = 'Strongly disagree';
const LIKERT_HIGH = 'Strongly agree';

// Who is answering. The three office groups get their own section first.
const GROUPS = {
  student: 'Student',
  faculty: 'Faculty',
  staff: 'Non-teaching staff',
  ictd: 'ICTD (Information and Communications Technology Department)',
  sustainability: 'Sustainability office',
  transport: 'Transportation office',
};

// ISO/IEC 25010 usability sub-characteristics (everyone), mapped to the tasks.
const USABILITY = [
  ['Appropriateness recognizability', 'I could tell what RideShareEU is for and whether it fits my commute.'],
  ['Appropriateness recognizability', 'Each screen made it clear what I could do there.'],
  ['Learnability', 'I learned to find a ride or post a trip without anyone helping me.'],
  ['Learnability', 'The steps to request a ride, approve a rider and rate a trip were easy to remember.'],
  ['Operability', 'Buttons, menus and forms were easy to use on my phone.'],
  ['Operability', 'I could finish each task I tried without getting stuck.'],
  ['User error protection', 'The app asked me to confirm before actions that can’t be undone, like cancelling.'],
  ['User error protection', 'When something went wrong, the message told me what to do next.'],
  ['User interface aesthetics', 'The app looks clean and pleasant to use.'],
  ['Accessibility', 'Text size, contrast and button sizes were comfortable for me.'],
];

// ISO/IEC 25010 product quality, for the ICTD evaluators.
const ICTD = [
  ['Functional suitability: completeness', 'The features cover the whole carpool process, from sign-up to rating.'],
  ['Functional suitability: correctness', 'Matches, schedules and fuel shares were computed correctly in my tests.'],
  ['Functional suitability: appropriateness', 'The functions make coordinating a carpool easier.'],
  ['Performance efficiency: time behaviour', 'Pages, searches and updates responded quickly.'],
  ['Performance efficiency: resource utilization', 'The app ran smoothly on my device without draining it or using much data.'],
  ['Performance efficiency: capacity', 'The system can serve the expected number of MSEUF users (see the load test).'],
  ['Compatibility: co-existence', 'It works alongside other apps, such as opening Google Maps or Waze for directions.'],
  ['Compatibility: interoperability', 'It worked the same in the browsers and devices I tried.'],
  ['Reliability: maturity', 'I didn’t run into crashes or errors during normal use.'],
  ['Reliability: availability', 'The system was available whenever I tried to use it.'],
  ['Reliability: fault tolerance', 'It handled a weak connection or a busy moment without losing my work.'],
  ['Reliability: recoverability', 'After an interruption I could continue where I left off.'],
  ['Security: confidentiality', 'Only verified MSEUF accounts can see trips, and personal details are kept private.'],
  ['Security: integrity', 'Users can’t change other people’s trips, requests or data.'],
  ['Security: accountability', 'Admin actions and important events are recorded.'],
  ['Security: authenticity', 'School email verification and the driver’s license check confirm who users are.'],
  ['Maintainability: modularity and analysability', 'From the documentation, the system is organized in a way the ICTD could maintain.'],
  ['Maintainability: testability', 'The automated tests and API test collection make changes safe to check.'],
  ['Portability: adaptability', 'The layout adapts well to phones, tablets and computers.'],
  ['Portability: installability', 'Adding the app to the home screen was easy.'],
];

// For the Sustainability and Transportation offices.
const DOMAIN = [
  ['Functional suitability: completeness', 'The app covers what a campus carpool needs: finding, posting, approving, riding and rating.'],
  ['Functional suitability: correctness', 'Rides matched to a passenger really go their way at a time that suits them.'],
  ['Functional suitability: appropriateness', 'The steps fit how students and employees actually commute to MSEUF.'],
  ['Mobility impact', 'RideShareEU can reduce the number of single-occupant vehicles coming to campus.'],
  ['Cost', 'Sharing the fuel cost per seat, based on the official DOE price, is fair and clear.'],
  ['Safety', 'Verified school accounts, the driver’s license check, live location and reporting are adequate safety measures.'],
  ['Safety', 'Women+ trips (only women and non-binary riders) respond to real safety concerns.'],
  ['Operations', 'The admin tools (reports, warnings, bans, fuel price) are enough to manage the service.'],
  ['Sustainability', 'The app supports the university’s sustainability and transport goals.'],
  ['Adoption', 'I would recommend that the university pilot RideShareEU.'],
];

// System Usability Scale (Brooke, 1996), wording unchanged except the name.
const SUS = [
  'I think that I would like to use RideShareEU frequently.',
  'I found RideShareEU unnecessarily complex.',
  'I thought RideShareEU was easy to use.',
  'I think that I would need the support of a technical person to be able to use RideShareEU.',
  'I found the various functions in RideShareEU were well integrated.',
  'I thought there was too much inconsistency in RideShareEU.',
  'I would imagine that most people would learn to use RideShareEU very quickly.',
  'I found RideShareEU very cumbersome to use.',
  'I felt very confident using RideShareEU.',
  'I needed to learn a lot of things before I could get going with RideShareEU.',
];

const TASKS = [
  'Create an account with my school email',
  'Find a ride and request to join',
  'Post a trip (as a driver)',
  'Approve or decline a rider',
  'Chat with the driver or riders',
  'Start a trip and follow it on the live map',
  'Rate a driver or rider after a trip',
  'Use Help or report a problem',
];

function addScales(form, rows, prefix) {
  rows.forEach(([aspect, statement], i) => {
    form
      .addScaleItem()
      .setTitle(`${prefix}${i + 1}. ${statement}`)
      .setHelpText(aspect)
      .setBounds(1, 5)
      .setLabels(LIKERT_LOW, LIKERT_HIGH)
      .setRequired(true);
  });
}

function createRideShareEUEvaluation() {
  const form = FormApp.create('RideShareEU Evaluation');
  form
    .setDescription(
      'Thank you for testing RideShareEU, the MSEUF carpool web app, for our thesis. ' +
        'This form takes about 10 minutes. Answer after you have tried the app at https://rideshare-eu.vercel.app/test.'
    )
    .setCollectEmail(false)
    .setProgressBar(true)
    .setAllowResponseEdits(false)
    .setConfirmationMessage('Thank you! Your answers help us improve RideShareEU and complete our thesis evaluation.');

  // 1. Consent (RA 10173). "I do not agree" ends the form.
  const consent = form
    .addMultipleChoiceItem()
    .setTitle('Consent')
    .setHelpText(
      'Your answers are anonymous: this form does not record your name or email. They are used only for the ' +
        'RideShareEU thesis evaluation and reported as group results. Test accounts and test trips in the app are ' +
        'deleted after the evaluation period, as required by the Data Privacy Act of 2012 (RA 10173). ' +
        'You may stop at any time.'
    )
    .setRequired(true);

  // 2. About you. The group decides the next section.
  const aboutPage = form.addPageBreakItem().setTitle('About you');
  const group = form.addMultipleChoiceItem().setTitle('Which group are you answering for?').setRequired(true);
  form.addMultipleChoiceItem().setTitle('How did you use RideShareEU?').setChoiceValues(['As a passenger', 'As a driver', 'Both']).setRequired(true);
  form.addMultipleChoiceItem().setTitle('Which device did you mainly use?').setChoiceValues(['Android phone', 'iPhone', 'Tablet', 'Computer']).setRequired(true);
  form.addMultipleChoiceItem().setTitle('Did you add RideShareEU to your home screen?').setChoiceValues(['Yes', 'No']).setRequired(true);

  // 3a. ICTD.
  const ictdPage = form
    .addPageBreakItem()
    .setTitle('Software quality (ISO/IEC 25010)')
    .setHelpText('For ICTD evaluators. 1 = Strongly disagree, 5 = Strongly agree.');
  addScales(form, ICTD, 'Q');

  // 3b. Sustainability and Transportation.
  const domainPage = form
    .addPageBreakItem()
    .setTitle('Campus mobility and sustainability')
    .setHelpText('For the Sustainability and Transportation offices. 1 = Strongly disagree, 5 = Strongly agree.');
  addScales(form, DOMAIN, 'D');

  // 4. Everyone: tasks, usability, SUS, comments.
  const tasksPage = form.addPageBreakItem().setTitle('What you tried');
  form.addCheckboxItem().setTitle('Which tasks did you complete?').setHelpText('Check all that apply.').setChoiceValues(TASKS).setRequired(true);
  form.addParagraphTextItem().setTitle('Was there a task you couldn’t finish? What happened?');

  form.addPageBreakItem().setTitle('Usability (ISO/IEC 25010)').setHelpText('1 = Strongly disagree, 5 = Strongly agree.');
  addScales(form, USABILITY, 'U');

  form
    .addPageBreakItem()
    .setTitle('System Usability Scale')
    .setHelpText('Answer quickly, with your first impression. 1 = Strongly disagree, 5 = Strongly agree.');
  SUS.forEach((statement, i) => {
    form.addScaleItem().setTitle(`S${i + 1}. ${statement}`).setBounds(1, 5).setLabels(LIKERT_LOW, LIKERT_HIGH).setRequired(true);
  });

  form.addPageBreakItem().setTitle('Your comments');
  form.addParagraphTextItem().setTitle('What did you like most about RideShareEU?');
  form.addParagraphTextItem().setTitle('What was confusing or didn’t work?');
  form.addParagraphTextItem().setTitle('What would you add or change?');

  // Navigation: consent, then by group. A page break's "go to" applies to the
  // page before it, so the break before the Sustainability/Transportation page
  // sends ICTD evaluators straight on to the common part; that page itself
  // continues to it anyway.
  consent.setChoices([
    consent.createChoice('I agree to take part', aboutPage),
    consent.createChoice('I do not agree', FormApp.PageNavigationType.SUBMIT),
  ]);
  group.setChoices([
    group.createChoice(GROUPS.student, tasksPage),
    group.createChoice(GROUPS.faculty, tasksPage),
    group.createChoice(GROUPS.staff, tasksPage),
    group.createChoice(GROUPS.ictd, ictdPage),
    group.createChoice(GROUPS.sustainability, domainPage),
    group.createChoice(GROUPS.transport, domainPage),
  ]);
  domainPage.setGoToPage(tasksPage);

  const sheet = SpreadsheetApp.create('RideShareEU Evaluation (responses)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  Logger.log('Share this link with evaluators: ' + form.shortenFormUrl(form.getPublishedUrl()));
  Logger.log('Edit the form: ' + form.getEditUrl());
  Logger.log('Responses spreadsheet: ' + sheet.getUrl());
}
