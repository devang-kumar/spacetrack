const express = require('express');
const router = express.Router();
const spacexService = require('../services/spacexService');

router.get('/', async (req, res, next) => {
  try {
    const [stats, isroLaunchers, agencyStats] = await Promise.all([
      spacexService.getStats(),
      spacexService.getIsroMissions(),
      spacexService.getAgencyStats()
    ]);
    res.render('analytics', {
      title: 'Mission Analytics | SpaceTrack',
      stats,
      isroLaunchers,
      agencyStats
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
