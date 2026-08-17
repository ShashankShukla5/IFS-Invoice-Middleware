'use strict';

const express = require('express');
const ifsInvoicesRoutes = require('./ifsInvoices.routes');

const router = express.Router();

router.use('/ifs', ifsInvoicesRoutes);

router.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', correlationId: req.correlationId });
});

module.exports = router;
