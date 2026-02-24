import { Router } from 'express';
import axios from 'axios';
import { getDB } from '../utils/mongoClient.js';
import { log } from '../utils/logger.js';

const router = Router();
const AGENT_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:8000';

/**
 * POST /api/agent/invoke
 * Proxy to the Python agent service, enriched with transcript context.
 */
router.post('/invoke', async (req, res) => {
    const { sessionId, action, currentConcept, clickstream, userAnswer, breakDuration, context, videoId, videoTime } = req.body;

    log('🤖', 'AGENT', `invoke action=${action} session=${sessionId?.substring(0, 8)}... concept="${currentConcept || ''}"`);

    // Attach transcript context when we have video position data
    let transcriptContext = '';
    if (videoId && (videoTime !== undefined && videoTime !== null)) {
        try {
            const db = await getDB();
            const doc = await db.collection('transcripts').findOne({ videoId });
            if (doc && doc.segments && doc.segments.length > 0) {
                const targetSec = parseFloat(videoTime);
                // Find closest segment
                let targetIdx = 0;
                let minDist = Infinity;
                for (let i = 0; i < doc.segments.length; i++) {
                    const dist = Math.abs(doc.segments[i].startSec - targetSec);
                    if (dist < minDist) {
                        minDist = dist;
                        targetIdx = i;
                    }
                }
                // Context window: 8 segments before + target + 8 after
                const start = Math.max(0, targetIdx - 8);
                const end = Math.min(doc.segments.length, targetIdx + 9);
                const contextSegs = doc.segments.slice(start, end);
                transcriptContext = contextSegs.map(s => s.text).join(' ');
                log('📄', 'AGENT', `  Attached transcript context: ${transcriptContext.length} chars at ${targetSec.toFixed(1)}s`);
            }
        } catch (e) {
            log('⚠️', 'AGENT', `  Failed to fetch transcript context: ${e.message}`);
        }
    }

    try {
        const agentPayload = {
            sessionId,
            action,
            clickstream: clickstream || [],
            userAnswer: userAnswer || '',
            currentConcept: currentConcept || '',
            breakDuration: breakDuration || '',
            context: context || {},
            transcriptContext,
            videoId: videoId || '',
            videoTimestamp: videoTime || 0,
        };

        const response = await axios.post(`${AGENT_URL}/invoke`, agentPayload, {
            timeout: 30000,
        });

        log('✅', 'AGENT', `invoke done — status=${response.status}`);
        res.json(response.data);
    } catch (err) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
            log('⚠️', 'AGENT', `Python agent unreachable — returning mock response`);
            // Return mock response so the frontend doesn't break
            return res.json({
                sessionId,
                action,
                result: {
                    confusion_score: 0.0,
                    confusion_breakdown: {},
                    intervention: null,
                    mastery_scores: {},
                    mastery_achieved: false,
                    evaluation_feedback: '',
                    recap_summary: '',
                    next_content: null,
                },
            });
        }
        log('❌', 'AGENT', `invoke error: ${err.message}`);
        res.status(err.response?.status || 500).json({
            error: err.response?.data?.detail || err.message,
        });
    }
});

/**
 * GET /api/agent/response/:sessionId
 */
router.get('/response/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    log('📖', 'AGENT', `response sessionId=${sessionId.substring(0, 8)}...`);

    try {
        const response = await axios.get(`${AGENT_URL}/response/${sessionId}`, {
            timeout: 10000,
        });
        res.json(response.data);
    } catch (err) {
        res.json({
            sessionId,
            status: 'ready',
            message: 'Agent response unavailable',
        });
    }
});

/**
 * GET /api/agent/health
 */
router.get('/health', async (req, res) => {
    try {
        const response = await axios.get(`${AGENT_URL}/health`, { timeout: 5000 });
        res.json(response.data);
    } catch (err) {
        res.json({ status: 'unreachable', error: err.message });
    }
});

export default router;
