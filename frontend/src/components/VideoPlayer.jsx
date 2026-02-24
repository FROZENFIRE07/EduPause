import { useRef, useEffect, useCallback, useState } from 'react';
import { FiVolume2, FiVolumeX } from 'react-icons/fi';
import './VideoPlayer.css';

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// ─── Load YouTube IFrame API once ──────────────────────────────────────────
let ytApiReady = false;
const ytReadyCallbacks = [];

function loadYouTubeAPI() {
    if (ytApiReady) return Promise.resolve();
    if (window.YT && window.YT.Player) { ytApiReady = true; return Promise.resolve(); }
    return new Promise((resolve) => {
        ytReadyCallbacks.push(resolve);
        if (document.querySelector('script[src*="youtube.com/iframe_api"]')) return;
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
        window.onYouTubeIframeAPIReady = () => {
            ytApiReady = true;
            ytReadyCallbacks.forEach(cb => cb());
            ytReadyCallbacks.length = 0;
        };
    });
}

// ─── Extract YouTube video ID from URL ─────────────────────────────────────
function extractVideoId(url) {
    if (!url) return null;
    const m = url.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/)([\w-]{11})/);
    return m ? m[1] : url; // fallback: treat as raw ID
}

export default function VideoPlayer({
    videoUrl,
    isPlaying,
    setIsPlaying,
    onClickstreamEvent,
    onEnded,
    onProgress,
}) {
    const containerRef = useRef(null);
    const playerDivRef = useRef(null);
    const ytPlayerRef = useRef(null);
    const lastProgressRef = useRef(0);
    const heartbeatRef = useRef(null);
    const progressIntervalRef = useRef(null);
    const [muted, setMuted] = useState(false);
    const [volume, setVolume] = useState(0.8);
    const [speed, setSpeed] = useState(1);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [showShortcutHint, setShowShortcutHint] = useState('');
    const [playerReady, setPlayerReady] = useState(false);

    // Stable refs for callbacks
    const isPlayingRef = useRef(isPlaying);
    isPlayingRef.current = isPlaying;
    const onEndedRef = useRef(onEnded);
    onEndedRef.current = onEnded;
    const onProgressRef = useRef(onProgress);
    onProgressRef.current = onProgress;

    const emitEvent = useCallback((type, data = {}) => {
        const vt = ytPlayerRef.current?.getCurrentTime?.() || 0;
        onClickstreamEvent?.({
            type,
            timestamp: Date.now(),
            videoTime: vt,
            ...data,
        });
    }, [onClickstreamEvent]);

    const flashHint = useCallback((text) => {
        setShowShortcutHint(text);
        setTimeout(() => setShowShortcutHint(''), 1200);
    }, []);

    // Helper to get current time safely
    const getCurrentTime = useCallback(() => {
        try { return ytPlayerRef.current?.getCurrentTime?.() || 0; } catch { return 0; }
    }, []);

    // ─── Initialize YouTube player ────────────────────────────────────────
    useEffect(() => {
        const videoId = extractVideoId(videoUrl);
        if (!videoId) return;

        let destroyed = false;

        async function init() {
            await loadYouTubeAPI();
            if (destroyed) return;

            // Destroy previous player if exists
            if (ytPlayerRef.current) {
                try { ytPlayerRef.current.destroy(); } catch { }
                ytPlayerRef.current = null;
            }

            // Create a fresh div for the player
            if (playerDivRef.current) {
                playerDivRef.current.innerHTML = '';
            }
            const el = document.createElement('div');
            el.id = `yt-player-${Date.now()}`;
            playerDivRef.current?.appendChild(el);

            ytPlayerRef.current = new window.YT.Player(el.id, {
                videoId,
                width: '100%',
                height: '100%',
                playerVars: {
                    modestbranding: 1,
                    rel: 0,
                    autoplay: 0,
                    controls: 1,
                    fs: 0,
                    iv_load_policy: 3,
                    origin: window.location.origin,
                },
                events: {
                    onReady: () => {
                        if (destroyed) return;
                        setPlayerReady(true);
                        // Apply current volume & mute state
                        try {
                            ytPlayerRef.current.setVolume(volume * 100);
                            if (muted) ytPlayerRef.current.mute();
                        } catch { }
                    },
                    onStateChange: (event) => {
                        if (destroyed) return;
                        const state = event.data;
                        if (state === window.YT.PlayerState.PLAYING) {
                            setIsPlaying(true);
                            emitEvent('play');
                        } else if (state === window.YT.PlayerState.PAUSED) {
                            setIsPlaying(false);
                            emitEvent('pause');
                        } else if (state === window.YT.PlayerState.ENDED) {
                            emitEvent('ended');
                            if (onEndedRef.current) {
                                onEndedRef.current();
                            } else {
                                setIsPlaying(false);
                            }
                        }
                    },
                    onError: (event) => {
                        console.error('[VideoPlayer] YouTube error:', event.data);
                    },
                },
            });
        }

        init();

        return () => {
            destroyed = true;
            if (ytPlayerRef.current) {
                try { ytPlayerRef.current.destroy(); } catch { }
                ytPlayerRef.current = null;
            }
            setPlayerReady(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoUrl]);

    // ─── Sync play/pause state to player ──────────────────────────────────
    useEffect(() => {
        if (!playerReady || !ytPlayerRef.current) return;
        try {
            const state = ytPlayerRef.current.getPlayerState();
            if (isPlaying && state !== window.YT.PlayerState.PLAYING) {
                ytPlayerRef.current.playVideo();
            } else if (!isPlaying && state === window.YT.PlayerState.PLAYING) {
                ytPlayerRef.current.pauseVideo();
            }
        } catch { }
    }, [isPlaying, playerReady]);

    // ─── Sync volume & mute ───────────────────────────────────────────────
    useEffect(() => {
        if (!playerReady || !ytPlayerRef.current) return;
        try {
            ytPlayerRef.current.setVolume(volume * 100);
            if (muted) ytPlayerRef.current.mute();
            else ytPlayerRef.current.unMute();
        } catch { }
    }, [volume, muted, playerReady]);

    // ─── Sync speed ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!playerReady || !ytPlayerRef.current) return;
        try { ytPlayerRef.current.setPlaybackRate(speed); } catch { }
    }, [speed, playerReady]);

    // ─── Progress polling (seek detection + onProgress callback) ──────────
    useEffect(() => {
        progressIntervalRef.current = setInterval(() => {
            const t = getCurrentTime();
            if (t === 0) return;

            // Detect seek
            const diff = Math.abs(t - lastProgressRef.current);
            if (diff > 3) {
                emitEvent('seek', { from: lastProgressRef.current, to: t });
            }
            lastProgressRef.current = t;

            // Report progress to parent
            if (onProgressRef.current) {
                onProgressRef.current({ playedSeconds: t });
            }
        }, 500);

        return () => clearInterval(progressIntervalRef.current);
    }, [emitEvent, getCurrentTime]);

    // ─── Keyboard shortcuts (exactly like friend's design) ────────────────
    useEffect(() => {
        const handleKey = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    setIsPlaying(prev => !prev);
                    flashHint(isPlayingRef.current ? '⏸ Paused' : '▶ Playing');
                    emitEvent(isPlayingRef.current ? 'pause' : 'play');
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    if (ytPlayerRef.current) {
                        const t = getCurrentTime() - 5;
                        ytPlayerRef.current.seekTo(Math.max(0, t), true);
                        flashHint('⏪ -5s');
                        emitEvent('seek', { from: t + 5, to: t });
                    }
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    if (ytPlayerRef.current) {
                        const t = getCurrentTime() + 5;
                        ytPlayerRef.current.seekTo(t, true);
                        flashHint('⏩ +5s');
                        emitEvent('seek', { from: t - 5, to: t });
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setVolume(v => { const nv = Math.min(1, v + 0.1); flashHint(`🔊 ${Math.round(nv * 100)}%`); return nv; });
                    setMuted(false);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setVolume(v => { const nv = Math.max(0, v - 0.1); flashHint(`🔉 ${Math.round(nv * 100)}%`); return nv; });
                    break;
                case 'm':
                case 'M':
                    setMuted(prev => !prev);
                    flashHint(muted ? '🔊 Unmuted' : '🔇 Muted');
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [setIsPlaying, emitEvent, flashHint, muted, getCurrentTime]);

    // ─── Heartbeat ────────────────────────────────────────────────────────
    useEffect(() => {
        if (isPlaying) {
            heartbeatRef.current = setInterval(() => emitEvent('heartbeat'), 30000);
        } else {
            clearInterval(heartbeatRef.current);
        }
        return () => clearInterval(heartbeatRef.current);
    }, [isPlaying, emitEvent]);

    return (
        <div className="video-player-container" ref={containerRef}>
            <div className="video-wrapper">
                <div ref={playerDivRef} className="yt-player-mount" />
            </div>

            {/* Shortcut hint splash */}
            {showShortcutHint && (
                <div className="video-shortcut-hint animate-fade-in">
                    {showShortcutHint}
                </div>
            )}

            {/* Custom controls bar */}
            <div className="video-controls-bar">
                <button
                    className="video-ctrl-btn"
                    onClick={() => { setIsPlaying(prev => !prev); emitEvent(isPlaying ? 'pause' : 'play'); }}
                >
                    {isPlaying ? '⏸' : '▶'}
                </button>

                <button className="video-ctrl-btn" onClick={() => setMuted(!muted)}>
                    {muted ? <FiVolumeX size={16} /> : <FiVolume2 size={16} />}
                </button>

                <input
                    type="range"
                    className="video-volume-slider"
                    min={0}
                    max={1}
                    step={0.05}
                    value={muted ? 0 : volume}
                    onChange={e => { setVolume(Number(e.target.value)); setMuted(false); }}
                />

                <div style={{ flex: 1 }} />

                {/* Speed selector */}
                <div className="video-speed-wrapper">
                    <button
                        className="video-ctrl-btn video-speed-btn"
                        onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    >
                        {speed}x
                    </button>
                    {showSpeedMenu && (
                        <div className="video-speed-menu">
                            {SPEED_OPTIONS.map(s => (
                                <button
                                    key={s}
                                    className={`video-speed-opt ${s === speed ? 'active' : ''}`}
                                    onClick={() => { setSpeed(s); setShowSpeedMenu(false); flashHint(`🏃 ${s}x`); }}
                                >
                                    {s}x
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
