import { Router } from 'express';
import { getDB } from '../utils/mongoClient.js';
import { log } from '../utils/logger.js';

const router = Router();

// POST /api/clickstream — receive a clickstream event
router.post('/', async (req, res) => {
    const { sessionId, event } = req.body;
    if (!sessionId || !event) {
        return res.status(400).json({ error: 'sessionId and event are required' });
    }

    log('🖱️', 'CLICKSTREAM', `${event.type || '?'} @ ${(event.videoTime || 0).toFixed(1)}s — session=${sessionId.substring(0, 8)}...`);

    try {
        const db = await getDB();
        await db.collection('clickstream').insertOne({
            sessionId,
            ...event,
            receivedAt: new Date(),
        });
        res.json({ status: 'recorded' });
    } catch (err) {
        log('❌', 'CLICKSTREAM', `Save failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/clickstream/:sessionId — get recent events for a session
router.get('/:sessionId', async (req, res) => {
    log('📖', 'CLICKSTREAM', `Fetching events for session=${req.params.sessionId.substring(0, 8)}...`);

    try {
        const db = await getDB();
        const events = await db.collection('clickstream')
            .find({ sessionId: req.params.sessionId })
            .sort({ receivedAt: -1 })
            .limit(100)
            .toArray();
        log('📊', 'CLICKSTREAM', `Returning ${events.length} events`);
        res.json(events);
    } catch (err) {
        log('❌', 'CLICKSTREAM', `Fetch failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

export default router;
