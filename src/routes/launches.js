const express = require('express');
const router = express.Router();
const launchController = require('../controllers/launchController');

router.get('/search', launchController.searchLaunches);
router.get('/:id', launchController.getLaunchDetail);

module.exports = router;
