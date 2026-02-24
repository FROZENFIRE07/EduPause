import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiList, FiBarChart2, FiEdit3, FiMaximize2, FiMinimize2, FiMessageCircle, FiX } from 'react-icons/fi';
import VideoPlayer from '../components/VideoPlayer';
import InterventionModal from '../components/InterventionModal';
import BreakRecovery from '../components/BreakRecovery';
import ProgressRing from '../components/ProgressRing';
import { useAppStore } from '../store';
import { createSession, sendClickstreamEvent, invokeAgent } from '../api';
import './LearningSession.css';



export default function LearningSession() {
    const { theaterMode, toggleTheaterMode, notes, setNote, currentPlaylist, savedPlaylists, loadPlaylist } = useAppStore();
    const playlist = currentPlaylist || [];

    const [activeVideoIdx, setActiveVideoIdx] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [clickstream, setClickstream] = useState([]);
    const [confusionScore, setConfusionScore] = useState(0);
    const [showIntervention, setShowIntervention] = useState(false);
    const [showBreakRecovery, setShowBreakRecovery] = useState(false);
    const [sidebarTab, setSidebarTab] = useState('playlist');
    const [showChat, setShowChat] = useState(false);

    const [showConfusionAlert, setShowConfusionAlert] = useState(false);
    const quizCooldownRef = useRef(false);

    // ─── Backend integration state ───
    const [sessionId, setSessionId] = useState(null);
    const [videoTime, setVideoTime] = useState(0);
    const [agentIntervention, setAgentIntervention] = useState(null);
    const [agentLoading, setAgentLoading] = useState(false);
    const clickstreamBufferRef = useRef([]);
    const observeTimerRef = useRef(null);
    const sessionInitRef = useRef(false);

    // Auto-quiz trigger: when confusion reaches 50%, show alert then quiz
    useEffect(() => {
        if (confusionScore >= 50 && !showIntervention && !showConfusionAlert && !quizCooldownRef.current) {
            quizCooldownRef.current = true;
            setShowConfusionAlert(true);
            setIsPlaying(false);

            // Show alert for 1.5s, then show the quiz
            const timer = setTimeout(() => {
                setShowConfusionAlert(false);
                setShowIntervention(true);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [confusionScore, showIntervention, showConfusionAlert]);

    // F key to toggle fullscreen/theater mode
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'f' || e.key === 'F') {
                const tag = document.activeElement?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') return;
                e.preventDefault();
                toggleTheaterMode();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [toggleTheaterMode]);
    const activeVideo = playlist[activeVideoIdx];
    const currentNote = notes[activeVideo?.videoId] || '';
    const currentConcept = activeVideo?.title?.replace(/^(But )?what is /i, '').replace(/\?$/i, '').trim() || '';

    // ─── Empty state if no playlist ───
    if (playlist.length === 0) {
        return (
            <div className="page learning-session" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div style={{ textAlign: 'center', maxWidth: 480 }}>
                    <div style={{ fontSize: '3rem', marginBottom: 16 }}>📺</div>
                    {savedPlaylists?.length > 0 ? (
                        <>
                            <h2 className="heading-lg" style={{ marginBottom: 8 }}>Pick a Playlist</h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: '0.9rem' }}>
                                Select a previously imported playlist to continue learning.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
                                {savedPlaylists.map(pl => (
                                    <button
                                        key={pl.id}
                                        onClick={() => loadPlaylist(pl.id)}
                                        className="glass-card-static"
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                                            border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer', background: 'var(--bg-card)', transition: 'all 0.2s',
                                            width: '100%', textAlign: 'left',
                                        }}
                                    >
                                        <span style={{ fontSize: '1.5rem' }}>📋</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{pl.title}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{pl.videos.length} videos · imported {new Date(pl.importedAt).toLocaleDateString()}</div>
                                        </div>
                                        <span style={{ color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: 600 }}>Load →</span>
                                    </button>
                                ))}
                            </div>
                            <p style={{ color: 'var(--text-muted)', marginTop: 16, fontSize: '0.8rem' }}>
                                or <Link to="/" style={{ color: 'var(--accent-primary)' }}>import a new playlist</Link>
                            </p>
                        </>
                    ) : (
                        <>
                            <h2 className="heading-lg" style={{ marginBottom: 8 }}>No playlist loaded</h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: '0.9rem' }}>
                                Import a YouTube playlist to start your learning session.
                            </p>
                            <Link to="/" className="btn btn-primary">Import a Playlist</Link>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // ─── Backend: create session on mount ───
    useEffect(() => {
        if (sessionInitRef.current) return;
        sessionInitRef.current = true;
        async function initSession() {
            try {
                const res = await createSession('anonymous', 'default');
                const sid = res.data.sessionId;
                setSessionId(sid);
                console.log('[LearningSession] Session created:', sid);
            } catch (err) {
                console.warn('[LearningSession] Session creation failed, using local:', err.message);
                setSessionId(`local-${Date.now()}`);
            }
        }
        initSession();
        return () => { if (observeTimerRef.current) clearInterval(observeTimerRef.current); };
    }, []);

    // ─── Backend: periodic clickstream observe (every 15s) ───
    useEffect(() => {
        if (!sessionId) return;
        observeTimerRef.current = setInterval(async () => {
            const buffer = clickstreamBufferRef.current;
            if (buffer.length === 0) return;
            const events = [...buffer];
            clickstreamBufferRef.current = [];
            try {
                const res = await invokeAgent(sessionId, 'observe', {
                    clickstream: events,
                    currentConcept,
                    videoId: activeVideo.videoId,
                    videoTime,
                });
                const result = res.data?.result || {};
                if (result.confusion_score != null) {
                    setConfusionScore(Math.round(result.confusion_score * 100));
                }
                if (result.intervention) {
                    setAgentIntervention(result.intervention);
                    setShowIntervention(true);
                    setIsPlaying(false);
                }
            } catch (err) {
                console.warn('[Observer] Agent call failed:', err.message);
            }
        }, 15000);
        return () => { if (observeTimerRef.current) clearInterval(observeTimerRef.current); };
    }, [sessionId, currentConcept, activeVideo, videoTime]);

    const videoProgress = useMemo(() => {
        const playEvents = clickstream.filter(e => e.type === 'heartbeat' || e.type === 'play');
        return Math.min(100, playEvents.length * 8);
    }, [clickstream]);

    const playlistProgress = useMemo(() => {
        return Math.round(((activeVideoIdx) / playlist.length) * 100);
    }, [activeVideoIdx]);

    const handleClickstreamEvent = useCallback((event) => {
        setClickstream(prev => [...prev, event]);
        clickstreamBufferRef.current.push(event);
        // Also persist to backend
        if (sessionId) {
            sendClickstreamEvent(sessionId, event).catch(() => { });
        }
        // Update videoTime from event
        if (event.videoTime != null) {
            setVideoTime(event.videoTime);
        }
        // Local confusion heuristic (instant feedback while waiting for agent)
        if (event.type === 'seek' || event.type === 'pause') {
            setConfusionScore(prev => {
                const delta = event.type === 'seek' ? 15 : 5;
                return Math.min(100, prev + delta);
            });
        } else {
            setConfusionScore(prev => Math.max(0, prev - 2));
        }
    }, [sessionId]);

    const handleVideoEnd = useCallback(() => {
        if (activeVideoIdx < playlist.length - 1) {
            setActiveVideoIdx(prev => prev + 1);
            setIsPlaying(true);
        } else {
            // Playlist ended — pop the quiz
            setIsPlaying(false);
            setShowIntervention(true);
        }
    }, [activeVideoIdx]);

    return (
        <div className={`page learning-session ${theaterMode ? 'theater' : ''}`}>
            {showBreakRecovery && (
                <BreakRecovery onContinue={() => setShowBreakRecovery(false)} />
            )}

            {/* Confusion Alert Banner */}
            {showConfusionAlert && (
                <div className="confusion-alert-overlay">
                    <div className="confusion-alert-banner animate-scale-in">
                        <span className="confusion-alert-icon">⚠️</span>
                        <div className="confusion-alert-text">
                            <h3>Looks like you're struggling</h3>
                            <p>Let's check your understanding with a quick quiz!</p>
                        </div>
                        <div className="confusion-alert-loader" />
                    </div>
                </div>
            )}

            <div className="session-layout container">
                {/* ===== MAIN ===== */}
                <div className="session-main">
                    <VideoPlayer
                        videoUrl={`https://www.youtube.com/watch?v=${activeVideo.videoId}`}
                        isPlaying={isPlaying}
                        setIsPlaying={setIsPlaying}
                        onClickstreamEvent={handleClickstreamEvent}
                        onEnded={handleVideoEnd}
                    />

                    {/* Video info bar */}
                    <div className="session-info-bar">
                        <div className="session-info-left">
                            <h2 className="heading-md session-video-title">{activeVideo.title}</h2>
                            <div className="session-meta">
                                <span className="session-meta-item">Video {activeVideoIdx + 1} of {playlist.length}</span>
                                <span className="session-meta-sep">·</span>
                                <span className="session-meta-item">{activeVideo.duration}</span>
                            </div>
                        </div>
                        <div className="session-info-right">
                            {/* Confusion meter */}
                            <div className={`confusion-meter ${confusionScore > 65 ? 'high' : confusionScore > 35 ? 'medium' : 'low'}`}>
                                <span className="confusion-label">Confusion</span>
                                <div className="confusion-bar">
                                    <div className="confusion-fill" style={{ width: `${confusionScore}%` }} />
                                </div>
                                <span className="confusion-value">{confusionScore}%</span>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={toggleTheaterMode} title={theaterMode ? 'Exit theater' : 'Theater mode'}>
                                {theaterMode ? <FiMinimize2 size={16} /> : <FiMaximize2 size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Playlist progress */}
                    <div className="session-progress-row">
                        <div className="progress-bar" style={{ flex: 1 }}>
                            <div className="progress-bar-fill" style={{ width: `${playlistProgress}%` }} />
                        </div>
                        <span className="session-progress-text">{playlistProgress}% complete</span>
                    </div>
                </div>

                {/* ===== SIDEBAR ===== */}
                <aside className={`session-sidebar ${theaterMode ? 'collapsed' : ''}`}>
                    {/* Tabs */}
                    <div className="tabs">
                        <button className={`tab ${sidebarTab === 'playlist' ? 'active' : ''}`} onClick={() => setSidebarTab('playlist')}>
                            <FiList size={14} />
                            Playlist
                        </button>
                        <button className={`tab ${sidebarTab === 'analytics' ? 'active' : ''}`} onClick={() => setSidebarTab('analytics')}>
                            <FiBarChart2 size={14} />
                            Analytics
                        </button>
                        <button className={`tab ${sidebarTab === 'notes' ? 'active' : ''}`} onClick={() => setSidebarTab('notes')}>
                            <FiEdit3 size={14} />
                            Notes
                        </button>
                    </div>

                    <div className="sidebar-content">
                        {/* Playlist tab */}
                        {sidebarTab === 'playlist' && (
                            <div className="sidebar-playlist">
                                {playlist.map((v, i) => (
                                    <button
                                        key={v.videoId}
                                        className={`sidebar-video ${i === activeVideoIdx ? 'active' : ''} ${i < activeVideoIdx ? 'done' : ''}`}
                                        onClick={() => { setActiveVideoIdx(i); setClickstream([]); setConfusionScore(0); }}
                                    >
                                        <span className="sidebar-video-idx">{i < activeVideoIdx ? '✓' : i + 1}</span>
                                        <div className="sidebar-video-info">
                                            <span className="sidebar-video-title">{v.title}</span>
                                            <span className="sidebar-video-dur">{v.duration}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Analytics tab */}
                        {sidebarTab === 'analytics' && (
                            <div className="sidebar-analytics">
                                <div className="sidebar-ring-center">
                                    <ProgressRing progress={videoProgress} size={100} glowEffect label="Video" />
                                </div>
                                <div className="sidebar-stat-grid">
                                    <div className="sidebar-stat">
                                        <span className="sidebar-stat-val">{clickstream.length}</span>
                                        <span className="sidebar-stat-lbl">Events</span>
                                    </div>
                                    <div className="sidebar-stat">
                                        <span className="sidebar-stat-val">{clickstream.filter(e => e.type === 'seek').length}</span>
                                        <span className="sidebar-stat-lbl">Seeks</span>
                                    </div>
                                    <div className="sidebar-stat">
                                        <span className="sidebar-stat-val">{clickstream.filter(e => e.type === 'pause').length}</span>
                                        <span className="sidebar-stat-lbl">Pauses</span>
                                    </div>
                                    <div className="sidebar-stat">
                                        <span className="sidebar-stat-val">{confusionScore}%</span>
                                        <span className="sidebar-stat-lbl">Confusion</span>
                                    </div>
                                </div>
                                <div className="sidebar-events-log">
                                    <h4 className="heading-sm" style={{ fontSize: '0.72rem', marginBottom: 8 }}>Recent Events</h4>
                                    {clickstream.slice(-8).reverse().map((e, i) => (
                                        <div key={i} className="sidebar-event">
                                            <span className={`sidebar-event-type ${e.type}`}>{e.type}</span>
                                            <span className="sidebar-event-time">{e.videoTime?.toFixed(1)}s</span>
                                        </div>
                                    ))}
                                    {clickstream.length === 0 && (
                                        <p className="sidebar-empty">Play the video to see events</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Notes tab */}
                        {sidebarTab === 'notes' && (
                            <div className="sidebar-notes">
                                <textarea
                                    className="sidebar-notes-input input"
                                    placeholder="Take notes while watching..."
                                    value={currentNote}
                                    onChange={e => setNote(activeVideo.videoId, e.target.value)}
                                />
                                <p className="sidebar-notes-hint">
                                    Notes auto-save to your browser
                                </p>
                            </div>
                        )}
                    </div>


                </aside>
            </div>

            {/* AI chat bubble */}
            <button className="chat-fab" onClick={() => setShowChat(!showChat)} title="AI Tutor">
                {showChat ? <FiX size={22} /> : <FiMessageCircle size={22} />}
            </button>
            {showChat && (
                <div className="chat-panel glass-card-static animate-scale-in">
                    <div className="chat-header">
                        <span className="heading-md">AI Tutor</span>
                        <span className="badge badge-primary">Beta</span>
                    </div>
                    <div className="chat-body">
                        <div className="chat-msg ai">
                            <p>👋 Hi! I can help explain concepts from the video. What are you struggling with?</p>
                        </div>
                    </div>
                    <div className="chat-input-row">
                        <input className="input" placeholder="Ask about the video..." />
                        <button className="btn btn-primary btn-sm">Send</button>
                    </div>
                </div>
            )}

            <InterventionModal
                isOpen={showIntervention}
                intervention={agentIntervention}
                onAnswer={async (answer) => {
                    // Send answer to agent evaluator if we have a session
                    if (sessionId && agentIntervention) {
                        try {
                            await invokeAgent(sessionId, 'evaluate', {
                                userAnswer: String(answer),
                                currentConcept,
                                context: { intervention: agentIntervention },
                                videoId: activeVideo.videoId,
                                videoTime,
                            });
                        } catch (err) {
                            console.warn('[Evaluator] Failed:', err.message);
                        }
                    }
                    setShowIntervention(false);
                    setAgentIntervention(null);
                    setIsPlaying(true);
                    setConfusionScore(Math.max(0, confusionScore - 30));
                    setTimeout(() => { quizCooldownRef.current = false; }, 5000);
                }}
                onSkip={() => {
                    setShowIntervention(false);
                    setAgentIntervention(null);
                    setIsPlaying(true);
                    setTimeout(() => { quizCooldownRef.current = false; }, 8000);
                }}
                onClose={() => {
                    setShowIntervention(false);
                    setAgentIntervention(null);
                    setIsPlaying(true);
                    setTimeout(() => { quizCooldownRef.current = false; }, 8000);
                }}
            />
        </div>
    );
}
