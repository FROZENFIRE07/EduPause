/**
 * Quiz Routes — Checkpoint-based quiz system
 * /api/quiz/*
 */

import { Router } from 'express';
import { 
    shouldTriggerQuiz, 
    generateQuiz, 
    submitQuizAnswers, 
    skipQuiz 
} from '../utils/quizService.js';
import { log } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/quiz/trigger
 * Check if quiz should be triggered after video completion
 * Body: { userId, playlistId, videoId }
 */
router.post('/trigger', async (req, res) => {
    const { userId, playlistId, videoId } = req.body;

    if (!userId || !playlistId || !videoId) {
        return res.status(400).json({ 
            error: 'userId, playlistId, and videoId are required' 
        });
    }

    log('🔍', 'QUIZ', `Checking trigger for video ${videoId}`);

    try {
        const triggerCheck = await shouldTriggerQuiz(userId, playlistId, videoId);
        
        if (triggerCheck.shouldTrigger) {
            // Generate quiz
            const quizData = await generateQuiz(userId, playlistId, videoId);
            
            return res.json({
                shouldTrigger: true,
                ...quizData
            });
        } else {
            return res.json({
                shouldTrigger: false,
                reason: triggerCheck.reason
            });
        }
    } catch (err) {
        log('❌', 'QUIZ', `Trigger check failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/quiz/generate
 * Manually generate a quiz for a video
 * Body: { userId, playlistId, videoId }
 */
router.post('/generate', async (req, res) => {
    const { userId, playlistId, videoId, difficulty } = req.body;

    if (!userId || !playlistId || !videoId) {
        return res.status(400).json({ 
            error: 'userId, playlistId, and videoId are required' 
        });
    }

    log('📝', 'QUIZ', `Manual quiz generation for video ${videoId} (difficulty: ${difficulty || 'default'})`);

    try {
        const quizData = await generateQuiz(userId, playlistId, videoId, difficulty);
        res.json(quizData);
    } catch (err) {
        log('❌', 'QUIZ', `Quiz generation failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/quiz/submit
 * Submit quiz answers for evaluation
 * Body: { quizSessionId, responses: [{questionIndex, answerIndex}] }
 */
router.post('/submit', async (req, res) => {
    const { quizSessionId, responses } = req.body;

    if (!quizSessionId || !responses || !Array.isArray(responses)) {
        return res.status(400).json({ 
            error: 'quizSessionId and responses array are required' 
        });
    }

    log('📤', 'QUIZ', `Submitting ${responses.length} quiz answers`);

    try {
        const evaluation = await submitQuizAnswers(quizSessionId, responses);
        res.json(evaluation);
    } catch (err) {
        log('❌', 'QUIZ', `Quiz submission failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/quiz/skip
 * Skip a quiz (user chose not to take it)
 * Body: { quizSessionId }
 */
router.post('/skip', async (req, res) => {
    const { quizSessionId } = req.body;

    if (!quizSessionId) {
        return res.status(400).json({ error: 'quizSessionId is required' });
    }

    log('⏭️', 'QUIZ', `User skipping quiz ${quizSessionId}`);

    try {
        const result = await skipQuiz(quizSessionId);
        res.json(result);
    } catch (err) {
        log('❌', 'QUIZ', `Skip failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/quiz/history/:userId/:playlistId
 * Get quiz history for a user and playlist
 */
router.get('/history/:userId/:playlistId', async (req, res) => {
    const { userId, playlistId } = req.params;

    log('📖', 'QUIZ', `Fetching quiz history for user ${userId.substring(0, 8)}...`);

    try {
        const { getDB } = await import('../utils/mongoClient.js');
        const db = await getDB();
        
        const quizResults = await db.collection('quiz_results')
            .find({ userId, playlistId })
            .sort({ takenAt: -1 })
            .limit(50)
            .toArray();

        res.json({
            count: quizResults.length,
            quizzes: quizResults
        });
    } catch (err) {
        log('❌', 'QUIZ', `History fetch failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

export default router;
