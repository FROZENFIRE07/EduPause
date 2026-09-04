import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    FiList, FiBarChart2, FiEdit3, FiMaximize2, FiMinimize2,
    FiMessageCircle, FiX, FiMap, FiFileText, FiAward, FiSend
} from 'react-icons/fi';
import VideoPlayer from '../components/VideoPlayer';
import InterventionModal from '../components/InterventionModal';
import WelcomeBackModal from '../components/WelcomeBackModal';
import ProgressRing from '../components/ProgressRing';
import CourseRoadmap from '../components/CourseRoadmap';
import TranscriptViewer from '../components/TranscriptViewer';
import QuizModal from '../components/QuizModal';
import SkillsDashboard from '../components/SkillsDashboard';
import { useAppStore } from '../store';
import {
    createSession, sendClickstreamEvent, invokeAgent,
    checkRecapNeeded, triggerQuiz, submitQuizAnswers,
    skipQuizSession, recordVideoWatch
} from '../api';
import './LearningSession.css';


export default function LearningSession() {
    const {
        theaterMode, toggleTheaterMode, notes, setNote,
        currentPlaylist, savedPlaylists, loadPlaylist, authUser,
        unlockAchievement, addQuizResult, chatMessages, addChatMessage, clearChatMessages,
    } = useAppStore();
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
    const [quizLoading, setQuizLoading] = useState(false);
    const quizCooldownRef = useRef(false);

    // ─── Backend integration state ───
    const [sessionId, setSessionId] = useState(null);
    const [videoTime, setVideoTime] = useState(0);
    const [agentIntervention, setAgentIntervention] = useState(null);
    const clickstreamBufferRef = useRef([]);
    const observeTimerRef = useRef(null);
    const sessionInitRef = useRef(false);
    const breakCheckRef = useRef(false);
    const userId = authUser?.email || authUser?.name || 'anonymous';
    const playlistId = 'default';
    const hasPlaylist = playlist.length > 0;

    // ─── Quiz state (checkpoint quiz modal) ───
    const [showQuizModal, setShowQuizModal] = useState(false);
    const [quizData, setQuizData] = useState(null);
    const [quizSessionId, setQuizSessionId] = useState(null);

    // ─── Chat state ───
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef(null);

    // ─── Achievement tracking ───
    const firstVideoRef = useRef(false);

    // Auto-quiz trigger: when confusion reaches 50%, call backend to generate quiz
    useEffect(() => {
        if (confusionScore >= 50 && !showIntervention && !showConfusionAlert && !quizCooldownRef.current && !showQuizModal) {
            quizCooldownRef.current = true;
            setShowConfusionAlert(true);
            setIsPlaying(false);
            setQuizLoading(true);

            (async () => {
                try {
                    const res = await invokeAgent(sessionId || `local-${Date.now()}`, 'tutor', {
                        currentConcept,
                        videoId: activeVideo?.videoId,
                        videoTime,
                    });
                    const intervention = res.data?.result?.intervention;
                    if (intervention) {
                        setAgentIntervention({
                            ...intervention,
                            correctIndex: intervention.correctIndex ?? intervention.correct_index ?? 0,
                        });
                    } else {
                        throw new Error('No intervention in response');
                    }
                } catch (err) {
                    console.warn('[Quiz] Backend generation failed, using fallback:', err.message);
                    setAgentIntervention({
                        type: 'mcq',
                        question: `Which of the following best describes the concept of "${currentConcept || 'this topic'}"?`,
                        options: [
                            'It structures and organizes information for pattern recognition',
                            'It converts analog signals to digital format',
                            'It compresses data for efficient storage',
                            'It encrypts data for secure transmission',
                        ],
                        correctIndex: 0,
                        hint: `Think about the core purpose of ${currentConcept || 'this concept'}.`,
                        context: `Quick check on: ${currentConcept || 'current topic'}`,
                    });
                } finally {
                    setQuizLoading(false);
                    setShowConfusionAlert(false);
                    setShowIntervention(true);
                }
            })();
        }
    }, [confusionScore, showIntervention, showConfusionAlert, showQuizModal]);

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

    // ─── Backend: create session on mount ───
    useEffect(() => {
        if (!hasPlaylist) return;
        if (sessionInitRef.current) return;
        sessionInitRef.current = true;
        clearChatMessages();
        async function initSession() {
            try {
                const res = await createSession(userId, playlistId);
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
    }, [userId, playlistId, hasPlaylist]);

    // Check if user needs a resume/recap flow after returning from a break.
    useEffect(() => {
        if (!hasPlaylist || !sessionId || breakCheckRef.current) return;
        breakCheckRef.current = true;
        (async () => {
            try {
                const res = await checkRecapNeeded(userId, playlistId);
                if (res.data?.shouldShow) {
                    setShowBreakRecovery(true);
                }
            } catch (err) {
                console.warn('[BreakRecovery] Check failed:', err.message);
            }
        })();
    }, [sessionId, userId, playlistId, hasPlaylist]);

    // ─── Backend: periodic clickstream observe (every 15s) ───
    useEffect(() => {
        if (!sessionId || !activeVideo) return;
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
                    setAgentIntervention({
                        ...result.intervention,
                        correctIndex: result.intervention.correctIndex ?? result.intervention.correct_index ?? 0,
                    });
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
        if (playlist.length === 0) return 0;
        return Math.round((activeVideoIdx / playlist.length) * 100);
    }, [activeVideoIdx, playlist.length]);

    const handleClickstreamEvent = useCallback((event) => {
        setClickstream(prev => [...prev, event]);
        clickstreamBufferRef.current.push(event);
        if (sessionId) {
            sendClickstreamEvent(sessionId, event).catch(() => { });
        }
        if (event.videoTime != null) {
            setVideoTime(event.videoTime);
        }
        // Local confusion heuristic
        if (event.type === 'seek' || event.type === 'pause') {
            setConfusionScore(prev => {
                const delta = event.type === 'seek' ? 15 : 5;
                return Math.min(100, prev + delta);
            });
        } else {
            setConfusionScore(prev => Math.max(0, prev - 2));
        }
        // Achievement: first video play
        if (event.type === 'play' && !firstVideoRef.current) {
            firstVideoRef.current = true;
            unlockAchievement('first_video');
        }
        // Achievement: speed demon
        if (event.type === 'speed_change' && event.speed >= 2) {
            unlockAchievement('speed_demon');
        }
    }, [sessionId, unlockAchievement]);

    // ─── Handle video end → checkpoint quiz trigger ───
    const handleVideoEnd = useCallback(() => {
        // Track video watch completion
        if (sessionId && activeVideo) {
            recordVideoWatch(userId, playlistId, activeVideo.videoId, videoTime, true).catch(() => { });
        }

        // Achievement: night owl
        if (new Date().getHours() >= 0 && new Date().getHours() < 5) {
            unlockAchievement('night_owl');
        }

        // Try to trigger checkpoint quiz
        (async () => {
            try {
                const res = await triggerQuiz(userId, playlistId, activeVideo?.videoId);
                if (res.data?.shouldTrigger && res.data?.quiz) {
                    setQuizData(res.data.quiz);
                    setQuizSessionId(res.data.quizSessionId || null);
                    setShowQuizModal(true);
                    setIsPlaying(false);
                    return; // Don't auto-advance while quiz is showing
                }
            } catch (err) {
                console.warn('[Quiz] Trigger failed:', err.message);
            }

            // No quiz — advance to next video or show final MCQ
            if (activeVideoIdx < playlist.length - 1) {
                setActiveVideoIdx(prev => prev + 1);
                setIsPlaying(true);
            } else {
                // Playlist ended — generate final intervention
                setIsPlaying(false);
                setShowConfusionAlert(true);
                setQuizLoading(true);
                try {
                    const res = await invokeAgent(sessionId || `local-${Date.now()}`, 'tutor', {
                        currentConcept,
                        videoId: activeVideo?.videoId,
                        videoTime,
                    });
                    const intervention = res.data?.result?.intervention;
                    if (intervention) {
                        setAgentIntervention({
                            ...intervention,
                            correctIndex: intervention.correctIndex ?? intervention.correct_index ?? 0,
                        });
                    } else {
                        throw new Error('No intervention');
                    }
                } catch {
                    setAgentIntervention({
                        type: 'mcq',
                        question: `Which of the following best describes the concept of "${currentConcept || 'this topic'}"?`,
                        options: [
                            'It structures and organizes information for pattern recognition',
                            'It converts analog signals to digital format',
                            'It compresses data for efficient storage',
                            'It encrypts data for secure transmission',
                        ],
                        correctIndex: 0,
                        hint: `Think about the core purpose of ${currentConcept || 'this concept'}.`,
                        context: `Playlist complete — final check on: ${currentConcept || 'current topic'}`,
                    });
                } finally {
                    setQuizLoading(false);
                    setShowConfusionAlert(false);
                    setShowIntervention(true);
                }
            }
        })();
    }, [activeVideoIdx, sessionId, currentConcept, activeVideo, videoTime, userId, playlistId, unlockAchievement]);

    // ─── Quiz submit handler ───
    const handleQuizSubmit = useCallback(async (qSessionId, responses) => {
        try {
            const res = await submitQuizAnswers(qSessionId, responses);
            const result = res.data;
            addQuizResult(result);
            // Achievement: first quiz
            unlockAchievement('first_quiz');
            if (result.passed) {
                unlockAchievement('mastery_1');
            }
            return result;
        } catch (err) {
            console.warn('[Quiz] Submit failed:', err.message);
            // Fallback local evaluation
            return {
                correctCount: 0,
                totalQuestions: responses.length,
                percentageCorrect: 0,
                passed: false,
                evaluations: responses.map((r, i) => ({
                    questionIndex: r.questionIndex,
                    question: quizData?.questions?.[r.questionIndex]?.question || '',
                    difficulty: 'medium',
                    isCorrect: false,
                    score: 0,
                    explanation: 'Could not evaluate — please try again.',
                })),
            };
        }
    }, [addQuizResult, unlockAchievement, quizData]);

    // ─── Quiz skip handler ───
    const handleQuizSkip = useCallback(async (qSessionId) => {
        try {
            if (qSessionId) await skipQuizSession(qSessionId);
        } catch (err) {
            console.warn('[Quiz] Skip failed:', err.message);
        }
    }, []);

    // ─── Quiz close handler ───
    const handleQuizClose = useCallback(() => {
        setShowQuizModal(false);
        setQuizData(null);
        setQuizSessionId(null);
        // Advance to next video after quiz
        if (activeVideoIdx < playlist.length - 1) {
            setActiveVideoIdx(prev => prev + 1);
            setIsPlaying(true);
        }
    }, [activeVideoIdx, playlist.length]);

    // ─── Chat send handler ───
    const handleChatSend = useCallback(async () => {
        const msg = chatInput.trim();
        if (!msg || chatLoading) return;

        addChatMessage({ role: 'user', text: msg, time: Date.now() });
        setChatInput('');
        setChatLoading(true);

        try {
            const res = await invokeAgent(sessionId || `local-${Date.now()}`, 'tutor', {
                currentConcept,
                videoId: activeVideo?.videoId,
                videoTime,
                userAnswer: msg,
            });
            const intervention = res.data?.result?.intervention;
            const feedback = res.data?.result?.evaluation_feedback;
            const responseText = intervention?.question
                || intervention?.hint
                || feedback
                || 'I\'m here to help! Could you rephrase your question about the video content?';

            addChatMessage({ role: 'ai', text: responseText, time: Date.now() });
        } catch (err) {
            addChatMessage({
                role: 'ai',
                text: `Sorry, I couldn't process that right now. Try again in a moment. (${err.message})`,
                time: Date.now(),
            });
        } finally {
            setChatLoading(false);
        }
    }, [chatInput, chatLoading, sessionId, currentConcept, activeVideo, videoTime, addChatMessage]);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // ─── Seek handler for transcript ───
    const handleTranscriptSeek = useCallback((seconds) => {
        // We need to access the YT player — emit a seek event and let VideoPlayer handle it
        // The simplest approach: we emit a clickstream event and programmatically seek
        setVideoTime(seconds);
        // Use a custom event to communicate with VideoPlayer
        window.dispatchEvent(new CustomEvent('transcript-seek', { detail: { seconds } }));
    }, []);

    // ─── Sidebar tab definitions ───
    const sidebarTabs = [
        { id: 'playlist', icon: <FiList size={15} />, label: 'Playlist' },
        { id: 'transcript', icon: <FiFileText size={15} />, label: 'Transcript' },
        { id: 'analytics', icon: <FiBarChart2 size={15} />, label: 'Analytics' },
        { id: 'notes', icon: <FiEdit3 size={15} />, label: 'Notes' },
        { id: 'skills', icon: <FiAward size={15} />, label: 'Skills' },
        { id: 'roadmap', icon: <FiMap size={15} />, label: 'Roadmap' },
    ];

    if (!hasPlaylist) {
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

    return (
        <div className={`page learning-session ${theaterMode ? 'theater' : ''}`}>
            {showBreakRecovery && (
                <WelcomeBackModal
                    userId={userId}
                    playlistId={playlistId}
                    onClose={() => setShowBreakRecovery(false)}
                    onContinue={(lastPosition) => {
                        if (lastPosition?.videoId) {
                            const idx = playlist.findIndex(v => v.videoId === lastPosition.videoId);
                            if (idx >= 0) {
                                setActiveVideoIdx(idx);
                            }
                        }
                        setShowBreakRecovery(false);
                    }}
                />
            )}

            {/* Confusion Alert Banner */}
            {showConfusionAlert && (
                <div className="confusion-alert-overlay">
                    <div className="confusion-alert-banner animate-scale-in">
                        <span className="confusion-alert-icon">{quizLoading ? '🧠' : '⚠️'}</span>
                        <div className="confusion-alert-text">
                            <h3>{quizLoading ? 'Generating your quiz' : 'Looks like you\'re struggling'}</h3>
                            <p>{quizLoading
                                ? `Creating a personalized question about "${currentConcept || 'this section'}"...`
                                : 'Let\'s check your understanding with a quick quiz!'}</p>
                        </div>
                        <div className="confusion-alert-loader" />
                    </div>
                </div>
            )}

            {/* ═══ Checkpoint Quiz Modal ═══ */}
            {showQuizModal && quizData && (
                <QuizModal
                    quiz={quizData}
                    quizSessionId={quizSessionId}
                    onSubmit={handleQuizSubmit}
                    onSkip={handleQuizSkip}
                    onClose={handleQuizClose}
                />
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
                    {/* Tabs — icon-only with tooltips */}
                    <div className="tabs tabs-icon-only">
                        {sidebarTabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`tab ${sidebarTab === tab.id ? 'active' : ''}`}
                                onClick={() => setSidebarTab(tab.id)}
                                title={tab.label}
                            >
                                {tab.icon}
                                <span className="tab-label">{tab.label}</span>
                            </button>
                        ))}
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

                        {/* Transcript tab */}
                        {sidebarTab === 'transcript' && (
                            <TranscriptViewer
                                videoId={activeVideo?.videoId}
                                currentTime={videoTime}
                                onSeek={handleTranscriptSeek}
                            />
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

                        {/* Skills tab */}
                        {sidebarTab === 'skills' && (
                            <SkillsDashboard userId={userId} playlistId={playlistId} />
                        )}

                        {/* Roadmap tab */}
                        {sidebarTab === 'roadmap' && (
                            <CourseRoadmap playlist={playlist} playlistId={playlistId} />
                        )}
                    </div>
                </aside>
            </div>

            {/* ═══ AI Tutor Chat ═══ */}
            <button className="chat-fab" onClick={() => setShowChat(!showChat)} title="AI Tutor">
                {showChat ? <FiX size={22} /> : <FiMessageCircle size={22} />}
            </button>
            {showChat && (
                <div className="chat-panel glass-card-static animate-scale-in">
                    <div className="chat-header">
                        <span className="heading-md">AI Tutor</span>
                        <span className="badge badge-primary">Live</span>
                    </div>
                    <div className="chat-body">
                        {/* Welcome message */}
                        <div className="chat-msg ai">
                            <p>👋 Hi! I can help explain concepts from <strong>{currentConcept || 'the video'}</strong>. Ask me anything!</p>
                        </div>
                        {/* Chat history */}
                        {chatMessages.map((msg, i) => (
                            <div key={i} className={`chat-msg ${msg.role}`}>
                                <p>{msg.text}</p>
                            </div>
                        ))}
                        {chatLoading && (
                            <div className="chat-msg ai">
                                <div className="chat-typing">
                                    <span /><span /><span />
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>
                    <div className="chat-input-row">
                        <input
                            className="input"
                            placeholder="Ask about the video..."
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                            disabled={chatLoading}
                        />
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={handleChatSend}
                            disabled={chatLoading || !chatInput.trim()}
                        >
                            <FiSend size={14} />
                        </button>
                    </div>
                </div>
            )}

            <InterventionModal
                isOpen={showIntervention}
                intervention={agentIntervention}
                onAnswer={async (answer) => {
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
