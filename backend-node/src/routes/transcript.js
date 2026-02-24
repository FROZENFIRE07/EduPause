import { Router } from 'express';
import { getDB } from '../utils/mongoClient.js';
import { log } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/transcript/:videoId
 * Returns full timestamped transcript for a video
 */
router.get('/:videoId', async (req, res) => {
    const { videoId } = req.params;
    log('📄', 'TRANSCRIPT', `Fetching transcript for video=${videoId}`);

    try {
        const db = await getDB();
        const doc = await db.collection('transcripts').findOne({ videoId });

        if (!doc) {
            log('⚠️', 'TRANSCRIPT', `No transcript found for ${videoId}`);
            return res.status(404).json({ error: 'Transcript not found' });
        }

        log('✅', 'TRANSCRIPT', `Found: ${doc.segmentCount || 0} segments, ${doc.charCount || 0} chars`);
        res.json({
            videoId: doc.videoId,
            title: doc.title,
            segments: doc.segments || [],
            segmentCount: doc.segmentCount || 0,
            charCount: doc.charCount || 0,
            plainText: doc.plainText || '',
        });
    } catch (err) {
        log('❌', 'TRANSCRIPT', `Fetch failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/transcript/:videoId/at/:seconds
 * Returns the transcript chunk/context active at a specific video timestamp.
 * Used by the agent to get the exact lecture content when confusion is detected.
 */
router.get('/:videoId/at/:seconds', async (req, res) => {
    const { videoId } = req.params;
    const targetSec = parseFloat(req.params.seconds);
    log('🔍', 'TRANSCRIPT', `Looking up transcript for ${videoId} at ${targetSec}s`);

    try {
        const db = await getDB();
        const doc = await db.collection('transcripts').findOne({ videoId });

        if (!doc || !doc.segments || doc.segments.length === 0) {
            return res.status(404).json({ error: 'Transcript not found or has no segments' });
        }

        // Find the segment at the target time, plus surrounding context
        const segments = doc.segments;
        let targetIdx = -1;

        for (let i = 0; i < segments.length; i++) {
            if (segments[i].startSec <= targetSec && segments[i].endSec >= targetSec) {
                targetIdx = i;
                break;
            }
        }

        // If exact match not found, find closest
        if (targetIdx === -1) {
            let minDist = Infinity;
            for (let i = 0; i < segments.length; i++) {
                const dist = Math.abs(segments[i].startSec - targetSec);
                if (dist < minDist) {
                    minDist = dist;
                    targetIdx = i;
                }
            }
        }

        // Extract a context window: 10 segments before + the segment + 10 after
        const windowStart = Math.max(0, targetIdx - 10);
        const windowEnd = Math.min(segments.length, targetIdx + 11);
        const contextSegments = segments.slice(windowStart, windowEnd);
        const contextText = contextSegments.map(s => s.text).join(' ');
        const activeSegment = segments[targetIdx];

        log('✅', 'TRANSCRIPT', `Found context at ${activeSegment?.start || '?'}: ${contextText.length} chars (${contextSegments.length} segments)`);

        res.json({
            videoId,
            targetTime: targetSec,
            activeSegment,
            contextText,
            contextSegments,
            startTime: contextSegments[0]?.start,
            endTime: contextSegments[contextSegments.length - 1]?.end,
        });
    } catch (err) {
        log('❌', 'TRANSCRIPT', `At-time lookup failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

export default router;
