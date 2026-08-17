'use strict';

const express = require('express');
const { postIfsInvoice } = require('../controllers/ifsInvoices.controller');
const { apiKeyAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/invoices', apiKeyAuth, postIfsInvoice);

module.exports = router;
