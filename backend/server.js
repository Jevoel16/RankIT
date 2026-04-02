const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const eventRoutes = require('./routes/eventRoutes');
const tallyRoutes = require('./routes/tallyRoutes');
const auditRoutes = require('./routes/auditRoutes');
const contestantRoutes = require('./routes/contestantRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const publicRoutes = require('./routes/publicRoutes');
const adminRoutes = require('./routes/adminRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');

dotenv.config();

connectDB();

const app = express();

app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

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

app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/tallies', tallyRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/contestants', contestantRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/assignments', assignmentRoutes);

app.get('/', (req, res) => {
    res.status(200).json({
        message: 'RankIT backend is running',
        api: '/api'
    });
});

app.get('/api', (req, res) => {
    res.json({ message: 'RankIT API is running' });
});

if (process.env.NODE_ENV === 'production' && process.env.VERCEL !== '1') {
    const frontendBuildPath = path.join(__dirname, '..', 'frontend-react', 'build');
    app.use(express.static(frontendBuildPath));

    app.get(/^\/(?!api).*/, (req, res) => {
        res.sendFile(path.join(frontendBuildPath, 'index.html'));
    });
}

if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    const HOST = process.env.HOST || '0.0.0.0';

    app.listen(PORT, HOST, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Bind Host: ${HOST}`);
        console.log(`App URL (local): http://localhost:${PORT}`);
        console.log(`API URL (local): http://localhost:${PORT}/api`);
        console.log('For other devices, use your machine LAN IP in place of localhost.');
    });
}

module.exports = app;
