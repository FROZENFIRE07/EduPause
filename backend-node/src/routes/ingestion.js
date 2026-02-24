import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { fetchPlaylistVideos, fetchTranscript, getTimestampedSegments } from '../utils/youtube.js';
import { chunkTranscript, chunkWithTimestamps } from '../utils/chunker.js';
import { summarizeChunk, extractConcepts } from '../utils/groqClient.js';
import { embedText, embedBatch } from '../utils/embeddings.js';
import { upsertVectors } from '../utils/qdrantClient.js';
import { writeConceptsToGraph } from '../utils/neo4jClient.js';
import { getDB } from '../utils/mongoClient.js';
import { log } from '../utils/logger.js';

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
    jobs.set(jobId, {
        status: 'started',
        step: 0,
        totalSteps: 5,
        details: '',
        error: null,
        bgStatus: null,
        bgStep: 0,
    });

    log('📥', 'INGESTION', `New job ${jobId.substring(0, 8)}... for URL: ${playlistUrl.substring(0, 60)}...`);
    res.json({ jobId, status: 'started' });

    // Run pipeline asynchronously
    runIngestionPipeline(jobId, playlistUrl).catch(err => {
        log('❌', 'INGESTION', `Pipeline crash: ${err.message}`);
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
    const jobTag = jobId.substring(0, 8);

    const stepStart = () => Date.now();
    const stepDone = (start, msg) => {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        log('✅', `INGEST:${jobTag}`, `${msg} [${elapsed}s]`);
    };

    try {
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 1: FAST PATH — Get video list and let user start watching
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        let start = stepStart();
        job.step = 1;
        job.details = 'Fetching playlist metadata...';
        log('🔗', `INGEST:${jobTag}`, `Step 1 — Fetching playlist metadata...`);

        const videos = await fetchPlaylistVideos(playlistUrl);
        job.videoCount = videos.length;
        job.videos = videos.map(v => ({ videoId: v.videoId, title: v.title }));

        stepDone(start, `Playlist ready: ${videos.length} videos found`);
        videos.forEach((v, i) => log('📹', `INGEST:${jobTag}`, `  ${i + 1}. ${v.title} (${v.videoId})`));

        // ✅ Mark as COMPLETE immediately — user can start learning now
        job.status = 'complete';
        job.step = 5;
        job.details = `${videos.length} videos ready. Transcripts processing in background...`;

        log('🚀', `INGEST:${jobTag}`, `READY — User can start learning. Background processing begins...`);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 2: BACKGROUND — Sequentially process transcripts + AI
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        job.bgStatus = 'processing';

        // Step 2: Extract transcripts — sequential with delays to avoid 429
        start = stepStart();
        job.bgStep = 2;
        log('📝', `INGEST:${jobTag}`, `[BG] Extracting transcripts for ${videos.length} videos (sequential, paced)...`);

        const transcripts = [];
        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];

            // 5s delay between requests to respect YouTube rate limits
            if (i > 0) await new Promise(r => setTimeout(r, 5000));

            try {
                const transcript = await fetchTranscript(video.videoId, video.title);
                // Retrieve the timestamped segments (if yt-dlp was used)
                const segments = getTimestampedSegments(video.videoId) || null;
                transcripts.push({ ...video, transcript, segments });
                log('✅', `INGEST:${jobTag}`, `  [BG] Transcript ${i + 1}/${videos.length}: ${video.title} (${transcript.length} chars${segments ? `, ${segments.length} cues` : ', no timestamps'})`);
            } catch (e) {
                log('⚠️', `INGEST:${jobTag}`, `  [BG] Transcript SKIP: ${video.videoId} — ${e.message}`);
                transcripts.push({ ...video, transcript: null, segments: null });
            }
        }
        stepDone(start, `[BG] Transcripts done: ${transcripts.filter(t => t.transcript).length}/${videos.length}`);

        // Step 2.5: Save transcripts to MongoDB (the treasure!)
        try {
            const db = await getDB();
            for (const video of transcripts) {
                if (!video.transcript) continue;
                await db.collection('transcripts').updateOne(
                    { videoId: video.videoId },
                    {
                        $set: {
                            videoId: video.videoId,
                            title: video.title,
                            plainText: video.transcript,
                            segments: video.segments || [],
                            segmentCount: video.segments?.length || 0,
                            charCount: video.transcript.length,
                            extractedAt: new Date(),
                        },
                    },
                    { upsert: true }
                );
            }
            log('💾', `INGEST:${jobTag}`, `[BG] Transcripts saved to MongoDB (${transcripts.filter(t => t.transcript).length} videos)`);
        } catch (e) {
            log('⚠️', `INGEST:${jobTag}`, `[BG] Transcript MongoDB save failed: ${e.message}`);
        }

        // Step 3: Chunk + Summarize — use timestamp-aware chunking when possible
        start = stepStart();
        job.bgStep = 3;
        log('🤖', `INGEST:${jobTag}`, `[BG] Chunking & AI summarization...`);

        const allChunks = [];
        try {
            for (const video of transcripts) {
                if (!video.transcript) continue;

                let chunks;
                if (video.segments && video.segments.length > 0) {
                    // Use timestamp-aware chunking (segments from yt-dlp)
                    chunks = chunkWithTimestamps(video.segments, { chunkSize: 512 });
                    log('📦', `INGEST:${jobTag}`, `  [BG] ${video.title}: ${chunks.length} timestamped chunks`);
                } else {
                    // Fallback: plain text chunking (no timestamps)
                    const plainChunks = chunkTranscript(video.transcript, { chunkSize: 512, overlap: 50 });
                    chunks = plainChunks.map(text => ({ text, startTime: null, endTime: null, startSec: null, endSec: null }));
                    log('📦', `INGEST:${jobTag}`, `  [BG] ${video.title}: ${chunks.length} chunks (no timestamps)`);
                }

                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    const timeRange = chunk.startTime ? { startTime: chunk.startTime, endTime: chunk.endTime } : null;
                    const summary = await summarizeChunk(chunk.text, video.title, timeRange);
                    allChunks.push({
                        videoId: video.videoId,
                        videoTitle: video.title,
                        chunkIndex: i,
                        text: chunk.text,
                        summary,
                        startTime: chunk.startTime,
                        endTime: chunk.endTime,
                        startSec: chunk.startSec,
                        endSec: chunk.endSec,
                    });
                }
            }
            stepDone(start, `[BG] ${allChunks.length} chunks summarized`);
        } catch (e) {
            log('⚠️', `INGEST:${jobTag}`, `[BG] Summarization failed: ${e.message}`);
        }

        // Step 4: Extract concepts → Knowledge Graph (with video anchors)
        start = stepStart();
        job.bgStep = 4;
        log('🧠', `INGEST:${jobTag}`, `[BG] Extracting concepts...`);

        const allConcepts = [];
        const seenConceptIds = new Set();
        try {
            for (const chunk of allChunks) {
                const anchor = {
                    videoId: chunk.videoId,
                    startTime: chunk.startTime || '',
                    endTime: chunk.endTime || '',
                };
                const concepts = await extractConcepts(chunk.summary, anchor, [...seenConceptIds]);
                for (const c of concepts) {
                    if (!seenConceptIds.has(c.concept)) {
                        seenConceptIds.add(c.concept);
                        allConcepts.push(c);
                    }
                }
            }
            log('📊', `INGEST:${jobTag}`, `  [BG] Extracted ${allConcepts.length} unique concepts (deduped from ${seenConceptIds.size} seen)`);
            await writeConceptsToGraph(allConcepts);
            stepDone(start, `[BG] ${allConcepts.length} concepts → Neo4j`);
        } catch (e) {
            log('⚠️', `INGEST:${jobTag}`, `[BG] Concept extraction failed: ${e.message}`);
        }

        // Step 5: Embed & store (with timestamp metadata in Qdrant payload)
        start = stepStart();
        job.bgStep = 5;
        log('🔢', `INGEST:${jobTag}`, `[BG] Generating embeddings for ${allChunks.length} chunks...`);

        try {
            const texts = allChunks.map(c => c.summary);
            if (texts.length > 0) {
                const embeddings = await embedBatch(texts);
                const vectors = allChunks.map((c, i) => ({
                    id: `${c.videoId}-chunk-${c.chunkIndex}`,
                    vector: embeddings[i],
                    payload: {
                        videoId: c.videoId,
                        videoTitle: c.videoTitle,
                        chunkIndex: c.chunkIndex,
                        summary: c.summary,
                        startTime: c.startTime,
                        endTime: c.endTime,
                        startSec: c.startSec,
                        endSec: c.endSec,
                    },
                }));
                await upsertVectors(vectors);
                stepDone(start, `[BG] ${vectors.length} vectors → Qdrant`);
            } else {
                log('⚠️', `INGEST:${jobTag}`, `[BG] No chunks to embed`);
            }
        } catch (e) {
            log('⚠️', `INGEST:${jobTag}`, `[BG] Embeddings failed: ${e.message}`);
        }

        // Save playlist to MongoDB
        try {
            const db = await getDB();
            await db.collection('playlists').insertOne({
                playlistUrl,
                videos: transcripts.map(v => ({
                    videoId: v.videoId,
                    title: v.title,
                    hasTimestamps: !!(v.segments && v.segments.length > 0),
                })),
                chunkCount: allChunks.length,
                conceptCount: allConcepts.length,
                ingestedAt: new Date(),
            });
            log('💾', `INGEST:${jobTag}`, `[BG] Saved to MongoDB`);
        } catch (e) {
            log('⚠️', `INGEST:${jobTag}`, `[BG] MongoDB save failed: ${e.message}`);
        }

        // Background processing complete
        job.bgStatus = 'complete';
        job.details = `${videos.length} videos, ${allChunks.length} chunks, ${allConcepts.length} concepts fully processed.`;
        log('🎉', `INGEST:${jobTag}`, `[BG] ALL PROCESSING COMPLETE — ${videos.length} videos, ${allChunks.length} chunks, ${allConcepts.length} concepts`);

    } catch (err) {
        log('❌', `INGEST:${jobTag}`, `Pipeline FAILED: ${err.message}`);
        job.status = 'error';
        job.error = err.message;
    }
}

export default router;
