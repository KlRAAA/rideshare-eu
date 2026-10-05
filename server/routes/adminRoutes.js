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

const router = express.Router();
router.use(requireAdmin);

router.get('/overview', overview);
router.get('/nav-counts', navCounts);
router.get('/actions', listActions);
router.get('/watchlist', watchlist);
router.put('/fuel-price', setOfficial);
router.get('/fuel-price/history', history);

router.get('/users', users.searchUsers);
router.get('/users/:id', users.getUserDetail);
router.post('/users/:id/ban', users.ban);
router.post('/users/:id/unban', users.unban);
// Only the superadmin appoints or removes admins (superadmin spec D6).
router.post('/users/:id/promote', requireSuperAdmin, users.promote);
router.post('/users/:id/demote', requireSuperAdmin, users.demote);

router.get('/reports', reports.listReports);
router.patch('/reports/:id', reports.reviewReport);

router.patch('/trips/:id/cancel', cancelTripAsAdmin);

router.get('/support', support.listTickets);
router.get('/support/:id', support.getTicket);
router.post('/support/:id/messages', support.replyToTicket);
router.patch('/support/:id/close', support.closeTicket);

// Superadmin only (the school's DPO). Releasing re-checks the password and is
// rate-limited like sign-in.
router.get('/data-requests', requireSuperAdmin, dataRequests.list);
router.post('/data-requests', requireSuperAdmin, authAttemptLimiter(), dataRequests.create);
router.get('/data-requests/:id', requireSuperAdmin, dataRequests.open);
router.patch('/data-requests/:id/paperwork', requireSuperAdmin, dataRequests.markPaperwork);

router.get('/announcements', announcements.listAll);
router.post('/announcements', announcements.post);
router.patch('/announcements/:id/end', announcements.end);

module.exports = router;
