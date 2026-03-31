require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const morgan = require('morgan');
const helmet = require('helmet');
const session = require('express-session');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://cdn.tailwindcss.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      mediaSrc: ["'self'", "https://www.spacex.com"],
      connectSrc: ["'self'", "https://api.spacexdata.com", "https://ll.thespacedevs.com", "https://api.nasa.gov", "https://api.wheretheiss.at", "https://isro.vercel.app"],
      workerSrc: ["'self'", "blob:"],
    },
  },
}));

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Session Setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Global User Middleware
app.use((req, res, next) => {
  res.locals.user = req.session ? req.session.user : null;
  res.locals.session = req.session || {};
  res.locals.dataTimeline = require('./services/spacexService').getDataTimeline();
  next();
});

// EJS Setup
app.use(expressLayouts);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('layout', 'layouts/main');

// Routes (to be added)
const indexRoutes = require('./routes/index');
const launchRoutes = require('./routes/launches');
const analyticsRoutes = require('./routes/analytics');
const mapRoutes = require('./routes/map');

app.use('/', indexRoutes);
app.use('/launches', launchRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/map', mapRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
    title: 'Error | Space Dashboard',
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Space Dashboard listening at http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('Stopping server...');
  server.close();
});
