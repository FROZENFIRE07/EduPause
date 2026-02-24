import axios from 'axios';
import { log } from './logger.js';
import { fetchTranscriptYtDlp } from './ytdlpTranscript.js';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// ─── API Key Pool ──────────────────────────────────────────────────────────

function loadApiKeys() {
    const keys = [];
    for (let i = 1; i <= 20; i++) {
        const key = process.env[`YOUTUBE_API_KEY${i}`];
        if (key) keys.push(key);
    }
    if (process.env.YOUTUBE_API_KEY) {
        keys.push(process.env.YOUTUBE_API_KEY);
    }
    return keys;
}

const apiKeys = loadApiKeys();
let activeKeyIndex = 0;

function getApiKey() {
    if (apiKeys.length === 0) return null;
    return apiKeys[activeKeyIndex % apiKeys.length];
}

function rotateKey() {
    if (apiKeys.length <= 1) return false;
    const oldIndex = activeKeyIndex;
    activeKeyIndex = (activeKeyIndex + 1) % apiKeys.length;
    log('🔄', 'YOUTUBE', `Key ${oldIndex + 1} exhausted → rotating to key ${activeKeyIndex + 1}`);
    return true;
}

async function youtubeApiGet(endpoint, params) {
    const triedKeys = new Set();
    while (triedKeys.size < apiKeys.length) {
        const key = getApiKey();
        if (!key || triedKeys.has(key)) break;
        triedKeys.add(key);
        try {
            return await axios.get(`${YOUTUBE_API_BASE}/${endpoint}`, {
                params: { ...params, key },
                timeout: 10000,
            });
        } catch (e) {
            const status = e.response?.status;
            const reason = e.response?.data?.error?.errors?.[0]?.reason || '';
            if (status === 403 || status === 429 || reason === 'quotaExceeded') {
                log('⚠️', 'YOUTUBE', `Key ${activeKeyIndex + 1} quota issue (${status} ${reason})`);
                rotateKey();
                continue;
            }
            throw e;
        }
    }
    throw new Error('All YouTube API keys exhausted');
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function extractPlaylistId(url) {
    const match = url.match(/[?&]list=([^&]+)/);
    return match ? match[1] : null;
}

function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /[?&]v=([a-zA-Z0-9_-]{11})/,
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m) return m[1];
    }
    return null;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Playlist Fetching ─────────────────────────────────────────────────────

export async function fetchPlaylistVideos(inputUrl) {
    const playlistId = extractPlaylistId(inputUrl);
    const videoId = extractVideoId(inputUrl);

    if (!playlistId && videoId) {
        log('📹', 'YOUTUBE', `Single video detected: ${videoId}`);
        if (apiKeys.length > 0) {
            try {
                const res = await youtubeApiGet('videos', {
                    part: 'snippet,contentDetails',
                    id: videoId,
                });
                const item = res.data.items?.[0];
                if (item) {
                    return [{
                        videoId,
                        title: item.snippet.title,
                        duration: item.contentDetails?.duration || '',
                    }];
                }
            } catch (e) {
                log('⚠️', 'YOUTUBE', `API single video fetch failed: ${e.message}`);
            }
        }
        return [{ videoId, title: await fetchVideoTitle(videoId) }];
    }

    if (!playlistId) {
        throw new Error('Could not extract a video or playlist ID.');
    }

    if (apiKeys.length > 0) {
        try {
            const videos = [];
            let nextPageToken = '';
            do {
                const res = await youtubeApiGet('playlistItems', {
                    part: 'snippet,contentDetails',
                    playlistId,
                    maxResults: 50,
                    pageToken: nextPageToken,
                });
                for (const item of res.data.items) {
                    if (item.snippet.title === 'Deleted video' || item.snippet.title === 'Private video') continue;
                    videos.push({
                        videoId: item.snippet.resourceId.videoId,
                        title: item.snippet.title,
                        description: item.snippet.description?.substring(0, 200),
                        position: item.snippet.position,
                    });
                }
                nextPageToken = res.data.nextPageToken || '';
            } while (nextPageToken);

            log('✅', 'YOUTUBE', `Fetched ${videos.length} videos via API (key ${activeKeyIndex + 1})`);
            return videos;
        } catch (e) {
            log('⚠️', 'YOUTUBE', `API playlist fetch failed: ${e.message}`);
        }
    }

    // Fallback: scrape
    log('⚠️', 'YOUTUBE', 'API failed — scraping playlist page...');
    try {
        const res = await axios.get(`https://www.youtube.com/playlist?list=${playlistId}`, {
            headers: {
                'Accept-Language': 'en',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            timeout: 15000,
        });
        const videoMatches = [...res.data.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)];
        const titleMatches = [...res.data.matchAll(/"title":\{"runs":\[\{"text":"(.*?)"\}/g)];
        const seenIds = new Set();
        const videos = [];
        for (let i = 0; i < videoMatches.length; i++) {
            const vid = videoMatches[i][1];
            if (seenIds.has(vid)) continue;
            seenIds.add(vid);
            videos.push({ videoId: vid, title: titleMatches[i]?.[1] || `Video ${vid}` });
        }
        if (videos.length > 0) return videos;
    } catch (e) {
        log('⚠️', 'YOUTUBE', `Scrape failed: ${e.message}`);
    }

    throw new Error('Could not fetch playlist videos.');
}

// ─── Transcript Fetching ───────────────────────────────────────────────────

async function fetchVideoTitle(videoId) {
    try {
        const res = await axios.get(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`, { timeout: 5000 });
        if (res.data?.title) return res.data.title;
    } catch (_) { }
    return `Video ${videoId}`;
}

/**
 * Fetch transcript for a video.
 *
 * Strategy (ordered by reliability):
 *   0. yt-dlp CLI (most reliable — uses YouTube's own subtitle infra)
 *   1. Puppeteer (headless Chrome with stealth) — bypasses CAPTCHA/rate limits
 *   2. HTTP page scraping (lightweight, works when IP isn't blocked)
 *   3. Groq LLM fallback (generates educational content from title)
 */
export async function fetchTranscript(videoId, videoTitle) {
    // Strategy 0: yt-dlp (CLI — most reliable, bypasses anti-bot)
    try {
        const result = await fetchTranscriptYtDlp(videoId);
        if (result.plainText && result.plainText.length > 200) {
            log('✅', 'TRANSCRIPT', `${videoId}: yt-dlp transcript → ${result.plainText.length} chars, ${result.segments.length} cues`);
            // Stash segments on the module-level cache so downstream can access timestamps
            _lastSegments.set(videoId, result.segments);
            return result.plainText;
        }
    } catch (e) {
        const msg = e.message || (typeof e === 'object' ? JSON.stringify(e).substring(0, 120) : String(e));
        log('⚠️', 'TRANSCRIPT', `${videoId}: yt-dlp failed (${msg.substring(0, 100)})`);
    }

    // Strategy 1: Puppeteer (headless browser)
    try {
        const text = await fetchTranscriptViaBrowser(videoId);
        if (text && text.length > 200) {
            log('✅', 'TRANSCRIPT', `${videoId}: Browser transcript → ${text.length} chars`);
            return text;
        }
    } catch (e) {
        log('⚠️', 'TRANSCRIPT', `${videoId}: Browser failed (${e.message?.substring(0, 80)})`);
    }

    // Strategy 2: HTTP scraping (lightweight fallback)
    try {
        const text = await fetchTranscriptViaHttp(videoId);
        if (text && text.length > 200) {
            log('✅', 'TRANSCRIPT', `${videoId}: HTTP transcript → ${text.length} chars`);
            return text;
        }
    } catch (e) {
        const msg = e.response?.status ? `HTTP ${e.response.status}` : e.message?.substring(0, 80);
        log('⚠️', 'TRANSCRIPT', `${videoId}: HTTP scrape failed (${msg})`);
    }

    // Fallback: generate educational content via Groq
    const title = videoTitle || await fetchVideoTitle(videoId);
    log('🤖', 'TRANSCRIPT', `${videoId}: Generating AI transcript for "${title}"`);

    try {
        const { default: Groq } = await import('groq-sdk');
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{
                role: 'system',
                content: 'You are an expert educational content writer. Given a video title, generate a detailed transcript-style educational text (800-1200 words) covering the key concepts, explanations, and examples that such a video would typically contain. Write in a natural, conversational teaching style as if explaining to a student. Include technical details, analogies, and step-by-step explanations where appropriate.',
            }, {
                role: 'user',
                content: `Generate a detailed educational transcript for a video titled: "${title}"`,
            }],
            temperature: 0.7,
            max_tokens: 2000,
        });

        const generated = completion.choices[0]?.message?.content;
        if (generated && generated.length > 200) {
            log('✅', 'TRANSCRIPT', `${videoId}: AI-generated → ${generated.length} chars`);
            return generated;
        }
    } catch (groqErr) {
        log('⚠️', 'TRANSCRIPT', `${videoId}: Groq generation failed: ${groqErr.message}`);
    }

    // Last resort: short placeholder
    return `This video "${title}" covers educational content. Topics are inferred from the video title for downstream processing.`;
}

/**
 * Module-level cache for timestamped segments from the last yt-dlp extraction.
 * Other modules can call getTimestampedSegments(videoId) to retrieve them.
 */
const _lastSegments = new Map();

/**
 * Retrieve timestamped transcript segments for a video (if extracted via yt-dlp).
 * @returns {Array<{start, end, startSec, endSec, text}>|null}
 */
export function getTimestampedSegments(videoId) {
    return _lastSegments.get(videoId) || null;
}

/**
 * Puppeteer-based transcript extractor.
 * Uses headless Chrome with stealth plugin to bypass CAPTCHA/rate limits.
 * Launches browser, navigates to YouTube, extracts captions from page context.
 */
async function fetchTranscriptViaBrowser(videoId) {
    let browser;
    try {
        // Dynamic imports (these are CJS modules)
        const puppeteerExtra = await import('puppeteer-extra');
        const StealthPlugin = await import('puppeteer-extra-plugin-stealth');

        const puppeteer = puppeteerExtra.default || puppeteerExtra;
        const stealth = (StealthPlugin.default || StealthPlugin)();
        puppeteer.use(stealth);

        log('🌐', 'TRANSCRIPT', `${videoId}: Launching headless browser...`);

        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-features=IsolateOrigins,site-per-process',
                '--lang=en-US',
            ],
        });

        const page = await browser.newPage();

        // Set language preference
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

        // Navigate to YouTube watch page
        log('🔗', 'TRANSCRIPT', `${videoId}: Navigating to video page...`);
        await page.goto(`https://www.youtube.com/watch?v=${videoId}`, {
            waitUntil: 'domcontentloaded',
            timeout: 20000,
        });

        // Wait a moment for the player response to populate
        await page.waitForFunction(
            () => window.ytInitialPlayerResponse || document.querySelector('script:not([src])'),
            { timeout: 10000 }
        ).catch(() => { });

        // Extract captions from within the browser context
        const result = await page.evaluate(async () => {
            // Get player response (contains captionTracks)
            const playerResponse = window.ytInitialPlayerResponse;
            if (!playerResponse) {
                // Try extracting from page source
                const scripts = document.querySelectorAll('script:not([src])');
                for (const script of scripts) {
                    const match = script.textContent.match(/"captionTracks":(\[.*?\])/s);
                    if (match) {
                        try {
                            const tracks = JSON.parse(match[1].replace(/\\u0026/g, '&'));
                            const track = tracks.find(t => t.languageCode === 'en')
                                || tracks.find(t => t.languageCode?.startsWith('en'))
                                || tracks[0];
                            if (track?.baseUrl) {
                                const res = await fetch(track.baseUrl);
                                return { text: await res.text(), lang: track.languageCode };
                            }
                        } catch (e) { /* continue */ }
                    }
                }
                return { error: 'No player response found' };
            }

            const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            if (!tracks || tracks.length === 0) {
                return { error: 'No caption tracks available' };
            }

            const track = tracks.find(t => t.languageCode === 'en')
                || tracks.find(t => t.languageCode?.startsWith('en'))
                || tracks[0];

            if (!track?.baseUrl) {
                return { error: 'No baseUrl in track' };
            }

            // Fetch the captions from WITHIN the browser context (same origin = no issues)
            try {
                const res = await fetch(track.baseUrl);
                const text = await res.text();
                return { text, lang: track.languageCode, kind: track.kind };
            } catch (fetchErr) {
                return { error: `Caption fetch failed: ${fetchErr.message}` };
            }
        });

        if (result.error) {
            throw new Error(result.error);
        }

        if (!result.text || result.text.length < 50) {
            throw new Error(`Caption response too short: ${result.text?.length || 0} chars`);
        }

        log('🔗', 'TRANSCRIPT', `${videoId}: Browser got ${result.text.length} raw chars (${result.lang}, ${result.kind || 'manual'})`);

        // Parse the caption data
        const parsed = parseCaptionData(result.text);
        if (parsed && parsed.length > 100) {
            return parsed;
        }

        throw new Error(`Parsed to only ${parsed?.length || 0} chars`);

    } finally {
        if (browser) {
            await browser.close().catch(() => { });
        }
    }
}

/**
 * HTTP page scraping transcript extractor
 */
async function fetchTranscriptViaHttp(videoId) {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const consentCookie = 'CONSENT=YES+cb.20210328-17-p0.en+FX+907; SOCS=CAESEwgDEgk2ODE5MjEyNjQaAmVuIAEaBgiA_LyaBg';

    const res = await axios.get(watchUrl, {
        headers: {
            'Accept-Language': 'en',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Cookie': consentCookie,
        },
        timeout: 15000,
    });

    const captionMatch = res.data.match(/"captionTracks":(\[.*?\])/s);
    if (!captionMatch) throw new Error('No captionTracks in page');

    const rawJson = captionMatch[1].replace(/\\u0026/g, '&');
    const tracks = JSON.parse(rawJson);
    if (!tracks?.length) throw new Error('Empty captionTracks');

    const track = tracks.find(t => t.languageCode === 'en')
        || tracks.find(t => t.languageCode?.startsWith('en'))
        || tracks[0];

    if (!track?.baseUrl) throw new Error('No baseUrl');

    log('🔗', 'TRANSCRIPT', `${videoId}: Found captions (${track.languageCode}, ${track.kind || 'manual'})`);

    // ─── Try downloading caption text via multiple routes ───────────────
    // Route 1: Direct fetch (works when IP isn't blocked)
    // Route 2-4: Free proxy services (different IPs, bypass blocks)

    const directUrl = track.baseUrl;
    const proxyUrls = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`,
        `https://corsproxy.io/?url=${encodeURIComponent(directUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(directUrl)}`,
    ];

    const routes = [
        { label: 'direct', url: directUrl },
        { label: 'allorigins.win', url: proxyUrls[0] },
        { label: 'corsproxy.io', url: proxyUrls[1] },
        { label: 'codetabs.com', url: proxyUrls[2] },
    ];

    for (const route of routes) {
        try {
            const capRes = await axios.get(route.url, {
                timeout: 12000,
                responseType: 'text',
                headers: route.label === 'direct' ? {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Cookie': consentCookie,
                } : {},
            });

            const data = String(capRes.data || '');
            if (data.length < 50) {
                log('⚠️', 'TRANSCRIPT', `${videoId}: ${route.label} → ${data.length} chars (empty)`);
                continue;
            }
            log('🔍', 'TRANSCRIPT', `${videoId}: ${route.label} → ${data.length} raw chars`);

            // Parse caption text from the response
            const text = parseCaptionData(data);
            if (text && text.length > 500) {
                log('✅', 'TRANSCRIPT', `${videoId}: ${route.label} → ${text.length} chars ✔`);
                return text;
            }

            // Log what was returned for debugging
            if (text && text.length > 0) {
                log('⚠️', 'TRANSCRIPT', `${videoId}: ${route.label} → only ${text.length} chars (too short, need 500+): "${text.substring(0, 100)}..."`);
            } else {
                log('⚠️', 'TRANSCRIPT', `${videoId}: ${route.label} → no parseable caption text in ${data.length} chars of data`);
            }
        } catch (e) {
            const status = e.response?.status;
            log('⚠️', 'TRANSCRIPT', `${videoId}: ${route.label} → failed (${status || e.message?.substring(0, 60)})`);
        }
    }

    throw new Error('All caption download routes failed');
}

/**
 * Parse caption text from XML (srv1/srv2/srv3) or TTML responses
 */
function parseCaptionData(data) {
    const segments = [];

    // Format 1: <text start="..." dur="...">content</text> (srv1/srv2)
    for (const m of data.matchAll(/<text[^>]*>(.*?)<\/text>/gs)) {
        const t = m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n/g, ' ').trim();
        if (t) segments.push(t);
    }

    // Format 2: <s>content</s> (srv3)
    if (segments.length === 0) {
        for (const m of data.matchAll(/<s[^>]*>(.*?)<\/s>/gs)) {
            const t = m[1].replace(/&amp;/g, '&').replace(/\n/g, ' ').trim();
            if (t) segments.push(t);
        }
    }

    // Format 3: <p>content</p> (ttml)
    if (segments.length === 0) {
        for (const m of data.matchAll(/<p[^>]*>(.*?)<\/p>/gs)) {
            const t = m[1].replace(/<[^>]+>/g, '').replace(/\n/g, ' ').trim();
            if (t) segments.push(t);
        }
    }

    // Format 4: JSON3 events
    if (segments.length === 0) {
        try {
            const json = JSON.parse(data);
            for (const event of (json.events || [])) {
                if (event.segs) {
                    const text = event.segs.map(s => s.utf8 || '').join('').trim();
                    if (text && text !== '\n') segments.push(text);
                }
            }
        } catch (_) { }
    }

    return segments.join(' ').replace(/\s+/g, ' ').trim();
}



// Log key count on load
if (apiKeys.length > 0) {
    log('🔑', 'YOUTUBE', `${apiKeys.length} API key(s) loaded — rotation enabled`);
} else {
    log('⚠️', 'YOUTUBE', 'No API keys found — will use page scraping (rate limited)');
}
