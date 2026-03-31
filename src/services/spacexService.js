const axios = require('axios');
const NodeCache = require('node-cache');

// Daily cache — 24 hours TTL for all heavy data
const DAILY_TTL = 86400;
const cache = new NodeCache({ stdTTL: DAILY_TTL });

const SPACEX_API = process.env.SPACEX_API_URL || 'https://api.spacexdata.com/v4';
const LL_API     = 'https://ll.thespacedevs.com/2.2.0';
const NASA_API   = process.env.NASA_API_URL || 'https://api.nasa.gov';
const NASA_KEY   = process.env.NASA_API_KEY || 'DEMO_KEY';

// 10-year cutoff date string for LL2 filters
function tenYearsAgo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 10);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Paginate through LL2 endpoint until we have all results or hit the date cutoff
async function fetchLL2All(endpoint, extraParams = {}) {
  const http = axios.create({ timeout: 15000 });
  const results = [];
  let url = `${LL_API}${endpoint}`;
  let params = { limit: 100, ...extraParams };

  while (url) {
    try {
      const res = await http.get(url, { params });
      const data = res.data;
      results.push(...(data.results || []));
      // LL2 returns absolute next URL — use it directly, clear params
      url = data.next || null;
      params = {}; // params are baked into the next URL
    } catch (err) {
      console.error(`LL2 paginate error (${url}):`, err.message);
      break;
    }
  }
  return results;
}

// Axios instance with timeout for single requests
const http = axios.create({ timeout: 15000 });

class SpaceXService {
  constructor() {
    // Schedule a daily cache flush at midnight so data refreshes every 24h
    this._scheduleDailyRefresh();
  }

  _scheduleDailyRefresh() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0); // next midnight
    const msUntilMidnight = midnight - now;

    setTimeout(() => {
      console.log('[SpaceTrack] Daily cache flush — refreshing all data...');
      cache.flushAll();
      // Re-warm the heavy caches immediately after flush
      this.getAllLaunchesWithCoords().catch(() => {});
      this.getAgencyStats().catch(() => {});
      this.getStats().catch(() => {});
      // Schedule next flush in 24h
      setInterval(() => {
        console.log('[SpaceTrack] 24h cache flush');
        cache.flushAll();
        this.getAllLaunchesWithCoords().catch(() => {});
        this.getAgencyStats().catch(() => {});
        this.getStats().catch(() => {});
      }, DAILY_TTL * 1000);
    }, msUntilMidnight);
  }

  getDataTimeline() {
    const thisYear = new Date().getFullYear();
    const tenBack  = thisYear - 10;
    return {
      spacex: {
        label: 'SpaceX API',
        note: 'All SpaceX launches from 2006 to present — full history',
        from: '2006',
        to: thisYear.toString(),
        color: 'blue'
      },
      ll2: {
        label: 'Launch Library 2',
        note: `Global agencies — 10 years of launches (${tenBack}–${thisYear}) + upcoming`,
        from: tenBack.toString(),
        to: thisYear.toString(),
        color: 'purple'
      },
      nasa: {
        label: 'NASA APOD',
        note: 'Astronomy Picture of the Day — refreshed daily',
        from: null,
        to: null,
        color: 'red'
      },
      iss: {
        label: 'ISS Tracker',
        note: 'Live position updated every 3 seconds',
        from: null,
        to: null,
        color: 'green'
      }
    };
  }

  // Homepage — upcoming global launches (next 30)
  async getGlobalLaunches(options = {}) {
    const cacheKey = `global_launches_${JSON.stringify(options)}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const res = await http.get(`${LL_API}/launch/upcoming/`, {
        params: { limit: 30, ...options }
      });
      cache.set(cacheKey, res.data, DAILY_TTL);
      return res.data;
    } catch (err) {
      console.error('Error fetching global upcoming:', err.message);
      return { results: [] };
    }
  }

  // Homepage — recent past launches (last 30)
  async getGlobalPastLaunches(options = {}) {
    const cacheKey = `global_past_${JSON.stringify(options)}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const res = await http.get(`${LL_API}/launch/previous/`, {
        params: { limit: 30, ordering: '-net', ...options }
      });
      cache.set(cacheKey, res.data, DAILY_TTL);
      return res.data;
    } catch (err) {
      console.error('Error fetching global past:', err.message);
      return { results: [] };
    }
  }

  // Globe map — 10 years of launches with coordinates, paginated
  async getAllLaunchesWithCoords() {
    const cacheKey = 'all_launches_coords';
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const cutoff = tenYearsAgo();
      // Fetch past 10 years + all upcoming in parallel
      const [pastRes, upcomingRes] = await Promise.all([
        http.get(`${LL_API}/launch/previous/`, {
          params: { limit: 100, net__gte: cutoff, ordering: '-net' }
        }),
        http.get(`${LL_API}/launch/upcoming/`, {
          params: { limit: 100 }
        })
      ]);

      // If there are more pages of past launches, fetch them
      let pastAll = pastRes.data.results || [];
      let nextUrl = pastRes.data.next;
      while (nextUrl) {
        try {
          const r = await http.get(nextUrl);
          pastAll = pastAll.concat(r.data.results || []);
          nextUrl = r.data.next;
        } catch { break; }
      }

      const all = [...pastAll, ...(upcomingRes.data.results || [])];

      const mapped = all
        .filter(l => l.pad && l.pad.latitude && l.pad.longitude)
        .map(l => ({
          id: l.id,
          name: l.name,
          lat: parseFloat(l.pad.latitude),
          lng: parseFloat(l.pad.longitude),
          country: l.pad.country || (l.pad.location && l.pad.location.country_code) || 'Unknown',
          agency: l.launch_service_provider ? l.launch_service_provider.name : 'Unknown',
          status: l.status ? l.status.abbrev : 'Unknown',
          date: l.net || l.window_start,
          image: l.image || null,
          padName: l.pad.name || ''
        }));

      cache.set(cacheKey, mapped, DAILY_TTL);
      return mapped;
    } catch (err) {
      console.error('Error fetching launches with coords:', err.message);
      return [];
    }
  }

  // SpaceX search
  async getLaunches(query = {}, options = {}) {
    const cacheKey = `launches_${JSON.stringify(query)}_${JSON.stringify(options)}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const res = await http.post(`${SPACEX_API}/launches/query`, {
        query,
        options: {
          populate: [
            { path: 'rocket',    select: 'name type' },
            { path: 'launchpad', select: 'name full_name region' },
            { path: 'payloads',  select: 'name type' }
          ],
          sort: { date_utc: 'desc' },
          limit: 100,
          ...options
        }
      });
      cache.set(cacheKey, res.data, DAILY_TTL);
      return res.data;
    } catch (err) {
      console.error('Error fetching SpaceX launches:', err.message);
      throw err;
    }
  }

  async getLaunchById(id) {
    const cacheKey = `launch_${id}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const isSpaceX = /^[a-f0-9]{24}$/.test(id);
      if (isSpaceX) {
        const [launchRes, launchpadsRes] = await Promise.all([
          http.get(`${SPACEX_API}/launches/${id}`),
          http.get(`${SPACEX_API}/launchpads`)
        ]);
        const launch  = launchRes.data;
        const launchpad = launchpadsRes.data.find(p => p.id === launch.launchpad) || {};
        const rocketRes = launch.rocket
          ? await http.get(`${SPACEX_API}/rockets/${launch.rocket}`).catch(() => ({ data: {} }))
          : { data: {} };
        const detail = { ...launch, rocketDetails: rocketRes.data, launchpadDetails: launchpad };
        cache.set(cacheKey, detail, DAILY_TTL);
        return detail;
      } else {
        const res  = await http.get(`${LL_API}/launch/${id}/`);
        const data = { ...res.data, isGlobal: true };
        cache.set(cacheKey, data, DAILY_TTL);
        return data;
      }
    } catch (err) {
      console.error(`Error fetching launch ${id}:`, err.message);
      throw err;
    }
  }

  // SpaceX all-time stats (full history, no limit)
  async getStats() {
    const cacheKey = 'launch_stats';
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const res = await http.get(`${SPACEX_API}/launches`);
      const launches = res.data;

      // Resolve rocket names
      const rocketIds = [...new Set(launches.map(l => l.rocket).filter(Boolean))];
      const rocketNames = {};
      await Promise.all(rocketIds.map(async rid => {
        try {
          const r = await http.get(`${SPACEX_API}/rockets/${rid}`);
          rocketNames[rid] = r.data.name;
        } catch { rocketNames[rid] = rid; }
      }));

      const stats = {
        total: launches.length,
        success: launches.filter(l => l.success).length,
        failure: launches.filter(l => l.success === false).length,
        upcoming: launches.filter(l => l.upcoming).length,
        byYear: {},
        byRocket: {}
      };
      launches.forEach(l => {
        const year = new Date(l.date_utc).getFullYear();
        if (!isNaN(year)) stats.byYear[year] = (stats.byYear[year] || 0) + 1;
        const rName = rocketNames[l.rocket] || 'Unknown';
        stats.byRocket[rName] = (stats.byRocket[rName] || 0) + 1;
      });

      cache.set(cacheKey, stats, DAILY_TTL);
      return stats;
    } catch (err) {
      console.error('Error fetching stats:', err.message);
      throw err;
    }
  }

  async getNasaApod() {
    const cacheKey = 'nasa_apod';
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const res = await http.get(`${NASA_API}/planetary/apod`, {
        params: { api_key: NASA_KEY }
      });
      cache.set(cacheKey, res.data, DAILY_TTL);
      return res.data;
    } catch (err) {
      console.error('Error fetching NASA APOD:', err.message);
      return null;
    }
  }

  // Per-agency analytics — 10 years of LL2 data, paginated
  async getAgencyStats() {
    const cacheKey = 'agency_stats';
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const cutoff = tenYearsAgo();
      const [pastRes, upcomingRes] = await Promise.all([
        http.get(`${LL_API}/launch/previous/`, {
          params: { limit: 100, net__gte: cutoff, ordering: '-net' }
        }),
        http.get(`${LL_API}/launch/upcoming/`, { params: { limit: 100 } })
      ]);

      // Paginate past results
      let pastAll = pastRes.data.results || [];
      let nextUrl = pastRes.data.next;
      while (nextUrl) {
        try {
          const r = await http.get(nextUrl);
          pastAll = pastAll.concat(r.data.results || []);
          nextUrl = r.data.next;
        } catch { break; }
      }

      const all = [...pastAll, ...(upcomingRes.data.results || [])];
      const agencies = {};

      all.forEach(l => {
        const provider = l.launch_service_provider;
        if (!provider) return;
        const name   = provider.name;
        const abbrev = provider.abbrev || name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 5);

        if (!agencies[name]) {
          agencies[name] = {
            name, abbrev,
            type:    provider.type         || 'Unknown',
            country: provider.country_code || 'Unknown',
            logo:    provider.logo_url     || null,
            total: 0, success: 0, failure: 0, upcoming: 0,
            byYear: {}, rockets: {},
            firstDate: null, lastDate: null
          };
        }
        const a = agencies[name];
        a.total++;

        const s = (l.status ? l.status.abbrev : '').toLowerCase();
        if (s === 'success')                                 a.success++;
        else if (s === 'failure' || s === 'partial failure') a.failure++;
        else if (l.net && new Date(l.net) > new Date())      a.upcoming++;

        const dateStr = l.net || l.window_start;
        if (dateStr) {
          const d = new Date(dateStr);
          if (!a.firstDate || d < new Date(a.firstDate)) a.firstDate = dateStr;
          if (!a.lastDate  || d > new Date(a.lastDate))  a.lastDate  = dateStr;
          const year = d.getFullYear();
          if (!isNaN(year)) a.byYear[year] = (a.byYear[year] || 0) + 1;
        }

        const rocket = l.rocket && l.rocket.configuration ? l.rocket.configuration.name : 'Unknown';
        a.rockets[rocket] = (a.rockets[rocket] || 0) + 1;
      });

      const sorted = Object.values(agencies)
        .sort((a, b) => b.total - a.total)
        .slice(0, 15); // top 15 ensures ISRO, JAXA, ESA, Roscosmos all appear

      cache.set(cacheKey, sorted, DAILY_TTL);
      return sorted;
    } catch (err) {
      console.error('Error fetching agency stats:', err.message);
      return [];
    }
  }

  async getIsroMissions() {
    const cacheKey = 'isro_missions';
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const res = await http.get('https://isro.vercel.app/api/v1/launchers', { timeout: 5000 });
      if (res.data && res.data.launchers) {
        cache.set(cacheKey, res.data.launchers, DAILY_TTL);
        return res.data.launchers;
      }
      return [];
    } catch {
      return [
        { id: 'PSLV', name: 'Polar Satellite Launch Vehicle' },
        { id: 'GSLV', name: 'Geosynchronous Satellite Launch Vehicle' },
        { id: 'LVM3', name: 'Launch Vehicle Mark 3' },
        { id: 'SSLV', name: 'Small Satellite Launch Vehicle' }
      ];
    }
  }
}

module.exports = new SpaceXService();
