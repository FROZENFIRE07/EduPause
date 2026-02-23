import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import ingestionRouter from './routes/ingestion.js';
import clickstreamRouter from './routes/clickstream.js';
import sessionRouter from './routes/session.js';
import agentRouter from './routes/agent.js';
import graphRouter from './routes/graph.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'MasteryOS Backend',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});

// Routes
app.use('/api/ingest', ingestionRouter);
app.use('/api/clickstream', clickstreamRouter);
app.use('/api/session', sessionRouter);
app.use('/api/agent', agentRouter);
app.use('/api/graph', graphRouter);

// Error handler
app.use((err, req, res, next) => {
    console.error('[ERROR]', err.message);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
    });
});

app.listen(PORT, () => {
    console.log(`\n🚀 MasteryOS Backend running on http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});

export default app;
