import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { fetchPlaylistVideos, fetchTranscript } from '../utils/youtube.js';
import { chunkTranscript } from '../utils/chunker.js';
import { summarizeChunk, extractConcepts } from '../utils/groqClient.js';
import { embedText, embedBatch } from '../utils/embeddings.js';
import { upsertVectors } from '../utils/qdrantClient.js';
import { writeConceptsToGraph } from '../utils/neo4jClient.js';
import { getDB } from '../utils/mongoClient.js';

const router = Router();

// In-memory job tracker
const jobs = new Map();

// POST /api/ingest — start ingestion
router.post('/', async (req, res) => {
    const { playlistUrl } = req.body;
    if (!playlistUrl) {
        return res.status(400).json({ error: 'playlistUrl is required' });
    }

    const jobId = uuidv4();
    jobs.set(jobId, { status: 'started', step: 0, totalSteps: 5, details: '', error: null });
    res.json({ jobId, status: 'started' });

    // Run pipeline asynchronously
    runIngestionPipeline(jobId, playlistUrl).catch(err => {
        console.error('[Ingestion Error]', err);
        const job = jobs.get(jobId);
        if (job) {
            job.status = 'error';
            job.error = err.message;
        }
    });
});

// GET /api/ingest/status/:jobId
router.get('/status/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
});

async function runIngestionPipeline(jobId, playlistUrl) {
    const job = jobs.get(jobId);
    let videos = [];
    let transcripts = [];
    let allChunks = [];
    let allConcepts = [];

    try {
        // Step 1: Fetch playlist metadata
        job.step = 1;
        job.details = 'Fetching playlist metadata...';
        videos = await fetchPlaylistVideos(playlistUrl);
        job.videoCount = videos.length;
        job.videos = videos.map(v => ({ videoId: v.videoId, title: v.title }));

        // Step 2: Extract transcripts
        job.step = 2;
        job.details = 'Extracting transcripts...';
        for (const video of videos) {
            try {
                const transcript = await fetchTranscript(video.videoId);
                transcripts.push({ ...video, transcript });
            } catch (e) {
                console.warn(`[Transcript] Skip ${video.videoId}: ${e.message}`);
                transcripts.push({ ...video, transcript: null });
            }
        }

        // Step 3: Chunk + Summarize (graceful — skip on failure)
        job.step = 3;
        job.details = 'Chunking & summarizing with AI...';
        try {
            for (const video of transcripts) {
                if (!video.transcript) continue;
                const chunks = chunkTranscript(video.transcript, { chunkSize: 512, overlap: 50 });
                for (let i = 0; i < chunks.length; i++) {
                    const summary = await summarizeChunk(chunks[i], video.title);
                    allChunks.push({
                        videoId: video.videoId,
                        videoTitle: video.title,
                        chunkIndex: i,
                        text: chunks[i],
                        summary,
                    });
                }
            }
        } catch (e) {
            console.warn('[Ingestion] Step 3 (Chunk/Summarize) failed:', e.message);
        }

        // Step 4: Extract concepts → Knowledge Graph (graceful)
        job.step = 4;
        job.details = 'Building knowledge graph...';
        try {
            for (const chunk of allChunks) {
                const concepts = await extractConcepts(chunk.summary);
                allConcepts.push(...concepts);
            }
            await writeConceptsToGraph(allConcepts);
        } catch (e) {
            console.warn('[Ingestion] Step 4 (Knowledge Graph) failed:', e.message);
        }

        // Step 5: Embed & store (graceful)
        job.step = 5;
        job.details = 'Generating embeddings & storing...';
        try {
            const texts = allChunks.map(c => c.summary);
            const embeddings = await embedBatch(texts);
            const vectors = allChunks.map((c, i) => ({
                id: `${c.videoId}-chunk-${c.chunkIndex}`,
                vector: embeddings[i],
                payload: {
                    videoId: c.videoId,
                    videoTitle: c.videoTitle,
                    chunkIndex: c.chunkIndex,
                    summary: c.summary,
                },
            }));
            await upsertVectors(vectors);
        } catch (e) {
            console.warn('[Ingestion] Step 5 (Embeddings) failed:', e.message);
        }

        // Save to MongoDB (graceful)
        try {
            const db = await getDB();
            await db.collection('playlists').insertOne({
                playlistUrl,
                videos: transcripts.map(v => ({ videoId: v.videoId, title: v.title })),
                chunkCount: allChunks.length,
                conceptCount: allConcepts.length,
                ingestedAt: new Date(),
            });
        } catch (e) {
            console.warn('[Ingestion] MongoDB save failed:', e.message);
        }

        job.status = 'complete';
        job.details = `Ingested ${videos.length} videos, ${allChunks.length} chunks, ${allConcepts.length} concepts.`;
    } catch (err) {
        console.error('[Ingestion] Pipeline failed:', err.message);
        job.status = 'error';
        job.error = err.message;
        // Do NOT re-throw — we don't want to crash the server
    }
}

export default router;
