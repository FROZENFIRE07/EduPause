import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../utils/mongoClient.js';

const router = Router();

// POST /api/session — create a new learning session
router.post('/', async (req, res) => {
    const { userId, playlistId } = req.body;
    const sessionId = uuidv4();

    const session = {
        sessionId,
        userId: userId || 'anonymous',
        playlistId,
        mastery: {},
        currentVideoIndex: 0,
        totalStudyTime: 0,
        interventionsPassed: 0,
        interventionsFailed: 0,
        streak: 0,
        lastActiveAt: new Date(),
        createdAt: new Date(),
    };

    try {
        const db = await getDB();
        await db.collection('sessions').insertOne(session);
        res.json(session);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/session/:sessionId
router.get('/:sessionId', async (req, res) => {
    try {
        const db = await getDB();
        const session = await db.collection('sessions').findOne({ sessionId: req.params.sessionId });
        if (!session) return res.status(404).json({ error: 'Session not found' });
        res.json(session);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/session/:sessionId/mastery
router.get('/:sessionId/mastery', async (req, res) => {
    try {
        const db = await getDB();
        const session = await db.collection('sessions').findOne(
            { sessionId: req.params.sessionId },
            { projection: { mastery: 1 } }
        );
        if (!session) return res.status(404).json({ error: 'Session not found' });
        res.json(session.mastery || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/session/:sessionId/mastery — update mastery for a concept
router.patch('/:sessionId/mastery', async (req, res) => {
    const { conceptId, score } = req.body;
    if (!conceptId || score === undefined) {
        return res.status(400).json({ error: 'conceptId and score are required' });
    }

    try {
        const db = await getDB();
        await db.collection('sessions').updateOne(
            { sessionId: req.params.sessionId },
            {
                $set: {
                    [`mastery.${conceptId}`]: score,
                    lastActiveAt: new Date(),
                },
            }
        );
        res.json({ status: 'updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
