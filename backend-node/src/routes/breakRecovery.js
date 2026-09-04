/**
 * Break Recovery Routes — Welcome back flow for returning users
 * /api/break-recovery/*
 */

import { Router } from 'express';
import { 
    generateRecap, 
    checkRecapNeeded, 
    markRecapViewed 
} from '../utils/breakRecoveryService.js';
import { log } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/break-recovery/check/:userId/:playlistId
 * Check if user needs a welcome back recap
 */
router.get('/check/:userId/:playlistId', async (req, res) => {
    const { userId, playlistId } = req.params;

    log('🔍', 'BREAK', `Checking recap for user ${userId.substring(0, 8)}...`);

    try {
        const result = await checkRecapNeeded(userId, playlistId);
        res.json(result);
    } catch (err) {
        log('❌', 'BREAK', `Check failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/break-recovery/generate
 * Generate a personalized recap for returning user
 * Body: { userId, playlistId }
 */
router.post('/generate', async (req, res) => {
    const { userId, playlistId } = req.body;

    if (!userId || !playlistId) {
        return res.status(400).json({ 
            error: 'userId and playlistId are required' 
        });
    }

    log('📝', 'BREAK', `Generating recap for user ${userId.substring(0, 8)}...`);

    try {
        const recap = await generateRecap(userId, playlistId);
        res.json(recap);
    } catch (err) {
        log('❌', 'BREAK', `Recap generation failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/break-recovery/viewed
 * Mark recap as viewed by user
 * Body: { userId, playlistId }
 */
router.post('/viewed', async (req, res) => {
    const { userId, playlistId } = req.body;

    if (!userId || !playlistId) {
        return res.status(400).json({ 
            error: 'userId and playlistId are required' 
        });
    }

    log('👀', 'BREAK', `Marking recap viewed for user ${userId.substring(0, 8)}...`);

    try {
        await markRecapViewed(userId, playlistId);
        res.json({ success: true });
    } catch (err) {
        log('❌', 'BREAK', `Failed to mark viewed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

export default router;
