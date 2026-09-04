/**
 * TranscriptViewer — Timestamped transcript synced to video playback
 * Shows transcript segments, highlights the active one, auto-scrolls,
 * and allows click-to-seek.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { FiSearch, FiClock, FiX } from 'react-icons/fi';
import { getTranscript } from '../api';
import './TranscriptViewer.css';

export default function TranscriptViewer({ videoId, currentTime, onSeek }) {
    const [segments, setSegments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const activeRef = useRef(null);
    const containerRef = useRef(null);
    const lastScrolledIdx = useRef(-1);

    // Fetch transcript when videoId changes
    useEffect(() => {
        if (!videoId) return;
        let cancelled = false;

        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await getTranscript(videoId);
                if (!cancelled) {
                    setSegments(res.data.segments || []);
                }
            } catch (err) {
                if (!cancelled) {
                    console.warn('[Transcript] Fetch failed:', err.message);
                    setError('Transcript not available for this video');
                    setSegments([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [videoId]);

    // Find active segment index based on currentTime
    const activeIdx = useMemo(() => {
        if (!segments.length || currentTime == null) return -1;
        for (let i = segments.length - 1; i >= 0; i--) {
            if (segments[i].startSec <= currentTime) return i;
        }
        return 0;
    }, [segments, currentTime]);

    // Auto-scroll to active segment
    useEffect(() => {
        if (activeIdx >= 0 && activeIdx !== lastScrolledIdx.current && activeRef.current) {
            activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            lastScrolledIdx.current = activeIdx;
        }
    }, [activeIdx]);

    // Filter segments by search
    const filteredSegments = useMemo(() => {
        if (!searchQuery.trim()) return segments;
        const q = searchQuery.toLowerCase();
        return segments.filter(s => s.text?.toLowerCase().includes(q));
    }, [segments, searchQuery]);

    // Format seconds → "M:SS"
    const formatTime = (sec) => {
        if (sec == null) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="transcript-viewer loading">
                <div className="transcript-loader">
                    <div className="transcript-spinner" />
                    <p>Loading transcript...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="transcript-viewer empty">
                <div className="transcript-empty-icon">📄</div>
                <p>{error}</p>
                <p className="transcript-empty-hint">
                    Transcripts are generated during playlist ingestion.
                </p>
            </div>
        );
    }

    if (!segments.length) {
        return (
            <div className="transcript-viewer empty">
                <div className="transcript-empty-icon">📝</div>
                <p>No transcript segments found</p>
            </div>
        );
    }

    const highlightMatch = (text, query) => {
        if (!query.trim()) return text;
        const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
        return parts.map((part, i) =>
            part.toLowerCase() === query.toLowerCase()
                ? <mark key={i} className="transcript-highlight">{part}</mark>
                : part
        );
    };

    return (
        <div className="transcript-viewer">
            {/* Search bar */}
            <div className="transcript-search">
                <FiSearch size={14} className="transcript-search-icon" />
                <input
                    className="transcript-search-input"
                    placeholder="Search transcript..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button className="transcript-search-clear" onClick={() => setSearchQuery('')}>
                        <FiX size={12} />
                    </button>
                )}
                {searchQuery && (
                    <span className="transcript-search-count">
                        {filteredSegments.length} result{filteredSegments.length !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {/* Segments list */}
            <div className="transcript-segments" ref={containerRef}>
                {filteredSegments.map((seg, i) => {
                    const originalIdx = segments.indexOf(seg);
                    const isActive = originalIdx === activeIdx && !searchQuery;
                    return (
                        <button
                            key={i}
                            ref={isActive ? activeRef : null}
                            className={`transcript-segment ${isActive ? 'active' : ''}`}
                            onClick={() => onSeek?.(seg.startSec)}
                            title={`Jump to ${formatTime(seg.startSec)}`}
                        >
                            <span className="transcript-time">
                                <FiClock size={10} />
                                {formatTime(seg.startSec)}
                            </span>
                            <span className="transcript-text">
                                {highlightMatch(seg.text || '', searchQuery)}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
