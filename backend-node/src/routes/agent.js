import { Router } from 'express';
import axios from 'axios';

const router = Router();

const AGENT_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:8000';

// POST /api/agent/invoke — proxy invoke to Python agent
router.post('/invoke', async (req, res) => {
    try {
        const response = await axios.post(`${AGENT_URL}/invoke`, req.body, {
            timeout: 60000,
        });
        res.json(response.data);
    } catch (err) {
        if (err.response) {
            res.status(err.response.status).json(err.response.data);
        } else {
            res.status(502).json({
                error: 'Agent service unavailable',
                details: err.message,
            });
        }
    }
});

// GET /api/agent/response/:sessionId — get latest agent response
router.get('/response/:sessionId', async (req, res) => {
    try {
        const response = await axios.get(`${AGENT_URL}/response/${req.params.sessionId}`);
        res.json(response.data);
    } catch (err) {
        if (err.response) {
            res.status(err.response.status).json(err.response.data);
        } else {
            res.status(502).json({
                error: 'Agent service unavailable',
                details: err.message,
            });
        }
    }
});

// GET /api/agent/health
router.get('/health', async (req, res) => {
    try {
        const response = await axios.get(`${AGENT_URL}/health`, { timeout: 5000 });
        res.json(response.data);
    } catch {
        res.status(502).json({ status: 'agent_unavailable' });
    }
});

export default router;
