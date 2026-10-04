const express = require('express');
const {
  createTicket,
  listMyTickets,
  getMyTicket,
  replyToMyTicket,
  closeMyTicket,
} = require('../controllers/supportController');

const router = express.Router();

router.post('/', createTicket);
router.get('/', listMyTickets);
router.get('/:id', getMyTicket);
router.post('/:id/messages', replyToMyTicket);
router.patch('/:id/close', closeMyTicket);

module.exports = router;
