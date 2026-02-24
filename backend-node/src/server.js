import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { log, C } from './utils/logger.js';
import ingestionRouter from './routes/ingestion.js';
import clickstreamRouter from './routes/clickstream.js';
import sessionRouter from './routes/session.js';
import agentRouter from './routes/agent.js';
import graphRouter from './routes/graph.js';
import transcriptRouter from './routes/transcript.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Re-export for any remaining references
export { log };

// ─── Middleware ─────────────────────────────────────────────────────────────

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    const oldEnd = res.end;

    res.end = function (...args) {
        const elapsed = Date.now() - start;
        const status = res.statusCode;
        const icon = status < 400 ? '✅' : status < 500 ? '⚠️' : '❌';
        const bodyKeys = req.body ? Object.keys(req.body).join(', ') : '';

        log(icon, 'HTTP', `${C.bold}${req.method}${C.reset} ${req.originalUrl} → ${C.bold}${status}${C.reset} ${C.dim}[${elapsed}ms]${C.reset}${bodyKeys ? ` ${C.gray}body: {${bodyKeys}}${C.reset}` : ''}`);

        oldEnd.apply(res, args);
    };

    next();
});

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
app.use('/api/transcript', transcriptRouter);

// Error handler
app.use((err, req, res, next) => {
    log('❌', 'ERROR', `${C.red}${err.message}${C.reset}`);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
    });
});

app.listen(PORT, () => {
    console.log('');
    console.log(`${C.cyan}╔══════════════════════════════════════════════════════════════╗${C.reset}`);
    console.log(`${C.cyan}║${C.reset}     ${C.bold}🚀 MasteryOS Backend — Node.js${C.reset}                           ${C.cyan}║${C.reset}`);
    console.log(`${C.cyan}╠══════════════════════════════════════════════════════════════╣${C.reset}`);
    console.log(`${C.cyan}║${C.reset}  Port:        ${C.green}${PORT}${C.reset}`);
    console.log(`${C.cyan}║${C.reset}  Health:      ${C.blue}http://localhost:${PORT}/api/health${C.reset}`);
    console.log(`${C.cyan}║${C.reset}  GROQ_API_KEY:  ${process.env.GROQ_API_KEY ? `${C.green}✅ Set${C.reset}` : `${C.yellow}❌ Not set (demo mode)${C.reset}`}`);
    console.log(`${C.cyan}║${C.reset}  MONGODB_URI:   ${process.env.MONGODB_URI ? `${C.green}✅ Set${C.reset}` : `${C.yellow}❌ Not set (in-memory)${C.reset}`}`);
    const ytKeyCount = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(i => process.env[`YOUTUBE_API_KEY${i}`]).length;
    console.log(`${C.cyan}║${C.reset}  YOUTUBE_KEYS:  ${ytKeyCount > 0 ? `${C.green}✅ ${ytKeyCount} key(s)${C.reset}` : `${C.yellow}❌ Not set (scrape mode)${C.reset}`}`);
    console.log(`${C.cyan}║${C.reset}  AGENT_URL:     ${process.env.AGENT_SERVICE_URL || `http://localhost:8000`}`);
    console.log(`${C.cyan}╚══════════════════════════════════════════════════════════════╝${C.reset}`);
    console.log('');
    log('🟢', 'SERVER', 'Backend ready — awaiting requests');
    console.log('');
});

export default app;
