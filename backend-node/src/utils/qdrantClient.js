import { QdrantClient } from '@qdrant/js-client-rest';

const COLLECTION = process.env.QDRANT_COLLECTION || 'mastery_os_chunks';
const VECTOR_DIM = 384; // all-MiniLM-L6-v2 output dimension

let client = null;

function getClient() {
    if (client) return client;

    const url = process.env.QDRANT_URL;
    const apiKey = process.env.QDRANT_API_KEY;

    if (!url) {
        console.warn('[Qdrant] No QDRANT_URL configured — using mock mode');
        return null;
    }

    client = new QdrantClient({ url, apiKey });
    return client;
}

/**
 * Ensure the collection exists
 */
async function ensureCollection() {
    const c = getClient();
    if (!c) return;

    try {
        await c.getCollection(COLLECTION);
    } catch {
        await c.createCollection(COLLECTION, {
            vectors: { size: VECTOR_DIM, distance: 'Cosine' },
        });
        console.log(`[Qdrant] Created collection: ${COLLECTION}`);
    }
}

/**
 * Upsert vectors into Qdrant
 * @param {{ id: string, vector: number[], payload: object }[]} vectors
 */
export async function upsertVectors(vectors) {
    const c = getClient();
    if (!c) {
        console.log(`[Qdrant Mock] Would upsert ${vectors.length} vectors`);
        return;
    }

    await ensureCollection();

    // Qdrant expects integer IDs or UUIDs in some configs
    const points = vectors.map((v, i) => ({
        id: i + Date.now(),
        vector: v.vector,
        payload: v.payload,
    }));

    await c.upsert(COLLECTION, { wait: true, points });
    console.log(`[Qdrant] Upserted ${points.length} vectors`);
}

/**
 * Search for similar vectors
 * @param {number[]} queryVector
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
export async function searchVectors(queryVector, limit = 5) {
    const c = getClient();
    if (!c) {
        console.log('[Qdrant Mock] Search returning empty results');
        return [];
    }

    await ensureCollection();

    const results = await c.search(COLLECTION, {
        vector: queryVector,
        limit,
        with_payload: true,
    });

    return results.map(r => ({
        score: r.score,
        ...r.payload,
    }));
}
