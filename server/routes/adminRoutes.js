const express = require('express');
const { requireAdmin } = require('../middleware/requireAdmin');
const { overview, listActions, watchlist, navCounts } = require('../controllers/admin/overviewController');
const { setOfficial, history } = require('../controllers/fuelPriceController');
const users = require('../controllers/admin/userController');
const reports = require('../controllers/admin/reportController');
const { cancelTripAsAdmin } = require('../controllers/admin/tripController');
const support = require('../controllers/admin/supportController');
const announcements = require('../controllers/announcementController');
const { requireSuperAdmin } = require('../middleware/requireSuperAdmin');
const { authAttemptLimiter } = require('../middleware/rateLimit');
const dataRequests = require('../controllers/admin/dataRequestController');
const { strictBody } = require('../middleware/strictBody');
const licenses = require('../controllers/admin/licenseController');

const router = express.Router();
router.use(requireAdmin);

router.get('/overview', overview);
router.get('/nav-counts', navCounts);
router.get('/actions', listActions);
router.get('/watchlist', watchlist);
router.put('/fuel-price', strictBody('admin.fuelPrice'), setOfficial);
router.get('/fuel-price/history', history);

router.get('/users', users.searchUsers);
router.get('/users/:id', users.getUserDetail);
router.post('/users/:id/warnings', strictBody('admin.warn'), users.warn);
router.post('/users/:id/ban', strictBody('admin.ban'), users.ban);
router.post('/users/:id/unban', strictBody('admin.unban'), users.unban);
// Only the superadmin appoints or removes admins (superadmin spec D6).
router.post('/users/:id/promote', requireSuperAdmin, strictBody('admin.promote'), users.promote);
router.post('/users/:id/demote', requireSuperAdmin, strictBody('admin.demote'), users.demote);

router.get('/licenses', licenses.list);
router.get('/licenses/recent-auto', licenses.recentAuto);
router.get('/licenses/:id/photo', licenses.photo);
router.post('/licenses/:id/approve', strictBody('admin.licenseApprove'), licenses.approve);
router.post('/licenses/:id/reject', strictBody('admin.licenseReject'), licenses.reject);
router.post('/licenses/:id/revoke', strictBody('admin.licenseRevoke'), licenses.revoke);

router.get('/reports', reports.listReports);
router.patch('/reports/:id', strictBody('admin.reviewReport'), reports.reviewReport);

router.patch('/trips/:id/cancel', strictBody('admin.cancelTrip'), cancelTripAsAdmin);

router.get('/support', support.listTickets);
router.get('/support/:id', support.getTicket);
router.post('/support/:id/messages', strictBody('admin.supportReply'), support.replyToTicket);
router.patch('/support/:id/close', strictBody('admin.supportClose'), support.closeTicket);

// Superadmin only (the school's DPO). Releasing re-checks the password and is
// rate-limited like sign-in.
router.get('/data-requests', requireSuperAdmin, dataRequests.list);
router.post('/data-requests', requireSuperAdmin, authAttemptLimiter(), strictBody('admin.dataRequestCreate'), dataRequests.create);
router.get('/data-requests/:id', requireSuperAdmin, dataRequests.open);
router.patch('/data-requests/:id/paperwork', requireSuperAdmin, strictBody('admin.dataRequestPaperwork'), dataRequests.markPaperwork);

router.get('/announcements', announcements.listAll);
router.post('/announcements', strictBody('admin.announcementPost'), announcements.post);
router.patch('/announcements/:id/end', strictBody('admin.announcementEnd'), announcements.end);

module.exports = router;
