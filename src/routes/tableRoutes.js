const express = require('express');
const router = express.Router();
const { getDatabaseTables } = require('../controllers/tableController');

router.get('/', getDatabaseTables);

module.exports = router;