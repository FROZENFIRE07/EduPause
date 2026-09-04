import { Router } from 'express';
import { getDB } from '../utils/mongoClient.js';
import { updateConceptExposure, recordVideoWatch } from '../utils/progressService.js';
import { getConceptGraph } from '../utils/neo4jClient.js';
import { log } from '../utils/logger.js';

const router = Router();

/**
 * Helper: Extract concepts from a video using knowledge graph
 */
async function getVideoConcepts(videoId) {
    try {
        const graph = await getConceptGraph(null, videoId);
        return graph.concepts.map(c => c.id);
    } catch (err) {
        log('⚠️', 'CLICKSTREAM', `Failed to get concepts for video ${videoId}: ${err.message}`);
        return [];
    }
}

// POST /api/clickstream — receive a clickstream event
router.post('/', async (req, res) => {
    const { sessionId, event } = req.body;
    if (!sessionId || !event) {
        return res.status(400).json({ error: 'sessionId and event are required' });
    }

    log('🖱️', 'CLICKSTREAM', `${event.type || '?'} @ ${(event.videoTime || 0).toFixed(1)}s — session=${sessionId.substring(0, 8)}...`);

    try {
        const db = await getDB();
        
        // Store clickstream event
        await db.collection('clickstream').insertOne({
            sessionId,
            ...event,
            receivedAt: new Date(),
        });

        // Auto-track concept exposure on video completion
        if (event.type === 'video_ended' || event.type === 'video_completed') {
            // Get session to find userId and playlistId
            const session = await db.collection('sessions').findOne({ sessionId });
            
            if (session && session.userId && session.playlistId && event.videoId) {
                const userId = session.userId;
                const playlistId = session.playlistId;
                const videoId = event.videoId;
                const durationWatched = event.videoTime || 0;

                // Record video watch (non-blocking)
                recordVideoWatch(userId, playlistId, videoId, durationWatched, true)
                    .catch(err => log('⚠️', 'CLICKSTREAM', `Failed to record video watch: ${err.message}`));

                // Get concepts from this video and update exposure (non-blocking)
                getVideoConcepts(videoId).then(conceptIds => {
                    if (conceptIds.length > 0) {
                        log('🎯', 'CLICKSTREAM', `Auto-tracking ${conceptIds.length} concepts from video ${videoId}`);
                        
                        // Update exposure for each concept (fire-and-forget)
                        conceptIds.forEach(conceptId => {
                            updateConceptExposure(userId, playlistId, conceptId, videoId)
                                .catch(err => log('⚠️', 'CLICKSTREAM', `Failed to update concept exposure: ${err.message}`));
                        });
                    }
                }).catch(err => log('⚠️', 'CLICKSTREAM', `Failed to get video concepts: ${err.message}`));
            }
        }

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
