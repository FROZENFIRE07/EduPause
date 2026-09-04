import { Router } from 'express';
import { getNextStep, getLearningPath } from '../utils/nextStepService.js';
import { log } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/next-step/:userId/:playlistId
 * Get the next recommended learning step
 */
router.get('/:userId/:playlistId', async (req, res) => {
    const { userId, playlistId } = req.params;
    
    try {
        const nextStep = await getNextStep(userId, playlistId);
        res.json(nextStep);
    } catch (err) {
        log('❌', 'NEXT-STEP', `Failed to get next step: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/next-step/:userId/:playlistId/path
 * Get the full learning path (next N steps)
 * Query params: ?limit=5 (default)
 */
router.get('/:userId/:playlistId/path', async (req, res) => {
    const { userId, playlistId } = req.params;
    const limit = parseInt(req.query.limit) || 5;
    
    if (limit < 1 || limit > 20) {
        return res.status(400).json({ error: 'Limit must be between 1 and 20' });
    }
    
    try {
        const path = await getLearningPath(userId, playlistId, limit);
        res.json({ path, limit });
    } catch (err) {
        log('❌', 'NEXT-STEP', `Failed to get learning path: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

export default router;
