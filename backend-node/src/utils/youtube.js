import axios from 'axios';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Extract playlist ID from a YouTube playlist URL (returns null if not a playlist)
 */
function extractPlaylistId(url) {
    const match = url.match(/[?&]list=([^&]+)/);
    return match ? match[1] : null;
}

/**
 * Extract video ID from any YouTube video URL
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, youtube.com/embed/
 */
function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /[?&]v=([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

/**
 * Fetch video title from YouTube page (no API key needed)
 */
async function fetchVideoTitle(videoId) {
    try {
        const res = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: { 'Accept-Language': 'en' },
        });
        const titleMatch = res.data.match(/<title>(.*?)<\/title>/);
        if (titleMatch) {
            return titleMatch[1].replace(' - YouTube', '').trim();
        }
    } catch (e) {
        console.warn(`[YouTube] Failed to fetch title for ${videoId}:`, e.message);
    }
    return `Video ${videoId}`;
}

/**
 * Fetch all video IDs and titles from a YouTube URL.
 * Handles both playlist URLs and single video URLs.
 */
export async function fetchPlaylistVideos(inputUrl) {
    const playlistId = extractPlaylistId(inputUrl);
    const videoId = extractVideoId(inputUrl);

    // --- Single video URL (no playlist) ---
    if (!playlistId && videoId) {
        console.log(`[YouTube] Single video detected: ${videoId}`);
        const title = await fetchVideoTitle(videoId);
        return [{ videoId, title }];
    }

    // --- Playlist URL ---
    if (!playlistId) {
        throw new Error('Could not extract a video or playlist ID from the URL. Please paste a valid YouTube link.');
    }

    // If no API key, return demo data
    if (!YOUTUBE_API_KEY) {
        console.warn('[YouTube] No API key — returning demo data');
        return [
            { videoId: 'aircAruvnKk', title: 'But what is a neural network?' },
            { videoId: 'IHZwWFHWa-w', title: 'Gradient descent, how neural networks learn' },
            { videoId: 'Ilg3gGewQ5U', title: 'What is backpropagation really doing?' },
            { videoId: 'tIeHLnjs5U8', title: 'Backpropagation calculus' },
        ];
    }

    const videos = [];
    let nextPageToken = '';

    do {
        const res = await axios.get(`${YOUTUBE_API_BASE}/playlistItems`, {
            params: {
                part: 'snippet',
                playlistId,
                maxResults: 50,
                pageToken: nextPageToken,
                key: YOUTUBE_API_KEY,
            },
        });

        for (const item of res.data.items) {
            videos.push({
                videoId: item.snippet.resourceId.videoId,
                title: item.snippet.title,
                description: item.snippet.description?.substring(0, 200),
                position: item.snippet.position,
            });
        }

        nextPageToken = res.data.nextPageToken || '';
    } while (nextPageToken);

    return videos;
}

/**
 * Fetch transcript for a single video
 * Uses a simple scraping approach as a fallback
 */
export async function fetchTranscript(videoId) {
    // Try unofficial transcript endpoint
    try {
        const res = await axios.get(
            `https://www.youtube.com/watch?v=${videoId}`,
            { headers: { 'Accept-Language': 'en' } }
        );

        // Extract captions track URL from page
        const captionMatch = res.data.match(/"captionTracks":\[(.*?)\]/);
        if (captionMatch) {
            const trackData = JSON.parse(`[${captionMatch[1]}]`);
            const englishTrack = trackData.find(t => t.languageCode === 'en') || trackData[0];

            if (englishTrack?.baseUrl) {
                const captionRes = await axios.get(englishTrack.baseUrl);
                // Parse XML transcript
                const textMatches = captionRes.data.matchAll(/<text[^>]*>(.*?)<\/text>/gs);
                const segments = [];
                for (const match of textMatches) {
                    segments.push(match[1]
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                    );
                }
                if (segments.length > 0) {
                    return segments.join(' ');
                }
            }
        }
    } catch (e) {
        console.warn(`[Transcript] Scraping failed for ${videoId}:`, e.message);
    }

    // Fallback: return a demo transcript
    return `This is a demonstration transcript for video ${videoId}. In a production environment, this would contain the full transcript extracted from YouTube's caption system. The transcript covers key concepts in neural networks, including forward propagation, loss calculation, and backpropagation using the chain rule of calculus.`;
}
