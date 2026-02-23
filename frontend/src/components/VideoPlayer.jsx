import { useRef, useCallback, useEffect } from 'react';
import ReactPlayer from 'react-player';
import './VideoPlayer.css';

export default function VideoPlayer({
    videoUrl,
    onClickstreamEvent,
    isPlaying,
    setIsPlaying,
    playbackRate = 1,
}) {
    const playerRef = useRef(null);
    const lastTimeRef = useRef(0);
    const eventBuffer = useRef([]);

    const emitEvent = useCallback((type, data = {}) => {
        const event = {
            type,
            timestamp: Date.now(),
            videoTime: playerRef.current?.getCurrentTime() || 0,
            ...data,
        };
        eventBuffer.current.push(event);
        onClickstreamEvent?.(event);
    }, [onClickstreamEvent]);

    const handlePlay = useCallback(() => {
        setIsPlaying?.(true);
        emitEvent('play');
    }, [emitEvent, setIsPlaying]);

    const handlePause = useCallback(() => {
        setIsPlaying?.(false);
        emitEvent('pause');
    }, [emitEvent, setIsPlaying]);

    const handleProgress = useCallback(({ playedSeconds }) => {
        const delta = playedSeconds - lastTimeRef.current;

        // Detect rewinds (backward seeks)
        if (delta < -2) {
            emitEvent('rewind', {
                from: lastTimeRef.current,
                to: playedSeconds,
                seekDistance: Math.abs(delta),
            });
        }
        // Detect forward skips
        else if (delta > 5) {
            emitEvent('skip_forward', {
                from: lastTimeRef.current,
                to: playedSeconds,
                seekDistance: delta,
            });
        }

        lastTimeRef.current = playedSeconds;
    }, [emitEvent]);

    const handlePlaybackRateChange = useCallback((rate) => {
        emitEvent('speed_change', { newRate: rate, oldRate: playbackRate });
    }, [emitEvent, playbackRate]);

    const handleEnded = useCallback(() => {
        emitEvent('video_ended');
        setIsPlaying?.(false);
    }, [emitEvent, setIsPlaying]);

    // Periodic heartbeat for engagement tracking
    useEffect(() => {
        const interval = setInterval(() => {
            if (isPlaying && playerRef.current) {
                emitEvent('heartbeat', {
                    currentTime: playerRef.current.getCurrentTime(),
                    duration: playerRef.current.getDuration(),
                });
            }
        }, 10000);
        return () => clearInterval(interval);
    }, [isPlaying, emitEvent]);

    if (!videoUrl) {
        return (
            <div className="player-empty">
                <div className="player-empty-icon">▶</div>
                <p>Select a video to start learning</p>
            </div>
        );
    }

    return (
        <div className="player-wrapper">
            <div className="player-container">
                <ReactPlayer
                    ref={playerRef}
                    url={videoUrl}
                    playing={isPlaying}
                    playbackRate={playbackRate}
                    controls
                    width="100%"
                    height="100%"
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onProgress={handleProgress}
                    onEnded={handleEnded}
                    config={{
                        youtube: {
                            playerVars: {
                                modestbranding: 1,
                                rel: 0,
                                iv_load_policy: 3,
                            },
                        },
                    }}
                />
            </div>
        </div>
    );
}
