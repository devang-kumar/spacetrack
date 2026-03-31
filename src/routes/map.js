const express = require('express');
const router = express.Router();
const spacexService = require('../services/spacexService');

router.get('/', async (req, res, next) => {
  try {
    const launches = await spacexService.getAllLaunchesWithCoords();
    res.render('map', {
      title: 'Live Mission Map | SpaceTrack',
      launches: JSON.stringify(launches)
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
