/**
 * yt-dlp based transcript extraction service
 *
 * Uses the yt-dlp CLI to download YouTube subtitles (manual → auto-generated),
 * parses VTT into timestamped segments, and cleans up temp files.
 *
 * Requires: yt-dlp installed on the system PATH.
 */

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { log } from './logger.js';

const TEMP_DIR = path.resolve('temp_subs');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Run a shell command and return { stdout, stderr }.
 * Rejects with a structured error on non-zero exit.
 */
function run(cmd, timeoutMs = 60_000) {
    return new Promise((resolve, reject) => {
        exec(cmd, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) {
                reject(Object.assign(err, { stdout, stderr }));
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

/**
 * Parse a VTT timestamp "HH:MM:SS.mmm" → total seconds (float).
 */
function vttTimeToSeconds(ts) {
    const parts = ts.split(':');
    if (parts.length === 3) {
        const [h, m, s] = parts;
        return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
    }
    if (parts.length === 2) {
        const [m, s] = parts;
        return parseInt(m) * 60 + parseFloat(s);
    }
    return parseFloat(ts) || 0;
}

/**
 * Format total seconds → "HH:MM:SS" (no millis, clean for UI).
 */
function formatTime(totalSec) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = Math.floor(totalSec % 60);
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

// ─── VTT Parser ─────────────────────────────────────────────────────────────

/**
 * Parse raw VTT content into an array of { start, end, startSec, endSec, text }.
 *
 * Handles:
 * - Standard WebVTT cue blocks  (timestamp line + one or more text lines)
 * - Inline tags like <c>, <b>, <i>  (stripped)
 * - Duplicate/overlapping cues    (deduplicated)
 */
function parseVtt(raw) {
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    const cues = [];
    const seen = new Set();

    // Regex for a VTT timestamp line:  00:01:23.456 --> 00:01:30.789  (optional position info)
    const tsRegex = /^(\d{1,2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}\.\d{3})/;

    let i = 0;
    while (i < lines.length) {
        const match = lines[i].match(tsRegex);
        if (!match) { i++; continue; }

        const rawStart = match[1];
        const rawEnd = match[2];
        i++;

        // Collect all text lines until the next blank line or timestamp
        const textLines = [];
        while (i < lines.length && lines[i].trim() !== '' && !tsRegex.test(lines[i])) {
            textLines.push(lines[i]);
            i++;
        }

        // Clean text: strip VTT tags <c>, <b>, <i>, etc., and collapse whitespace
        let text = textLines.join(' ')
            .replace(/<[^>]+>/g, '')       // remove tags
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();

        if (!text) continue;

        // Deduplicate identical text in overlapping cues (common in auto-subs)
        const key = `${rawStart}|${text}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const startSec = vttTimeToSeconds(rawStart);
        const endSec = vttTimeToSeconds(rawEnd);

        cues.push({
            start: formatTime(startSec),
            end: formatTime(endSec),
            startSec,
            endSec,
            text,
        });
    }

    return cues;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Fetch a YouTube video's transcript via yt-dlp.
 *
 * @param {string} videoUrl   Full YouTube URL *or* bare video ID (11 chars).
 * @returns {Promise<{ segments: Array<{start,end,startSec,endSec,text}>, plainText: string }>}
 *          `segments` — timestamped cue list, `plainText` — concatenated text for LLM use.
 * @throws  Structured error `{ code, message }` on failure.
 */
export async function fetchTranscriptYtDlp(videoUrl) {
    // Normalise bare video IDs to full URLs
    if (/^[a-zA-Z0-9_-]{11}$/.test(videoUrl)) {
        videoUrl = `https://www.youtube.com/watch?v=${videoUrl}`;
    }

    // Extract video ID for logging / file-matching
    const idMatch = videoUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    const videoId = idMatch ? idMatch[1] : 'unknown';

    // Ensure temp directory exists
    await fs.mkdir(TEMP_DIR, { recursive: true });

    // ── Step 1: Run yt-dlp ──────────────────────────────────────────────────
    const cmd = [
        'yt-dlp',
        '--write-sub',              // prefer manual subtitles
        '--write-auto-sub',         // fall back to auto-generated
        '--sub-lang en',            // English only
        '--sub-format vtt',         // WebVTT output
        '--skip-download',          // don't download the video itself
        '--no-playlist',            // single video only
        '--no-warnings',            // cleaner stderr
        `-o "${path.join(TEMP_DIR, '%(id)s.%(ext)s')}"`,
        `"${videoUrl}"`,
    ].join(' ');

    log('🔧', 'YT-DLP', `${videoId}: Running yt-dlp for subtitles...`);

    try {
        const { stdout, stderr } = await run(cmd, 90_000);

        // yt-dlp prints useful info to stdout
        if (stderr && stderr.includes('ERROR')) {
            throw new Error(stderr.trim());
        }

        log('✅', 'YT-DLP', `${videoId}: yt-dlp finished`);
    } catch (execErr) {
        const msg = (execErr.stderr || execErr.message || '').substring(0, 200);
        log('⚠️', 'YT-DLP', `${videoId}: yt-dlp failed — ${msg}`);
        throw {
            code: 'YTDLP_EXEC_FAILED',
            message: `yt-dlp execution failed: ${msg}`,
        };
    }

    // ── Step 2: Locate the .vtt file ────────────────────────────────────────
    let vttPath = null;
    try {
        const files = await fs.readdir(TEMP_DIR);
        // yt-dlp names files like:  <id>.en.vtt  or  <id>.en-orig.vtt
        const vttFile = files.find(f => f.startsWith(videoId) && f.endsWith('.vtt'));
        if (!vttFile) {
            // Sometimes yt-dlp uses a slightly different naming — try any .vtt
            const anyVtt = files.find(f => f.endsWith('.vtt'));
            if (anyVtt) {
                vttPath = path.join(TEMP_DIR, anyVtt);
            }
        } else {
            vttPath = path.join(TEMP_DIR, vttFile);
        }
    } catch (_) { /* readdir might fail if dir was removed */ }

    if (!vttPath) {
        log('⚠️', 'YT-DLP', `${videoId}: No .vtt file found — subtitles may not exist for this video`);
        throw {
            code: 'YTDLP_NO_SUBS',
            message: 'yt-dlp ran successfully but no subtitle file was produced. The video may not have English subtitles.',
        };
    }

    log('📄', 'YT-DLP', `${videoId}: Found subtitle file → ${path.basename(vttPath)}`);

    // ── Step 3: Read & parse the VTT ────────────────────────────────────────
    let rawVtt;
    try {
        rawVtt = await fs.readFile(vttPath, 'utf-8');
    } catch (readErr) {
        throw {
            code: 'YTDLP_READ_FAILED',
            message: `Could not read VTT file: ${readErr.message}`,
        };
    }

    const segments = parseVtt(rawVtt);

    // ── Step 4: Cleanup temp file ───────────────────────────────────────────
    try {
        // Remove all files for this video ID (there might be .json metadata too)
        const files = await fs.readdir(TEMP_DIR);
        for (const f of files) {
            if (f.startsWith(videoId)) {
                await fs.unlink(path.join(TEMP_DIR, f));
            }
        }
    } catch (_) { /* best-effort cleanup */ }

    if (segments.length === 0) {
        log('⚠️', 'YT-DLP', `${videoId}: VTT parsed but 0 cues found (${rawVtt.length} raw bytes)`);
        throw {
            code: 'YTDLP_EMPTY_PARSE',
            message: 'Subtitle file was downloaded but contained no parseable cues.',
        };
    }

    // Build a flat plaintext version for LLM summarization / chunking
    const plainText = segments.map(s => s.text).join(' ');

    log('✅', 'YT-DLP', `${videoId}: ${segments.length} cues, ${plainText.length} chars extracted`);

    return { segments, plainText };
}
