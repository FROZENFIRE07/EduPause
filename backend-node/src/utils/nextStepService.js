import { getDB } from './mongoClient.js';
import { getRoadmap } from './roadmapService.js';
import { getUserProgress } from './progressService.js';
import { log } from './logger.js';

/**
 * Next-Step Recommendation Engine
 * Determines what the user should learn next based on roadmap + progress
 */

/**
 * Get the next recommended learning step for a user
 * @param {string} userId - User identifier
 * @param {string} playlistId - Playlist identifier
 * @returns {Promise<Object>} - Next step recommendation with reasoning
 */
export async function getNextStep(userId, playlistId) {
    log('🎯', 'NEXT-STEP', `Calculating next step for user=${userId} playlist=${playlistId}`);

    try {
        // Step 1: Get roadmap for playlist
        const roadmap = await getRoadmap(playlistId);
        if (!roadmap || !roadmap.concepts || roadmap.concepts.length === 0) {
            throw new Error('No roadmap available for this playlist');
        }

        // Step 2: Get user progress
        const progress = await getUserProgress(userId, playlistId);
        const conceptsMastered = new Set();
        const conceptsInProgress = new Set();

        // Identify mastered and in-progress concepts
        Object.entries(progress.conceptsCovered || {}).forEach(([conceptId, data]) => {
            if (data.skillConfidence === 'high') {
                conceptsMastered.add(conceptId);
            } else if (data.exposureCount > 0) {
                conceptsInProgress.add(conceptId);
            }
        });

        log('📊', 'NEXT-STEP', `Progress: ${conceptsMastered.size} mastered, ${conceptsInProgress.size} in progress`);

        // Step 3: Find next concept with satisfied prerequisites
        const nextConcept = findNextConcept(roadmap.concepts, conceptsMastered, conceptsInProgress);

        if (!nextConcept) {
            // All concepts mastered!
            return {
                type: 'complete',
                message: '🎉 Congratulations! You\'ve mastered all concepts in this playlist.',
                playlistComplete: true,
                stats: {
                    totalConcepts: roadmap.concepts.length,
                    masteredConcepts: conceptsMastered.size,
                    progress: 100,
                },
            };
        }

        // Step 4: Find video(s) that teach this concept
        const db = await getDB();
        const videoId = nextConcept.videoId;
        
        let video = null;
        if (videoId) {
            // Get video details
            const playlist = await db.collection('playlists').findOne({ playlistId });
            if (playlist && playlist.videos) {
                video = playlist.videos.find(v => v.videoId === videoId);
            }
        }

        // Step 5: Generate recommendation reasoning
        const reasoning = generateReasoning(nextConcept, conceptsMastered, conceptsInProgress, roadmap);

        const recommendation = {
            type: 'concept',
            concept: {
                id: nextConcept.id,
                label: nextConcept.label,
                definition: nextConcept.definition,
                milestone: nextConcept.milestone,
                order: nextConcept.order,
            },
            video: video ? {
                videoId: video.videoId,
                title: video.title,
                thumbnail: video.thumbnail,
                startTime: nextConcept.startTime,
                endTime: nextConcept.endTime,
            } : null,
            reasoning: reasoning.message,
            why: reasoning.why,
            prerequisites: nextConcept.prerequisites || [],
            stats: {
                totalConcepts: roadmap.concepts.length,
                masteredConcepts: conceptsMastered.size,
                inProgress: conceptsInProgress.size,
                remaining: roadmap.concepts.length - conceptsMastered.size,
                progress: Math.round((conceptsMastered.size / roadmap.concepts.length) * 100),
            },
        };

        log('✅', 'NEXT-STEP', `Recommended: ${nextConcept.label} (${nextConcept.milestone})`);
        return recommendation;

    } catch (err) {
        log('❌', 'NEXT-STEP', `Failed to calculate next step: ${err.message}`);
        throw err;
    }
}

/**
 * Find the next concept to learn based on prerequisites
 * @param {Array} concepts - All concepts from roadmap
 * @param {Set} mastered - Concepts with high confidence
 * @param {Set} inProgress - Concepts with some exposure
 * @returns {Object|null} - Next concept or null if all mastered
 */
function findNextConcept(concepts, mastered, inProgress) {
    // Sort concepts by order (prerequisite depth)
    const sortedConcepts = [...concepts].sort((a, b) => a.order - b.order);

    for (const concept of sortedConcepts) {
        // Skip if already mastered
        if (mastered.has(concept.id)) continue;

        // Check if all prerequisites are mastered
        const prereqs = concept.prerequisites || [];
        const allPrereqsMastered = prereqs.every(prereqId => mastered.has(prereqId));

        if (allPrereqsMastered) {
            // Prefer concepts in progress over new ones (continuity)
            if (inProgress.has(concept.id)) {
                return concept;
            }
        }
    }

    // If no in-progress found, return first concept with satisfied prereqs
    for (const concept of sortedConcepts) {
        if (mastered.has(concept.id)) continue;

        const prereqs = concept.prerequisites || [];
        const allPrereqsMastered = prereqs.every(prereqId => mastered.has(prereqId));

        if (allPrereqsMastered) {
            return concept;
        }
    }

    return null; // All mastered or blocked by prerequisites
}

/**
 * Generate human-readable reasoning for the recommendation
 */
function generateReasoning(concept, mastered, inProgress, roadmap) {
    const isInProgress = inProgress.has(concept.id);
    const prereqs = concept.prerequisites || [];
    const milestone = concept.milestone || 'beginner';

    let message, why;

    if (isInProgress) {
        message = `Continue learning **${concept.label}**`;
        why = `You've started exploring this concept but haven't reached mastery yet. Let's build on what you know.`;
    } else {
        message = `Start learning **${concept.label}**`;
        
        if (prereqs.length === 0) {
            why = `This is a foundational concept with no prerequisites — the perfect place to start.`;
        } else {
            const masteredPrereqs = prereqs.filter(p => mastered.has(p));
            if (masteredPrereqs.length === prereqs.length) {
                why = `You've mastered all prerequisites for this concept. You're ready to take the next step.`;
            } else {
                why = `This builds on concepts you've already learned.`;
            }
        }
    }

    // Add milestone context
    const milestoneEmoji = {
        beginner: '🎯',
        intermediate: '🚀',
        advanced: '🏆',
    };

    const milestoneText = {
        beginner: 'Foundation',
        intermediate: 'Core',
        advanced: 'Advanced',
    };

    const contextNote = `${milestoneEmoji[milestone]} ${milestoneText[milestone]} level`;

    return {
        message,
        why,
        context: contextNote,
    };
}

/**
 * Get learning path (ordered list of next N concepts)
 * @param {string} userId
 * @param {string} playlistId
 * @param {number} limit - Number of concepts to return (default 5)
 * @returns {Promise<Array>} - Ordered list of next concepts
 */
export async function getLearningPath(userId, playlistId, limit = 5) {
    log('🛤️', 'NEXT-STEP', `Generating learning path (${limit} steps) for user=${userId}`);

    try {
        const roadmap = await getRoadmap(playlistId);
        if (!roadmap || !roadmap.concepts) {
            throw new Error('No roadmap available');
        }

        const progress = await getUserProgress(userId, playlistId);
        const conceptsMastered = new Set();

        Object.entries(progress.conceptsCovered || {}).forEach(([conceptId, data]) => {
            if (data.skillConfidence === 'high') {
                conceptsMastered.add(conceptId);
            }
        });

        const path = [];
        const tempMastered = new Set(conceptsMastered);
        const sortedConcepts = [...roadmap.concepts].sort((a, b) => a.order - b.order);

        // Simulate learning each concept in order to build path
        for (let i = 0; i < limit; i++) {
            const nextConcept = findNextConcept(sortedConcepts, tempMastered, new Set());
            
            if (!nextConcept) break; // No more concepts available
            
            path.push({
                id: nextConcept.id,
                label: nextConcept.label,
                milestone: nextConcept.milestone,
                order: nextConcept.order,
                step: i + 1,
            });

            // Mark as "mastered" for next iteration
            tempMastered.add(nextConcept.id);
        }

        log('✅', 'NEXT-STEP', `Generated path with ${path.length} steps`);
        return path;

    } catch (err) {
        log('❌', 'NEXT-STEP', `Failed to generate learning path: ${err.message}`);
        throw err;
    }
}
