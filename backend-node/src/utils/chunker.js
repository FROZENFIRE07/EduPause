/**
 * Sliding-window transcript chunker
 * Splits transcript text into overlapping chunks for LLM processing
 */

/**
 * Split text into words and group into chunks
 * @param {string} text - Full transcript text
 * @param {object} options
 * @param {number} options.chunkSize - Approximate number of words per chunk
 * @param {number} options.overlap - Number of words to overlap between chunks
 * @returns {string[]} Array of text chunks
 */
export function chunkTranscript(text, { chunkSize = 512, overlap = 50 } = {}) {
    if (!text || text.trim().length === 0) return [];

    const words = text.split(/\s+/).filter(w => w.length > 0);

    if (words.length <= chunkSize) {
        return [words.join(' ')];
    }

    const chunks = [];
    let start = 0;

    while (start < words.length) {
        const end = Math.min(start + chunkSize, words.length);
        const chunk = words.slice(start, end).join(' ');
        chunks.push(chunk);

        if (end >= words.length) break;

        // Move forward by (chunkSize - overlap) words
        start += chunkSize - overlap;
    }

    return chunks;
}

/**
 * Chunk with timestamp awareness (if timestamps are embedded)
 * Format: "[00:01:23] text text text"
 */
export function chunkWithTimestamps(segments, { chunkSize = 512 } = {}) {
    const chunks = [];
    let currentChunk = [];
    let currentLength = 0;
    let startTime = null;

    for (const seg of segments) {
        const words = seg.text.split(/\s+/).length;

        if (currentLength + words > chunkSize && currentChunk.length > 0) {
            chunks.push({
                text: currentChunk.map(s => s.text).join(' '),
                startTime,
                endTime: currentChunk[currentChunk.length - 1].start,
            });
            currentChunk = [];
            currentLength = 0;
            startTime = null;
        }

        if (startTime === null) startTime = seg.start;
        currentChunk.push(seg);
        currentLength += words;
    }

    if (currentChunk.length > 0) {
        chunks.push({
            text: currentChunk.map(s => s.text).join(' '),
            startTime,
            endTime: currentChunk[currentChunk.length - 1].start,
        });
    }

    return chunks;
}
