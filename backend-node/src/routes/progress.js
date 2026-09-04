import { Router } from 'express';
import {
    getUserProgress,
    recordVideoWatch,
    updateConceptExposure,
    updateConceptMastery,
    updateCurrentPosition,
    getConceptMastery,
    getLearningStats,
    detectBreak,
    getConceptVisualization,
} from '../utils/progressService.js';
import { log } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/progress/:userId/:playlistId
 * Get complete progress for a user on a playlist
 */
router.get('/:userId/:playlistId', async (req, res) => {
    const { userId, playlistId } = req.params;
    
    try {
        const progress = await getUserProgress(userId, playlistId);
        res.json(progress);
    } catch (err) {
        log('❌', 'PROGRESS', `Failed to get progress: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/progress/watch
 * Record a video watch event
 * Body: { userId, playlistId, videoId, durationWatched, completed }
 */
router.post('/watch', async (req, res) => {
    const { userId, playlistId, videoId, durationWatched, completed } = req.body;
    
    if (!userId || !playlistId || !videoId || durationWatched === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        await recordVideoWatch(userId, playlistId, videoId, durationWatched, completed || false);
        res.json({ status: 'recorded' });
    } catch (err) {
        log('❌', 'PROGRESS', `Failed to record watch: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/progress/concept/exposure
 * Update concept exposure
 * Body: { userId, playlistId, conceptId, videoId }
 */
router.post('/concept/exposure', async (req, res) => {
    const { userId, playlistId, conceptId, videoId } = req.body;
    
    if (!userId || !playlistId || !conceptId || !videoId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        await updateConceptExposure(userId, playlistId, conceptId, videoId);
        res.json({ status: 'updated' });
    } catch (err) {
        log('❌', 'PROGRESS', `Failed to update exposure: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/progress/concept/mastery
 * Update concept mastery from quiz
 * Body: { userId, playlistId, conceptId, score, difficulty }
 */
router.post('/concept/mastery', async (req, res) => {
    const { userId, playlistId, conceptId, score, difficulty } = req.body;
    
    if (!userId || !playlistId || !conceptId || score === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        const result = await updateConceptMastery(userId, playlistId, conceptId, score, difficulty || 'medium');
        res.json(result);
    } catch (err) {
        log('❌', 'PROGRESS', `Failed to update mastery: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/progress/position
 * Update current learning position
 * Body: { userId, playlistId, videoId, timestamp, conceptId }
 */
router.post('/position', async (req, res) => {
    const { userId, playlistId, videoId, timestamp, conceptId } = req.body;
    
    if (!userId || !playlistId || !videoId || timestamp === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        await updateCurrentPosition(userId, playlistId, videoId, timestamp, conceptId);
        res.json({ status: 'updated' });
    } catch (err) {
        log('❌', 'PROGRESS', `Failed to update position: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/progress/:userId/:playlistId/mastery
 * Get concept mastery map
 */
router.get('/:userId/:playlistId/mastery', async (req, res) => {
    const { userId, playlistId } = req.params;
    
    try {
        const mastery = await getConceptMastery(userId, playlistId);
        res.json(mastery);
    } catch (err) {
        log('❌', 'PROGRESS', `Failed to get mastery: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/progress/:userId/:playlistId/stats
 * Get learning statistics
 */
router.get('/:userId/:playlistId/stats', async (req, res) => {
    const { userId, playlistId } = req.params;
    
    try {
        const stats = await getLearningStats(userId, playlistId);
        res.json(stats);
    } catch (err) {
        log('❌', 'PROGRESS', `Failed to get stats: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/progress/:userId/:playlistId/break
 * Detect if user is returning after a break
 */
router.get('/:userId/:playlistId/break', async (req, res) => {
    const { userId, playlistId } = req.params;
    const { threshold } = req.query;
    
    try {
        const breakInfo = await detectBreak(userId, playlistId, threshold ? parseInt(threshold) : 2);
        res.json(breakInfo);
    } catch (err) {
        log('❌', 'PROGRESS', `Failed to detect break: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/progress/:userId/:playlistId/visualization
 * Get concept mastery data formatted for heatmap visualization
 */
router.get('/:userId/:playlistId/visualization', async (req, res) => {
    const { userId, playlistId } = req.params;
    
    try {
        const vizData = await getConceptVisualization(userId, playlistId);
        res.json(vizData);
    } catch (err) {
        log('❌', 'PROGRESS', `Failed to get visualization data: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

export default router;
