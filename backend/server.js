const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const { errorHandler, notFoundHandler } = require('./utils/httpErrors');
const { rejectOperatorKeys, requireAppHeader } = require('./middleware/validate');
const { apiLimiter, loginLimiter, registerLimiter } = require('./middleware/rateLimit');
const userRoutes = require('./routes/userRoutes');
const eventRoutes = require('./routes/eventRoutes');
const scoresRoutes = require('./routes/scoresRoutes');
const auditRoutes = require('./routes/auditRoutes');
const contestantRoutes = require('./routes/contestantRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const publicRoutes = require('./routes/publicRoutes');
const adminRoutes = require('./routes/adminRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const rankingRoutes = require('./routes/rankingRoutes');
const oauthRoutes = require('./routes/oauthRoutes');
const { listProviders } = require('./controllers/oauthController');

dotenv.config({ quiet: true });

const corsOptions = require('./config/cors');

const app = express();

app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(
    helmet({
        // Only matters when Express also serves the built SPA (non-Vercel production).
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
                imgSrc: ["'self'", 'data:', 'blob:'],
                connectSrc: ["'self'"],
                workerSrc: ["'self'", 'blob:'],
                frameSrc: ["'self'", 'blob:'],
                objectSrc: ["'none'"],
                frameAncestors: ["'none'"]
            }
        }
    })
);
app.use(cors(corsOptions));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api', requireAppHeader);
app.use(rejectOperatorKeys);
app.use('/api', apiLimiter);
app.use('/api/users/login', loginLimiter);
app.use('/api/users/register', registerLimiter);

if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        const isHttps = req.secure || String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
        if (!isHttps) {
            return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
        }

        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        return next();
    });
}

app.get('/api', (req, res) => {
    res.json({ message: 'RankIT API is running' });
});

// Reads only environment config, so the login page can show its buttons even while the database is down.
app.get('/api/auth/providers', listProviders);

// Every other API route needs the database; connect lazily so cold starts reuse the cached pool.
app.use('/api', async (req, res, next) => {
    await connectDB();
    next();
});

app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/scores', scoresRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/contestants', contestantRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/rankings', rankingRoutes);
app.use('/api/auth', oauthRoutes);

app.get('/', (req, res) => {
    res.status(200).json({
        message: 'RankIT backend is running',
        api: '/api'
    });
});

app.use('/api', notFoundHandler);

if (process.env.NODE_ENV === 'production' && process.env.VERCEL !== '1') {
    const frontendBuildPath = path.join(__dirname, '..', 'frontend-react', 'build');
    app.use(express.static(frontendBuildPath));

    app.get(/^\/(?!api).*/, (req, res) => {
        res.sendFile(path.join(frontendBuildPath, 'index.html'));
    });
}

app.use(errorHandler);

if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    const HOST = process.env.HOST || '0.0.0.0';

    connectDB().catch((error) => console.error(`MongoDB connection failed: ${error.message}`));

    app.listen(PORT, HOST, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Bind Host: ${HOST}`);
        console.log(`App URL (local): http://localhost:${PORT}`);
        console.log(`API URL (local): http://localhost:${PORT}/api`);
        console.log('For other devices, use your machine LAN IP in place of localhost.');
    });
}

module.exports = app;
