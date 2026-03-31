const spacexService = require('../services/spacexService');

exports.getHomepage = async (req, res, next) => {
  try {
    const [globalUpcoming, globalPast, apod] = await Promise.all([
      spacexService.getGlobalLaunches(),
      spacexService.getGlobalPastLaunches(),
      spacexService.getNasaApod()
    ]);
    
    res.render('index', {
      title: 'SpaceTrack | Real-Time Global Space Mission Dashboard',
      upcoming: globalUpcoming.results || [],
      past: globalPast.results || [],
      apod
    });
  } catch (error) {
    next(error);
  }
};

exports.getLaunchDetail = async (req, res, next) => {
  const { id } = req.params;
  try {
    const launch = await spacexService.getLaunchById(id);
    
    res.render('launch-detail', {
      title: `${launch.name || 'Mission'} | Details`,
      launch
    });
  } catch (error) {
    next(error);
  }
};

exports.searchLaunches = async (req, res, next) => {
  const { query, rocket, status } = req.query;
  const mongoQuery = {};
  
  if (query) mongoQuery.name = { $regex: query, $options: 'i' };
  if (status === 'success') mongoQuery.success = true;
  if (status === 'failure') mongoQuery.success = false;
  if (status === 'upcoming') mongoQuery.upcoming = true;
  
  try {
    const results = await spacexService.getLaunches(mongoQuery, { limit: 50 });
    res.render('search-results', {
      title: 'Search Results | SpaceTrack',
      results: results.docs,
      searchQuery: query
    });
  } catch (error) {
    next(error);
  }
};
