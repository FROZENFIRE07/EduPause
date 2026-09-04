import { getDB } from './mongoClient.js';
import { getConceptGraph } from './neo4jClient.js';
import { log } from './logger.js';

/**
 * Enhanced Roadmap Service
 * Generates structured learning roadmaps from knowledge graph + summaries
 */

/**
 * Generate a structured learning roadmap for a playlist
 * Uses knowledge graph to build concept dependencies and milestones
 * 
 * @param {string} playlistId - The playlist ID
 * @param {string[]} videoIds - Array of video IDs in the playlist
 * @returns {Promise<Object>} - Structured roadmap with concepts, dependencies, milestones
 */
export async function generateStructuredRoadmap(playlistId, videoIds) {
    log('🗺️', 'ROADMAP', `Generating structured roadmap for playlist ${playlistId} with ${videoIds.length} videos`);

    try {
        const db = await getDB();
        
        // Step 1: Fetch all concepts from knowledge graph
        const graph = await getConceptGraph(playlistId);
        log('📊', 'ROADMAP', `Fetched ${graph.concepts.length} concepts, ${graph.edges.length} prerequisite edges`);

        // Step 2: Build concept map with video associations
        const conceptMap = new Map();
        graph.concepts.forEach(concept => {
            conceptMap.set(concept.id, {
                ...concept,
                prerequisites: [],
                dependents: [],
                level: 0, // Will be calculated based on depth
                milestone: 'beginner', // beginner/intermediate/advanced
            });
        });

        // Step 3: Map prerequisites and calculate dependency levels
        graph.edges.forEach(edge => {
            const prereq = conceptMap.get(edge.from);
            const dependent = conceptMap.get(edge.to);
            if (prereq && dependent) {
                dependent.prerequisites.push(edge.from);
                prereq.dependents.push(edge.to);
            }
        });

        // Step 4: Calculate concept levels (topological depth)
        const calculateLevels = () => {
            const visited = new Set();
            const levels = new Map();

            const dfs = (conceptId, currentLevel = 0) => {
                if (visited.has(conceptId)) return levels.get(conceptId);
                
                visited.add(conceptId);
                const concept = conceptMap.get(conceptId);
                
                if (!concept || concept.prerequisites.length === 0) {
                    levels.set(conceptId, 0);
                    return 0;
                }

                const maxPrereqLevel = Math.max(
                    ...concept.prerequisites.map(prereqId => dfs(prereqId, currentLevel + 1))
                );
                
                const level = maxPrereqLevel + 1;
                levels.set(conceptId, level);
                return level;
            };

            conceptMap.forEach((_, conceptId) => {
                if (!visited.has(conceptId)) {
                    dfs(conceptId);
                }
            });

            return levels;
        };

        const levels = calculateLevels();
        const maxLevel = Math.max(...levels.values(), 0);

        // Step 5: Assign milestone categories based on level
        conceptMap.forEach((concept, id) => {
            const level = levels.get(id) || 0;
            concept.level = level;
            
            if (maxLevel === 0) {
                concept.milestone = 'beginner';
            } else {
                const normalizedLevel = level / maxLevel;
                if (normalizedLevel < 0.33) {
                    concept.milestone = 'beginner';
                } else if (normalizedLevel < 0.67) {
                    concept.milestone = 'intermediate';
                } else {
                    concept.milestone = 'advanced';
                }
            }
        });

        // Step 6: Order concepts by level and group into learning sequence
        const orderedConcepts = Array.from(conceptMap.values())
            .sort((a, b) => {
                if (a.level !== b.level) return a.level - b.level;
                // Secondary sort by number of dependents (more fundamental concepts first)
                return b.dependents.length - a.dependents.length;
            });

        // Step 7: Group into milestone buckets
        const milestones = {
            beginner: orderedConcepts.filter(c => c.milestone === 'beginner'),
            intermediate: orderedConcepts.filter(c => c.milestone === 'intermediate'),
            advanced: orderedConcepts.filter(c => c.milestone === 'advanced'),
        };

        // Step 8: Build final roadmap structure
        const roadmap = {
            playlistId,
            generatedAt: new Date(),
            version: '1.0',
            concepts: orderedConcepts.map(c => ({
                id: c.id,
                label: c.label,
                definition: c.definition,
                order: c.level,
                prerequisites: c.prerequisites,
                milestone: c.milestone,
                videoId: c.videoId,
                startTime: c.startTime,
                endTime: c.endTime,
            })),
            dependencies: graph.edges,
            milestones: {
                beginner: {
                    title: 'Foundational Concepts',
                    description: 'Master the fundamentals to build a strong foundation',
                    concepts: milestones.beginner.map(c => c.id),
                    icon: '🎯',
                },
                intermediate: {
                    title: 'Core Understanding',
                    description: 'Develop deeper understanding of key principles',
                    concepts: milestones.intermediate.map(c => c.id),
                    icon: '🚀',
                },
                advanced: {
                    title: 'Advanced Mastery',
                    description: 'Apply concepts to complex scenarios and edge cases',
                    concepts: milestones.advanced.map(c => c.id),
                    icon: '🏆',
                },
            },
            stats: {
                totalConcepts: orderedConcepts.length,
                totalDependencies: graph.edges.length,
                beginnerConcepts: milestones.beginner.length,
                intermediateConcepts: milestones.intermediate.length,
                advancedConcepts: milestones.advanced.length,
            },
        };

        log('✅', 'ROADMAP', `Generated roadmap: ${roadmap.stats.totalConcepts} concepts across 3 milestones`);
        return roadmap;

    } catch (err) {
        log('❌', 'ROADMAP', `Failed to generate roadmap: ${err.message}`);
        throw err;
    }
}

/**
 * Save roadmap to MongoDB for persistence
 */
export async function saveRoadmap(roadmap) {
    const db = await getDB();
    const collection = db.collection('roadmaps');
    
    // Create index on playlistId if not exists
    await collection.createIndex({ playlistId: 1 }, { unique: true });
    
    // Upsert by playlistId
    await collection.updateOne(
        { playlistId: roadmap.playlistId },
        { $set: roadmap },
        { upsert: true }
    );
    
    log('💾', 'ROADMAP', `Saved roadmap for playlist ${roadmap.playlistId}`);
}

/**
 * Retrieve roadmap from MongoDB
 */
export async function getRoadmap(playlistId) {
    const db = await getDB();
    const collection = db.collection('roadmaps');
    
    const roadmap = await collection.findOne({ playlistId });
    
    if (roadmap) {
        log('📖', 'ROADMAP', `Retrieved roadmap for playlist ${playlistId}`);
    } else {
        log('⚠️', 'ROADMAP', `No roadmap found for playlist ${playlistId}`);
    }
    
    return roadmap;
}
