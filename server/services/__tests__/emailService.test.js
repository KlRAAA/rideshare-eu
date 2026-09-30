jest.mock('nodemailer', () => {
  const sendMail = jest.fn().mockResolvedValue({});
  return { createTransport: jest.fn(() => ({ sendMail })), __sendMail: sendMail };
});

const nodemailer = require('nodemailer');
const { sendOtpEmail, sendBanNotificationEmail, isUndeliverableAddress } = require('../emailService');

const ORIGINAL_SMTP_HOST = process.env.SMTP_HOST;

beforeAll(() => {
  process.env.SMTP_HOST = 'smtp.example.test';
});

afterAll(() => {
  if (ORIGINAL_SMTP_HOST === undefined) delete process.env.SMTP_HOST;
  else process.env.SMTP_HOST = ORIGINAL_SMTP_HOST;
});

beforeEach(() => nodemailer.__sendMail.mockClear());

const BAN = { categoryLabel: 'Spam', permanent: false, bannedUntil: new Date('2026-10-07T00:00:00Z') };

describe('isUndeliverableAddress', () => {
  test.each([
    ['a@test.local', true],
    ['a@b.test', true],
    ['a@x.invalid', true],
    ['a@example.com', true],
    ['a@x.localhost', true],
    ['A00-00000@student.mseuf.edu.ph', false],
    ['someone@gmail.com', false],
  ])('%s → %p', (email, expected) => {
    expect(isUndeliverableAddress(email)).toBe(expected);
  });
});

describe('delivery', () => {
  test('never hands a reserved test-domain address to SMTP', async () => {
    await sendOtpEmail('postman-host@test.local', '123456');
    await sendBanNotificationEmail('postman-passenger@test.local', BAN);
    expect(nodemailer.__sendMail).not.toHaveBeenCalled();
  });

  test('still sends to a real address', async () => {
    await sendOtpEmail('A00-00000@student.mseuf.edu.ph', '123456');
    expect(nodemailer.__sendMail).toHaveBeenCalledTimes(1);
  });
});

describe('ban notification wording', () => {
  test('an automatic ban says no person reviewed it', async () => {
    await sendBanNotificationEmail('someone@gmail.com', BAN);
    const { text } = nodemailer.__sendMail.mock.calls[0][0];
    expect(text).toContain('automatically suspended');
    expect(text).toContain('not reviewed by a person');
  });

  test('an admin ban says an administrator decided it', async () => {
    await sendBanNotificationEmail('someone@gmail.com', { ...BAN, byAdmin: true });
    const { text } = nodemailer.__sendMail.mock.calls[0][0];
    expect(text).toContain('suspended by a RideShareEU administrator');
    expect(text).not.toContain('not reviewed by a person');
  });
});
