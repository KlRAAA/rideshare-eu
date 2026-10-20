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

const SCALE = '1 – Strongly disagree, 2 – Disagree, 3 – Neutral, 4 – Agree, 5 – Strongly agree';
const LIKERT_LOW = 'Strongly disagree';
const LIKERT_HIGH = 'Strongly agree';
const CONTACT_EMAIL = 'thesis013xvn@gmail.com';
const TEST_PAGE = 'https://rideshare-eu.vercel.app/test';

const INTRO = [
  'Good day! You are invited to take part in this evaluation as part of our study, "RideShareEU: A Priority-Scored ' +
    'Greedy Matching Algorithm for Optimizing Schedule-Based University Carpooling."',
  '',
  'RideShareEU is a carpool web app for the Manuel S. Enverga University Foundation community. Drivers post the trips ' +
    'they already make, passengers find rides that go their way, and the suggested fuel share is split per seat. This ' +
    'evaluation assesses how well the app works, how easy it is to use, and how satisfied testers are with it. Please ' +
    'try the app first, following the guide at ' + TEST_PAGE + ', then answer this form. It takes about 10 to 15 minutes.',
  '',
  'DATA PRIVACY NOTICE',
  'In compliance with the Data Privacy Act of 2012 (Republic Act No. 10173), this form does not collect your name or ' +
    'email address. Your answers are used only for academic research, system evaluation, and documentation, are ' +
    'reported only as group results, and are accessible only to the research team. Test accounts and test trips in the ' +
    'app are deleted after the evaluation period. Taking part is voluntary, and you may stop at any time.',
  '',
  'OBJECTIVES OF THE EVALUATION',
  '1. To evaluate the functional suitability, usability, and user experience of RideShareEU in its key tasks: signing ' +
    'up, finding and requesting rides, posting and running trips, and staying in touch through chat and notifications.',
  '2. To determine user satisfaction with the ride matching (the Priority-Scored Greedy Algorithm), the fuel share, ' +
    'and the safety features.',
  '3. To gather feedback, identify problems, and form recommendations for improving the system.',
  '',
  'RESEARCHERS',
  'De Asis, Von Altair R.',
  'Dimacali, Xyrus Lorenz M.',
  'Sayat, Nash Adriane D.',
  '',
  'For questions or concerns about this evaluation, email us at ' + CONTACT_EMAIL + '. To report a problem in the ' +
    'app while testing, use Help → Contact admin in RideShareEU.',
].join('\n');

// Who is answering. The three office groups get their own section first.
const GROUPS = {
  student: 'Student',
  faculty: 'Faculty',
  staff: 'Non-teaching staff',
  ictd: 'ICTD (Information and Communications Technology Department)',
  sustainability: 'Sustainability office',
  transport: 'Transportation office',
};

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

// Everyone: one statement per main task, answered in a grid with "Did not try".
const CORE_FEATURES = [
  'Creating an account with my school email and the emailed code was straightforward.',
  'Searching for a ride and understanding the results (time, match %, fuel share) was easy.',
  'Requesting to join a trip, and seeing whether the driver approved it, was clear.',
  'Posting a trip (route, meeting point, schedule, car and seats) was easy to complete.',
  'Approving or declining a rider’s request was easy.',
  'Starting a trip, marking riders as picked up, and ending the trip worked as expected.',
  'Following the car on the live map, with its arrival time, was clear and useful.',
  'Notifications told me about requests, approvals and trip updates on time.',
  'The trip chat made it easy to coordinate with the driver or riders.',
  'The suggested fuel share per seat was clear and reasonable.',
  'Help, reporting a problem, and the safety information were easy to find.',
];
const AGREEMENT = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];
const GRID_COLUMNS = [...AGREEMENT, 'Did not try'];

// ISO/IEC 25010 usability sub-characteristics (everyone).
const USABILITY = [
  ['Appropriateness recognizability', 'I could tell what RideShareEU is for and whether it fits my commute.'],
  ['Appropriateness recognizability', 'Each screen made it clear what I could do there.'],
  ['Learnability', 'I learned to find a ride or post a trip without anyone helping me.'],
  ['Learnability', 'The steps to request a ride, approve a rider and rate a trip were easy to remember.'],
  ['Operability', 'Buttons, menus and forms were easy to use on my phone.'],
  ['Operability', 'I could finish each task I tried without getting stuck.'],
  ['User error protection', 'The app asked me to confirm before actions that can’t be undone, like cancelling.'],
  ['User error protection', 'When something went wrong, the message told me what to do next.'],
  ['User interface aesthetics', 'The layout, colors and text are clean and pleasant to look at.'],
  ['Accessibility', 'Text size, contrast and button sizes were comfortable for me.'],
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

function createRideShareEUEvaluation() {
  const form = FormApp.create('RideShareEU: User Acceptance and Usability Evaluation');
  form
    .setTitle('RideShareEU: User Acceptance and Usability Evaluation')
    .setDescription(INTRO)
    .setCollectEmail(false)
    .setProgressBar(true)
    .setAllowResponseEdits(false)
    .setConfirmationMessage('Thank you! Your answers help us improve RideShareEU and complete our thesis evaluation.');

  // I. Consent and tester check. "I do not agree" ends the form.
  addSection(form, 'I. Informed Consent and Tester Verification',
    'Please confirm your consent and that you tried RideShareEU before answering.');
  const consent = form
    .addMultipleChoiceItem()
    .setTitle('Informed consent')
    .setHelpText('I have read the study overview and the Data Privacy Notice.')
    .setRequired(true);
  form
    .addCheckboxItem()
    .setTitle('Testing participation check')
    .setChoiceValues(['Yes, I created an account and used RideShareEU during the testing session.'])
    .setRequired(true);

  // II. Profile. The group decides the next section.
  const profilePage = addSection(form, 'II. Respondent Profile',
    'This helps us report results by group. We do not ask for your name.');
  const group = form.addMultipleChoiceItem().setTitle('Which group are you answering for?').setRequired(true);
  form.addMultipleChoiceItem().setTitle('Age group').setChoiceValues(['18 – 21', '22 – 25', '26 – 30', '31 – 40', '41 and above']).setRequired(true);
  form.addMultipleChoiceItem().setTitle('How did you use RideShareEU?').setChoiceValues(['As a passenger', 'As a driver', 'Both']).setRequired(true);
  form.addMultipleChoiceItem().setTitle('Which device did you mainly use?').setChoiceValues(['Android phone', 'iPhone', 'Tablet', 'Computer']).setRequired(true);
  form.addMultipleChoiceItem().setTitle('Did you add RideShareEU to your home screen?').setChoiceValues(['Yes', 'No']).setRequired(true);

  // III-A. ICTD.
  const ictdPage = addSection(form, 'III-A. Software Quality (ISO/IEC 25010)',
    'For ICTD evaluators. Rate each statement based on your testing.');
  addGrids(form, ICTD, 'Q', byCharacteristic);

  // III-B. Sustainability and Transportation.
  const domainPage = addSection(form, 'III-B. Campus Mobility and Sustainability',
    'For the Sustainability and Transportation offices. Rate each statement based on your testing.');
  addGrids(form, DOMAIN, 'D', (aspect) => ['Campus mobility and sustainability', byCharacteristic(aspect).join(': ').replace(/: $/, '')]);

  // IV. Everyone: core features.
  const corePage = addSection(form, 'IV. Core Feature Usability and Task Performance',
    'Rate how well each of RideShareEU’s main functions worked for you. Choose "Did not try" for anything you ' +
      'didn’t do (for example, driver tasks if you only rode).');
  form
    .addGridItem()
    .setTitle('Core features')
    .setRows(CORE_FEATURES.map((s, i) => `F${i + 1}. ${s}`))
    .setColumns(GRID_COLUMNS)
    .setRequired(true);

  // V. Usability and interface.
  addSection(form, 'V. Usability and User Interface (ISO/IEC 25010)',
    'Rate each statement based on your experience using the app.');
  addGrids(form, USABILITY, 'U', (aspect) => ['Usability', aspect]);

  // VI. SUS.
  addSection(form, 'VI. System Usability Scale (SUS)',
    'Answer quickly, with your first impression.\nRating scale: ' + SCALE);
  addScales(form, SUS, 'S');

  // VII. Comments.
  addSection(form, 'VII. Feedback and Recommendations',
    'Tell us what worked, what didn’t, and what would make RideShareEU better.');
  form.addParagraphTextItem().setTitle('Feature highlights').setHelpText('What feature did you find most useful or well designed?');
  form.addParagraphTextItem().setTitle('Issues and frustrations').setHelpText('Did you run into bugs, confusing steps, slow pages, or a task you couldn’t finish? What happened?');
  form.addParagraphTextItem().setTitle('Suggestions for improvement').setHelpText('What would you add or change before RideShareEU is used on campus?');

  // Navigation: consent, then by group. A page break's "go to" applies to the
  // page before it: the break before III-B sends ICTD evaluators on to IV,
  // and the break before IV does the same for III-B (the default anyway).
  consent.setChoices([
    consent.createChoice('I voluntarily consent to take part in this evaluation.', profilePage),
    consent.createChoice('I do not consent.', FormApp.PageNavigationType.SUBMIT),
  ]);
  group.setChoices([
    group.createChoice(GROUPS.student, corePage),
    group.createChoice(GROUPS.faculty, corePage),
    group.createChoice(GROUPS.staff, corePage),
    group.createChoice(GROUPS.ictd, ictdPage),
    group.createChoice(GROUPS.sustainability, domainPage),
    group.createChoice(GROUPS.transport, domainPage),
  ]);
  domainPage.setGoToPage(corePage);

  const sheet = SpreadsheetApp.create('RideShareEU Evaluation (responses)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  Logger.log('Share this link with evaluators: ' + form.shortenFormUrl(form.getPublishedUrl()));
  Logger.log('Edit the form: ' + form.getEditUrl());
  Logger.log('Responses spreadsheet: ' + sheet.getUrl());
}

function addScales(form, statements, prefix) {
  statements.forEach((statement, i) => {
    form
      .addScaleItem()
      .setTitle(`${prefix}${i + 1}. ${statement}`)
      .setBounds(1, 5)
      .setLabels(LIKERT_LOW, LIKERT_HIGH)
      .setRequired(true);
  });
}

// One grid per characteristic, each row "Q1. Sub-characteristic — statement",
// as in the ISO/IEC 25010 questionnaires other CCMS groups use.
function addGrids(form, rows, prefix, groupOf) {
  const groups = [];
  rows.forEach(([aspect, statement], i) => {
    const [name, sub] = groupOf(aspect);
    let g = groups.find((x) => x.name === name);
    if (!g) groups.push((g = { name, rows: [] }));
    g.rows.push(`${prefix}${i + 1}. ${sub ? sub + ' — ' : ''}${statement}`);
  });
  groups.forEach((g) => {
    form.addGridItem().setTitle(g.name).setRows(g.rows).setColumns(AGREEMENT).setRequired(true);
  });
}

const byCharacteristic = (aspect) => {
  const [name, sub] = aspect.split(': ');
  return [name, sub ? sub.charAt(0).toUpperCase() + sub.slice(1) : ''];
};

function addSection(form, title, help) {
  return form.addPageBreakItem().setTitle(title).setHelpText(help);
}
