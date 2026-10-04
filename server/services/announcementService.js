const TITLE_MAX = 100;
const BODY_MAX = 1000;
// Notification messages are shown in a list; keep the stored copy short.
const NOTIFICATION_MAX = 500;

function trimmedText(value, max) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= max ? text : null;
}

// Returns { data } or { field } naming the first bad field.
function validateAnnouncement(input, now = new Date()) {
  const src = input || {};
  const title = trimmedText(src.title, TITLE_MAX);
  if (!title) return { field: 'title' };
  const body = trimmedText(src.body, BODY_MAX);
  if (!body) return { field: 'body' };
  let endsAt = null;
  if (src.endsAt != null && src.endsAt !== '') {
    endsAt = new Date(src.endsAt);
    if (Number.isNaN(endsAt.getTime()) || endsAt <= now) return { field: 'endsAt' };
  }
  return { data: { title, body, endsAt } };
}

function announcementNotificationText({ title, body }) {
  return `${title}: ${body}`.slice(0, NOTIFICATION_MAX);
}

module.exports = { validateAnnouncement, announcementNotificationText, TITLE_MAX, BODY_MAX };
