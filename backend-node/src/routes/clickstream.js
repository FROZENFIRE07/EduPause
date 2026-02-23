import { Router } from 'express';
import { getDB } from '../utils/mongoClient.js';

const router = Router();

// POST /api/clickstream — receive a clickstream event
router.post('/', async (req, res) => {
    const { sessionId, event } = req.body;
    if (!sessionId || !event) {
        return res.status(400).json({ error: 'sessionId and event are required' });
    }

    try {
        const db = await getDB();
        await db.collection('clickstream').insertOne({
            sessionId,
            ...event,
            receivedAt: new Date(),
        });
        res.json({ status: 'recorded' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/clickstream/:sessionId — get recent events for a session
router.get('/:sessionId', async (req, res) => {
    try {
        const db = await getDB();
        const events = await db.collection('clickstream')
            .find({ sessionId: req.params.sessionId })
            .sort({ receivedAt: -1 })
            .limit(100)
            .toArray();
        res.json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
