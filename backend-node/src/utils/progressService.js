import { getDB } from './mongoClient.js';
import { log } from './logger.js';

/**
 * User Progress Tracking Service
 * Handles exposure-based and validation-based skill tracking
 */

/**
 * Initialize or get user progress for a playlist
 * @param {string} userId - User identifier
 * @param {string} playlistId - Playlist identifier
 * @returns {Promise<Object>} - User progress document
 */
export async function getUserProgress(userId, playlistId) {
    const db = await getDB();
    const collection = db.collection('user_progress');
    
    let progress = await collection.findOne({ userId, playlistId });
    
    if (!progress) {
        // Initialize new progress document
        progress = {
            userId,
            playlistId,
            videosWatched: [],
            conceptsCovered: {},
            currentPosition: {
                videoId: null,
                timestamp: 0,
                conceptId: null,
            },
            lastActivity: new Date(),
            createdAt: new Date(),
            stats: {
                totalWatchTime: 0,
                videosCompleted: 0,
                conceptsExposed: 0,
                conceptsMastered: 0,
                quizzesTaken: 0,
                quizzesPassed: 0,
            },
        };
        
        await collection.insertOne(progress);
        log('🆕', 'PROGRESS', `Created progress tracking for user ${userId} playlist ${playlistId}`);
    }
    
    return progress;
}

/**
 * Record video watch event
 * @param {string} userId
 * @param {string} playlistId
 * @param {string} videoId
 * @param {number} durationWatched - Seconds watched
 * @param {boolean} completed - Whether video was fully watched
 */
export async function recordVideoWatch(userId, playlistId, videoId, durationWatched, completed = false) {
    const db = await getDB();
    const collection = db.collection('user_progress');
    
    // Check if video already watched
    const progress = await getUserProgress(userId, playlistId);
    const existingWatch = progress.videosWatched.find(v => v.videoId === videoId);
    
    if (existingWatch) {
        // Update existing watch record
        await collection.updateOne(
            { userId, playlistId, 'videosWatched.videoId': videoId },
            {
                $set: {
                    'videosWatched.$.lastWatchedAt': new Date(),
                    'videosWatched.$.durationWatched': Math.max(existingWatch.durationWatched, durationWatched),
                    'videosWatched.$.completed': existingWatch.completed || completed,
                    lastActivity: new Date(),
                },
                $inc: {
                    'stats.totalWatchTime': durationWatched - (existingWatch.durationWatched || 0),
                },
            }
        );
    } else {
        // Add new watch record
        await collection.updateOne(
            { userId, playlistId },
            {
                $push: {
                    videosWatched: {
                        videoId,
                        watchedAt: new Date(),
                        lastWatchedAt: new Date(),
                        durationWatched,
                        completed,
                    },
                },
                $inc: {
                    'stats.totalWatchTime': durationWatched,
                    'stats.videosCompleted': completed ? 1 : 0,
                },
                $set: {
                    lastActivity: new Date(),
                },
            }
        );
    }
    
    log('📺', 'PROGRESS', `Recorded watch: user=${userId} video=${videoId} duration=${durationWatched}s completed=${completed}`);
}

/**
 * Update concept exposure (called when user watches video containing concept)
 * @param {string} userId
 * @param {string} playlistId
 * @param {string} conceptId
 * @param {string} videoId - Source video
 */
export async function updateConceptExposure(userId, playlistId, conceptId, videoId) {
    const db = await getDB();
    const collection = db.collection('user_progress');
    
    const progress = await getUserProgress(userId, playlistId);
    const concept = progress.conceptsCovered[conceptId];
    
    if (concept) {
        // Increment exposure
        await collection.updateOne(
            { userId, playlistId },
            {
                $set: {
                    [`conceptsCovered.${conceptId}.exposureCount`]: concept.exposureCount + 1,
                    [`conceptsCovered.${conceptId}.lastExposedAt`]: new Date(),
                    [`conceptsCovered.${conceptId}.videos`]: Array.from(new Set([...concept.videos, videoId])),
                    lastActivity: new Date(),
                },
            }
        );
    } else {
        // First exposure
        await collection.updateOne(
            { userId, playlistId },
            {
                $set: {
                    [`conceptsCovered.${conceptId}`]: {
                        exposureCount: 1,
                        firstExposedAt: new Date(),
                        lastExposedAt: new Date(),
                        videos: [videoId],
                        quizScores: [],
                        skillConfidence: 'low', // low/medium/high
                        confidenceScore: 0.2, // 0-1 scale
                    },
                    lastActivity: new Date(),
                },
                $inc: {
                    'stats.conceptsExposed': 1,
                },
            }
        );
        
        log('🎯', 'PROGRESS', `First exposure: user=${userId} concept=${conceptId} from video=${videoId}`);
    }
}

/**
 * Update concept mastery based on quiz performance
 * @param {string} userId
 * @param {string} playlistId
 * @param {string} conceptId
 * @param {number} score - Quiz score (0-1)
 * @param {string} difficulty - 'easy'|'medium'|'hard'
 */
export async function updateConceptMastery(userId, playlistId, conceptId, score, difficulty = 'medium') {
    const db = await getDB();
    const collection = db.collection('user_progress');
    
    const progress = await getUserProgress(userId, playlistId);
    const concept = progress.conceptsCovered[conceptId] || {
        exposureCount: 0,
        quizScores: [],
        confidenceScore: 0,
    };
    
    // Record quiz score
    const quizRecord = {
        score,
        difficulty,
        takenAt: new Date(),
    };
    
    // Calculate new confidence score
    // Weighted average of exposure (40%) + quiz performance (60%)
    const exposureScore = Math.min(concept.exposureCount / 5, 1.0); // Max out at 5 exposures
    const quizScores = [...(concept.quizScores || []), quizRecord];
    const avgQuizScore = quizScores.reduce((sum, q) => sum + q.score, 0) / quizScores.length;
    
    // Apply difficulty multiplier
    const difficultyMultiplier = { easy: 0.8, medium: 1.0, hard: 1.2 }[difficulty] || 1.0;
    const adjustedQuizScore = Math.min(avgQuizScore * difficultyMultiplier, 1.0);
    
    const confidenceScore = (exposureScore * 0.4) + (adjustedQuizScore * 0.6);
    
    // Determine confidence level
    let skillConfidence = 'low';
    if (confidenceScore >= 0.7) skillConfidence = 'high';
    else if (confidenceScore >= 0.4) skillConfidence = 'medium';
    
    // Update in database
    await collection.updateOne(
        { userId, playlistId },
        {
            $push: {
                [`conceptsCovered.${conceptId}.quizScores`]: quizRecord,
            },
            $set: {
                [`conceptsCovered.${conceptId}.skillConfidence`]: skillConfidence,
                [`conceptsCovered.${conceptId}.confidenceScore`]: confidenceScore,
                [`conceptsCovered.${conceptId}.lastUpdated`]: new Date(),
                lastActivity: new Date(),
            },
            $inc: {
                'stats.quizzesTaken': 1,
                'stats.quizzesPassed': score >= 0.6 ? 1 : 0,
                'stats.conceptsMastered': (concept.skillConfidence !== 'high' && skillConfidence === 'high') ? 1 : 0,
            },
        }
    );
    
    log('📊', 'PROGRESS', `Updated mastery: user=${userId} concept=${conceptId} confidence=${skillConfidence} (${(confidenceScore * 100).toFixed(0)}%)`);
    
    return { skillConfidence, confidenceScore };
}

/**
 * Update current learning position
 * @param {string} userId
 * @param {string} playlistId
 * @param {string} videoId
 * @param {number} timestamp
 * @param {string} conceptId - Optional current concept
 */
export async function updateCurrentPosition(userId, playlistId, videoId, timestamp, conceptId = null) {
    const db = await getDB();
    const collection = db.collection('user_progress');
    
    await collection.updateOne(
        { userId, playlistId },
        {
            $set: {
                'currentPosition.videoId': videoId,
                'currentPosition.timestamp': timestamp,
                'currentPosition.conceptId': conceptId,
                'currentPosition.updatedAt': new Date(),
                lastActivity: new Date(),
            },
        }
    );
}

/**
 * Get all concepts with their mastery levels
 * @param {string} userId
 * @param {string} playlistId
 * @returns {Promise<Object>} - Map of conceptId -> mastery info
 */
export async function getConceptMastery(userId, playlistId) {
    const progress = await getUserProgress(userId, playlistId);
    return progress.conceptsCovered || {};
}

/**
 * Get learning statistics
 * @param {string} userId
 * @param {string} playlistId
 * @returns {Promise<Object>} - Stats object
 */
export async function getLearningStats(userId, playlistId) {
    const progress = await getUserProgress(userId, playlistId);
    return progress.stats || {};
}

/**
 * Get concept mastery visualization data
 * Formats concept mastery for heatmap/graph visualization
 * @param {string} userId
 * @param {string} playlistId
 * @returns {Promise<Object>} - Formatted visualization data
 */
export async function getConceptVisualization(userId, playlistId) {
    const progress = await getUserProgress(userId, playlistId);
    const conceptsCovered = progress.conceptsCovered || {};
    
    // Transform to visualization-friendly format
    const nodes = Object.entries(conceptsCovered).map(([conceptId, data]) => {
        const confidenceScore = data.confidenceScore || 0;
        const skillConfidence = data.skillConfidence || 'low';
        
        // Assign color based on confidence
        let color;
        if (confidenceScore >= 0.7) color = '#4ade80'; // green - high
        else if (confidenceScore >= 0.4) color = '#fbbf24'; // yellow - medium
        else if (confidenceScore > 0) color = '#f87171'; // orange - low
        else color = '#6b7280'; // gray - not seen
        
        return {
            id: conceptId,
            label: conceptId,
            confidence: skillConfidence,
            confidenceScore: confidenceScore,
            exposureCount: data.exposureCount || 0,
            quizAttempts: data.quizScores?.length || 0,
            lastUpdated: data.lastUpdated,
            color,
            size: 10 + (confidenceScore * 20), // Visual weight
        };
    });
    
    // Group by confidence level
    const grouped = {
        high: nodes.filter(n => n.confidence === 'high'),
        medium: nodes.filter(n => n.confidence === 'medium'),
        low: nodes.filter(n => n.confidence === 'low'),
        notSeen: [], // Will be populated from roadmap
    };
    
    return {
        nodes,
        grouped,
        summary: {
            total: nodes.length,
            high: grouped.high.length,
            medium: grouped.medium.length,
            low: grouped.low.length,
        },
    };
}

/**
 * Detect if user is returning after a break
 * @param {string} userId
 * @param {string} playlistId
 * @param {number} breakThresholdDays - Default 2 days
 * @returns {Promise<Object>} - { isBreak, daysSince, lastPosition }
 */
export async function detectBreak(userId, playlistId, breakThresholdDays = 2) {
    const progress = await getUserProgress(userId, playlistId);
    
    if (!progress.lastActivity) {
        return { isBreak: false, daysSince: 0, lastPosition: null };
    }
    
    const now = new Date();
    const lastActivity = new Date(progress.lastActivity);
    const diffMs = now - lastActivity;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    
    const isBreak = diffDays >= breakThresholdDays;
    
    log('⏰', 'PROGRESS', `Break detection: user=${userId} days=${diffDays.toFixed(1)} isBreak=${isBreak}`);
    
    return {
        isBreak,
        daysSince: Math.floor(diffDays),
        lastPosition: progress.currentPosition,
        lastActivity: progress.lastActivity,
    };
}
