/**
 * Local embedding generation using @xenova/transformers
 * Uses all-MiniLM-L6-v2 for fast, free, 384-dimensional embeddings
 */

let pipeline = null;
let loading = false;

async function getEmbedder() {
    if (pipeline) return pipeline;
    if (loading) {
        // Wait for the model to finish loading
        while (loading) {
            await new Promise(r => setTimeout(r, 100));
        }
        return pipeline;
    }

    loading = true;
    console.log('[Embeddings] Loading all-MiniLM-L6-v2 model...');

    try {
        const { pipeline: createPipeline } = await import('@xenova/transformers');
        pipeline = await createPipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
            quantized: true,
        });
        console.log('[Embeddings] Model loaded successfully');
    } catch (err) {
        console.error('[Embeddings] Failed to load model:', err.message);
        console.warn('[Embeddings] Falling back to random embeddings for demo');
        pipeline = {
            __fallback: true,
            call: async (text) => ({
                data: new Float32Array(384).map(() => Math.random() - 0.5),
            }),
        };
    }

    loading = false;
    return pipeline;
}

/**
 * Generate embedding for a single text
 * @param {string} text
 * @returns {Promise<number[]>} 384-dimensional vector
 */
export async function embedText(text) {
    const embedder = await getEmbedder();

    if (embedder.__fallback) {
        const result = await embedder.call(text);
        return Array.from(result.data);
    }

    const output = await embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

/**
 * Batch embed multiple texts
 * @param {string[]} texts
 * @returns {Promise<number[][]>} Array of 384-dimensional vectors
 */
export async function embedBatch(texts) {
    const results = [];
    for (const text of texts) {
        results.push(await embedText(text));
    }
    return results;
}
