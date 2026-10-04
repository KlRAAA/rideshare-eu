const express = require('express');
const { requireAdmin } = require('../middleware/requireAdmin');
const { overview, listActions } = require('../controllers/admin/overviewController');
const { setOfficial, history } = require('../controllers/fuelPriceController');
const users = require('../controllers/admin/userController');
const reports = require('../controllers/admin/reportController');
const { cancelTripAsAdmin } = require('../controllers/admin/tripController');
const support = require('../controllers/admin/supportController');
const announcements = require('../controllers/announcementController');

const router = express.Router();
router.use(requireAdmin);

router.get('/overview', overview);
router.get('/actions', listActions);
router.put('/fuel-price', setOfficial);
router.get('/fuel-price/history', history);

router.get('/users', users.searchUsers);
router.get('/users/:id', users.getUserDetail);
router.post('/users/:id/ban', users.ban);
router.post('/users/:id/unban', users.unban);
router.post('/users/:id/promote', users.promote);
router.post('/users/:id/demote', users.demote);

router.get('/reports', reports.listReports);
router.patch('/reports/:id', reports.reviewReport);

router.patch('/trips/:id/cancel', cancelTripAsAdmin);

router.get('/support', support.listTickets);
router.get('/support/:id', support.getTicket);
router.post('/support/:id/messages', support.replyToTicket);
router.patch('/support/:id/close', support.closeTicket);

router.get('/announcements', announcements.listAll);
router.post('/announcements', announcements.post);
router.patch('/announcements/:id/end', announcements.end);

module.exports = router;
