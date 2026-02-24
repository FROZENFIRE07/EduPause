import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../utils/mongoClient.js';
import { log } from '../utils/logger.js';

const router = Router();

// POST /api/session — create a new learning session
router.post('/', async (req, res) => {
    const { userId, playlistId } = req.body;
    const sessionId = uuidv4();

    log('🆕', 'SESSION', `Creating session ${sessionId.substring(0, 8)}... for user=${userId || 'anonymous'} playlist=${playlistId || '(none)'}`);

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
        log('✅', 'SESSION', `Session created: ${sessionId.substring(0, 8)}...`);
        res.json(session);
    } catch (err) {
        log('❌', 'SESSION', `Create failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/session/:sessionId
router.get('/:sessionId', async (req, res) => {
    const sid = req.params.sessionId;
    log('📖', 'SESSION', `Fetching session ${sid.substring(0, 8)}...`);

    try {
        const db = await getDB();
        const session = await db.collection('sessions').findOne({ sessionId: sid });
        if (!session) {
            log('⚠️', 'SESSION', `Not found: ${sid.substring(0, 8)}...`);
            return res.status(404).json({ error: 'Session not found' });
        }
        log('✅', 'SESSION', `Found session — mastery keys: ${Object.keys(session.mastery || {}).length}, study time: ${session.totalStudyTime || 0}s`);
        res.json(session);
    } catch (err) {
        log('❌', 'SESSION', `Fetch failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/session/:sessionId/mastery
router.get('/:sessionId/mastery', async (req, res) => {
    const sid = req.params.sessionId;
    log('📊', 'SESSION', `Fetching mastery for session ${sid.substring(0, 8)}...`);

    try {
        const db = await getDB();
        const session = await db.collection('sessions').findOne(
            { sessionId: sid },
            { projection: { mastery: 1 } }
        );
        if (!session) {
            log('⚠️', 'SESSION', `Mastery not found for: ${sid.substring(0, 8)}...`);
            return res.status(404).json({ error: 'Session not found' });
        }
        const mastery = session.mastery || {};
        log('✅', 'SESSION', `Mastery: ${JSON.stringify(mastery).substring(0, 100)}`);
        res.json(mastery);
    } catch (err) {
        log('❌', 'SESSION', `Mastery fetch failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/session/:sessionId/mastery — update mastery for a concept
router.patch('/:sessionId/mastery', async (req, res) => {
    const { conceptId, score } = req.body;
    if (!conceptId || score === undefined) {
        return res.status(400).json({ error: 'conceptId and score are required' });
    }

    const sid = req.params.sessionId;
    log('📝', 'SESSION', `Updating mastery: session=${sid.substring(0, 8)}... concept="${conceptId}" score=${score}`);

    try {
        const db = await getDB();
        await db.collection('sessions').updateOne(
            { sessionId: sid },
            {
                $set: {
                    [`mastery.${conceptId}`]: score,
                    lastActiveAt: new Date(),
                },
            }
        );
        log('✅', 'SESSION', `Mastery updated: ${conceptId} = ${score}`);
        res.json({ status: 'updated' });
    } catch (err) {
        log('❌', 'SESSION', `Mastery update failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

export default router;
