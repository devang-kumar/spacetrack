const express = require('express');
const router = express.Router();
const launchController = require('../controllers/launchController');

router.get('/', launchController.getHomepage);

module.exports = router;
