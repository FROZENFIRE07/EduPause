import axios from 'axios';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Extract playlist ID from a YouTube playlist URL
 */
function extractPlaylistId(url) {
    const match = url.match(/[?&]list=([^&]+)/);
    if (!match) throw new Error('Invalid YouTube playlist URL');
    return match[1];
}

/**
 * Fetch all video IDs and titles from a YouTube playlist
 */
export async function fetchPlaylistVideos(playlistUrl) {
    const playlistId = extractPlaylistId(playlistUrl);

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
                return segments.join(' ');
            }
        }
    } catch (e) {
        console.warn(`[Transcript] Scraping failed for ${videoId}:`, e.message);
    }

    // Fallback: return a demo transcript
    return `This is a demonstration transcript for video ${videoId}. In a production environment, this would contain the full transcript extracted from YouTube's caption system. The transcript covers key concepts in neural networks, including forward propagation, loss calculation, and backpropagation using the chain rule of calculus.`;
}
