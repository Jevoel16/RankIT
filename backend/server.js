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

dotenv.config();

connectDB();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/tallies', tallyRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/contestants', contestantRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/public', publicRoutes);

app.get('/api', (req, res) => {
    res.json({ message: 'RankIT API is running' });
});

if (process.env.NODE_ENV === 'production') {
    const frontendBuildPath = path.join(__dirname, '..', 'frontend-react', 'build');
    app.use(express.static(frontendBuildPath));

    app.get(/^\/(?!api).*/, (req, res) => {
        res.sendFile(path.join(frontendBuildPath, 'index.html'));
    });
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`App URL: http://localhost:${PORT}`);
    console.log(`API URL: http://localhost:${PORT}/api`);
});
