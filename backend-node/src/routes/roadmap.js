import { Router } from 'express';
import { getDB } from '../utils/mongoClient.js';
import { generateRoadmap } from '../utils/groqClient.js';
import { generateStructuredRoadmap, saveRoadmap, getRoadmap } from '../utils/roadmapService.js';
import { log } from '../utils/logger.js';

const router = Router();

// In-memory cache: playlistKey → { milestones, generatedAt }
const roadmapCache = new Map();

/**
 * POST /api/roadmap
 * Generate a course roadmap from playlist video data.
 * Body: { videoIds: string[] }
 * Returns: { milestones: [...] }
 */
router.post('/', async (req, res) => {
    const { videoIds } = req.body;
    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
        return res.status(400).json({ error: 'videoIds array is required' });
    }

    const cacheKey = videoIds.sort().join(',');
    log('🗺️', 'ROADMAP', `Generating roadmap for ${videoIds.length} videos`);

    // Return cached if available (< 1 hour old)
    const cached = roadmapCache.get(cacheKey);
    if (cached && Date.now() - cached.generatedAt < 3600000) {
        log('✅', 'ROADMAP', `Cache hit — returning ${cached.milestones.length} milestones`);
        return res.json({ milestones: cached.milestones, cached: true });
    }

    try {
        // Fetch transcripts/summaries from MongoDB
        const db = await getDB();
        const transcripts = await db.collection('transcripts')
            .find({ videoId: { $in: videoIds } })
            .project({ videoId: 1, title: 1, plainText: 1 })
            .toArray();

        log('📄', 'ROADMAP', `Found ${transcripts.length}/${videoIds.length} transcripts in MongoDB`);

        // Build video data for LLM
        const videoData = videoIds.map(id => {
            const doc = transcripts.find(t => t.videoId === id);
            return {
                title: doc?.title || `Video ${id}`,
                summary: doc?.plainText?.substring(0, 1000) || '',
            };
        });

        // Call LLM to generate roadmap
        const milestones = await generateRoadmap(videoData);

        if (milestones.length > 0) {
            roadmapCache.set(cacheKey, { milestones, generatedAt: Date.now() });
        }

        log('✅', 'ROADMAP', `Generated ${milestones.length} milestones`);
        res.json({ milestones, cached: false });
    } catch (err) {
        log('❌', 'ROADMAP', `Generation failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/roadmap/:playlistId
 * Get structured roadmap for a playlist (from knowledge graph)
 * Returns: { roadmap: {...} } with concepts, dependencies, and milestones
 */
router.get('/:playlistId', async (req, res) => {
    const { playlistId } = req.params;
    
    try {
        // Check if roadmap already exists in DB
        let roadmap = await getRoadmap(playlistId);
        
        if (!roadmap) {
            // Generate new roadmap from knowledge graph
            log('🔨', 'ROADMAP', `No existing roadmap, generating for ${playlistId}`);
            
            // Get video IDs for this playlist
            const db = await getDB();
            const playlist = await db.collection('playlists').findOne({ playlistId });
            
            if (!playlist || !playlist.videos) {
                return res.status(404).json({ error: 'Playlist not found' });
            }
            
            const videoIds = playlist.videos.map(v => v.videoId);
            roadmap = await generateStructuredRoadmap(playlistId, videoIds);
            
            // Save to DB
            await saveRoadmap(roadmap);
        }
        
        res.json({ roadmap });
    } catch (err) {
        log('❌', 'ROADMAP', `Failed to get roadmap: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/roadmap/:playlistId/regenerate
 * Force regenerate roadmap for a playlist
 * Returns: { roadmap: {...} }
 */
router.post('/:playlistId/regenerate', async (req, res) => {
    const { playlistId } = req.params;
    
    try {
        const db = await getDB();
        const playlist = await db.collection('playlists').findOne({ playlistId });
        
        if (!playlist || !playlist.videos) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        
        const videoIds = playlist.videos.map(v => v.videoId);
        log('🔄', 'ROADMAP', `Regenerating roadmap for ${playlistId}`);
        
        const roadmap = await generateStructuredRoadmap(playlistId, videoIds);
        await saveRoadmap(roadmap);
        
        res.json({ roadmap });
    } catch (err) {
        log('❌', 'ROADMAP', `Regeneration failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

export default router;
