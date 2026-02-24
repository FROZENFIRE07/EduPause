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
 * Chunk with timestamp awareness (segments from yt-dlp VTT parser).
 * Groups segments into ~chunkSize-word chunks, preserving time ranges.
 * @param {Array<{start, end, startSec, endSec, text}>} segments
 * @returns {Array<{text, startTime, endTime, startSec, endSec}>}
 */
export function chunkWithTimestamps(segments, { chunkSize = 512 } = {}) {
    if (!segments || segments.length === 0) return [];

    const chunks = [];
    let currentChunk = [];
    let currentLength = 0;
    let startTime = null;
    let startSec = null;

    for (const seg of segments) {
        const words = seg.text.split(/\s+/).length;

        if (currentLength + words > chunkSize && currentChunk.length > 0) {
            const lastSeg = currentChunk[currentChunk.length - 1];
            chunks.push({
                text: currentChunk.map(s => s.text).join(' '),
                startTime,
                endTime: lastSeg.end || lastSeg.start,
                startSec,
                endSec: lastSeg.endSec || lastSeg.startSec || 0,
            });
            currentChunk = [];
            currentLength = 0;
            startTime = null;
            startSec = null;
        }

        if (startTime === null) {
            startTime = seg.start;
            startSec = seg.startSec || 0;
        }
        currentChunk.push(seg);
        currentLength += words;
    }

    if (currentChunk.length > 0) {
        const lastSeg = currentChunk[currentChunk.length - 1];
        chunks.push({
            text: currentChunk.map(s => s.text).join(' '),
            startTime,
            endTime: lastSeg.end || lastSeg.start,
            startSec,
            endSec: lastSeg.endSec || lastSeg.startSec || 0,
        });
    }

    return chunks;
}
