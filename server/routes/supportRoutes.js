const express = require('express');
const {
  createTicket,
  listMyTickets,
  getMyTicket,
  replyToMyTicket,
  closeMyTicket,
} = require('../controllers/supportController');
const { strictBody } = require('../middleware/strictBody');

const router = express.Router();

router.post('/', strictBody('support.create'), createTicket);
router.get('/', listMyTickets);
router.get('/:id', getMyTicket);
router.post('/:id/messages', strictBody('support.reply'), replyToMyTicket);
router.patch('/:id/close', strictBody('support.close'), closeMyTicket);

module.exports = router;
