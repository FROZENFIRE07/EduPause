/**
 * Break Recovery Service — Welcome back flow with AI-generated recaps
 * Helps users resume learning after breaks (2+ days)
 */

import { getDB } from './mongoClient.js';
import { log } from './logger.js';
import { detectBreak, getUserProgress } from './progressService.js';
import axios from 'axios';

const AGENT_CORE_URL = process.env.AGENT_CORE_URL || 'http://localhost:8000';

/**
 * Generate an AI-powered recap for a user returning after a break
 * @param {string} userId 
 * @param {string} playlistId 
 * @returns {Promise<Object>} Recap with summary, last concepts, and next steps
 */
export async function generateRecap(userId, playlistId) {
    try {
        const db = await getDB();
        
        // Get break information
        const breakInfo = await detectBreak(userId, playlistId);
        
        if (!breakInfo.isBreak) {
            log('ℹ️', 'RECAP', `No break detected for user ${userId} - skipping recap`);
            return {
                isBreak: false,
                message: 'Welcome back! Continue where you left off.'
            };
        }

        // Get user progress
        const progress = await getUserProgress(userId, playlistId);
        
        // Get last concepts studied
        const conceptsCovered = progress.conceptsCovered || {};
        const conceptEntries = Object.entries(conceptsCovered)
            .sort((a, b) => {
                const dateA = new Date(a[1].lastUpdated || 0);
                const dateB = new Date(b[1].lastUpdated || 0);
                return dateB - dateA;
            })
            .slice(0, 5);  // Last 5 concepts

        const lastConcepts = conceptEntries.map(([id, data]) => ({
            id,
            confidence: data.skillConfidence,
            exposure: data.exposureCount,
        }));

        // Get last video watched
        const lastPosition = breakInfo.lastPosition;
        const lastVideo = lastPosition?.videoId ? 
            await db.collection('videos').findOne({ videoId: lastPosition.videoId }) : 
            null;

        log('📤', 'RECAP', `Calling break_recovery agent for user ${userId}`);

        // Call break_recovery agent
        const agentPayload = {
            action: 'break_recovery',
            session_id: `${userId}_${playlistId}`,
            break_duration: `${breakInfo.daysSince} days`,
            break_detected: true,
            mastery_scores: convertConfidenceToMastery(conceptsCovered),
            current_concept: lastConcepts[0]?.id || 'general',
        };

        const agentResponse = await axios.post(`${AGENT_CORE_URL}/api/agent`, agentPayload, {
            timeout: 20000
        });

        const recapSummary = agentResponse.data?.recap_summary || 
            generateFallbackRecap(breakInfo.daysSince, lastConcepts, lastVideo);

        // Store recap in database
        const recapDoc = {
            userId,
            playlistId,
            breakDuration: breakInfo.daysSince,
            lastConcepts,
            lastVideo: lastVideo ? { id: lastVideo.videoId, title: lastVideo.title } : null,
            recapSummary,
            generatedAt: new Date(),
        };

        await db.collection('break_recaps').insertOne(recapDoc);

        log('✅', 'RECAP', `Recap generated for ${breakInfo.daysSince}-day break`);

        return {
            isBreak: true,
            daysSince: breakInfo.daysSince,
            lastPosition: breakInfo.lastPosition,
            lastConcepts,
            lastVideo: lastVideo ? {
                id: lastVideo.videoId,
                title: lastVideo.title,
                thumbnail: lastVideo.thumbnail
            } : null,
            recapSummary,
            stats: progress.stats,
        };

    } catch (err) {
        log('❌', 'RECAP', `Recap generation failed: ${err.message}`);
        
        // Return fallback recap
        const breakInfo = await detectBreak(userId, playlistId);
        return {
            isBreak: breakInfo.isBreak,
            daysSince: breakInfo.daysSince,
            recapSummary: `Welcome back! It's been ${breakInfo.daysSince} days since your last session. Let's continue your learning journey.`,
            error: err.message
        };
    }
}

/**
 * Convert confidence scores to mastery scores for agent compatibility
 */
function convertConfidenceToMastery(conceptsCovered) {
    const mastery = {};
    
    Object.entries(conceptsCovered).forEach(([id, data]) => {
        const confidenceScore = data.confidenceScore || 0;
        mastery[id] = confidenceScore * 100; // Convert 0-1 to 0-100
    });
    
    return mastery;
}

/**
 * Generate a simple fallback recap when agent fails
 */
function generateFallbackRecap(daysSince, lastConcepts, lastVideo) {
    const greetings = [
        `Welcome back! It's been ${daysSince} days.`,
        `Great to see you again! You've been away for ${daysSince} days.`,
        `You're back! ${daysSince} days since your last session.`
    ];
    
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    
    let recap = greeting;
    
    if (lastConcepts.length > 0) {
        const conceptNames = lastConcepts.map(c => c.id).join(', ');
        recap += ` You were studying: ${conceptNames}.`;
    }
    
    if (lastVideo) {
        recap += ` Last video: "${lastVideo.title}".`;
    }
    
    recap += ` Ready to continue your learning journey?`;
    
    return recap;
}

/**
 * Check if user needs a recap (called on session start)
 * @param {string} userId 
 * @param {string} playlistId 
 * @returns {Promise<Object>} shouldShow flag and recap data
 */
export async function checkRecapNeeded(userId, playlistId) {
    try {
        const breakInfo = await detectBreak(userId, playlistId);
        
        if (!breakInfo.isBreak) {
            return { shouldShow: false };
        }

        // Check if recap was already shown today
        const db = await getDB();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const existingRecap = await db.collection('break_recaps').findOne({
            userId,
            playlistId,
            generatedAt: { $gte: today }
        });

        if (existingRecap) {
            log('ℹ️', 'RECAP', `Recap already shown today for user ${userId}`);
            return { shouldShow: false, reason: 'Already shown today' };
        }

        return {
            shouldShow: true,
            daysSince: breakInfo.daysSince,
        };

    } catch (err) {
        log('⚠️', 'RECAP', `Error checking recap: ${err.message}`);
        return { shouldShow: false };
    }
}

/**
 * Mark recap as viewed
 * @param {string} userId 
 * @param {string} playlistId 
 */
export async function markRecapViewed(userId, playlistId) {
    try {
        const db = await getDB();
        
        await db.collection('break_recaps').updateOne(
            { 
                userId, 
                playlistId,
                viewedAt: { $exists: false }
            },
            {
                $set: {
                    viewedAt: new Date()
                }
            },
            { sort: { generatedAt: -1 } }
        );

        log('✅', 'RECAP', `Recap marked as viewed for user ${userId}`);
    } catch (err) {
        log('⚠️', 'RECAP', `Failed to mark recap viewed: ${err.message}`);
    }
}
