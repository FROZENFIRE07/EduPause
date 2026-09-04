/**
 * StudyHub — Dedicated page for Notes, Quiz History, and Take Quiz
 * Provides persistent, non-intervention-triggered access to learning tools
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    FiEdit3, FiAward, FiPlay, FiClock, FiSearch,
    FiCheckCircle, FiXCircle, FiChevronDown, FiChevronUp,
    FiBookOpen, FiBarChart2, FiTarget
} from 'react-icons/fi';
import QuizModal from '../components/QuizModal';
import { useAppStore } from '../store';
import {
    getQuizHistory, generateQuizManual, submitQuizAnswers, skipQuizSession,
} from '../api';
import './StudyHub.css';

export default function StudyHub() {
    const {
        notes, currentPlaylist, authUser,
        addQuizResult, unlockAchievement,
    } = useAppStore();
    const playlist = currentPlaylist || [];
    const userId = authUser?.email || authUser?.name || 'anonymous';
    const playlistId = 'default';

    const [activeTab, setActiveTab] = useState('notes');
    const [quizHistory, setQuizHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [noteSearch, setNoteSearch] = useState('');
    const [expandedQuiz, setExpandedQuiz] = useState(null);

    // Take Quiz state
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [quizGenerating, setQuizGenerating] = useState(false);
    const [showQuizModal, setShowQuizModal] = useState(false);
    const [quizData, setQuizData] = useState(null);
    const [quizSessionId, setQuizSessionId] = useState(null);
    const [selectedDifficulty, setSelectedDifficulty] = useState('medium');

    // Fetch quiz history when tab switches
    useEffect(() => {
        if (activeTab === 'history' && quizHistory.length === 0) {
            fetchQuizHistory();
        }
    }, [activeTab]);

    const fetchQuizHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const res = await getQuizHistory(userId, playlistId);
            setQuizHistory(res.data?.quizzes || []);
        } catch (err) {
            console.warn('[StudyHub] Quiz history fetch failed:', err.message);
        } finally {
            setHistoryLoading(false);
        }
    }, [userId, playlistId]);

    // Notes filtered by search
    const filteredNotes = useMemo(() => {
        const entries = Object.entries(notes || {});
        if (!noteSearch.trim()) return entries;
        const q = noteSearch.toLowerCase();
        return entries.filter(([videoId, text]) => {
            const video = playlist.find(v => v.videoId === videoId);
            return text.toLowerCase().includes(q) || video?.title?.toLowerCase().includes(q);
        });
    }, [notes, noteSearch, playlist]);

    // Generate quiz for a video
    const handleGenerateQuiz = useCallback(async (videoId) => {
        setQuizGenerating(true);
        setSelectedVideo(videoId);
        try {
            const res = await generateQuizManual(userId, playlistId, videoId, selectedDifficulty);
            if (res.data?.quiz) {
                setQuizData(res.data.quiz);
                setQuizSessionId(res.data.quizSessionId || null);
                setShowQuizModal(true);
            } else {
                alert('Could not generate quiz. Please try again.');
            }
        } catch (err) {
            console.warn('[StudyHub] Quiz generation failed:', err.message);
            alert(`Quiz generation failed: ${err.message}`);
        } finally {
            setQuizGenerating(false);
        }
    }, [userId, playlistId, selectedDifficulty]);

    // Quiz submit handler
    const handleQuizSubmit = useCallback(async (qSessionId, responses) => {
        try {
            const res = await submitQuizAnswers(qSessionId, responses);
            addQuizResult(res.data);
            unlockAchievement('first_quiz');
            if (res.data?.passed) unlockAchievement('mastery_1');
            return res.data;
        } catch (err) {
            return {
                correctCount: 0,
                totalQuestions: responses.length,
                percentageCorrect: 0,
                passed: false,
                evaluations: responses.map(r => ({
                    questionIndex: r.questionIndex,
                    isCorrect: false,
                    score: 0,
                    explanation: `Evaluation failed: ${err.message}`,
                })),
            };
        }
    }, [addQuizResult, unlockAchievement]);

    const handleQuizSkip = useCallback(async (qSessionId) => {
        try { if (qSessionId) await skipQuizSession(qSessionId); } catch { }
    }, []);

    const handleQuizClose = useCallback(() => {
        setShowQuizModal(false);
        setQuizData(null);
        setQuizSessionId(null);
        fetchQuizHistory();
    }, [fetchQuizHistory]);

    // Stats
    const totalNotes = Object.keys(notes || {}).length;
    const totalQuizzes = quizHistory.length;
    const avgScore = totalQuizzes > 0
        ? Math.round(quizHistory.reduce((s, q) => s + (q.percentageCorrect || 0), 0) / totalQuizzes)
        : 0;

    const tabs = [
        { id: 'notes', icon: <FiEdit3 size={16} />, label: 'Notes', count: totalNotes },
        { id: 'quiz', icon: <FiPlay size={16} />, label: 'Take Quiz', count: null },
        { id: 'history', icon: <FiAward size={16} />, label: 'Quiz History', count: totalQuizzes },
    ];

    if (!playlist.length) {
        return (
            <div className="page study-hub">
                <div className="study-hub-empty">
                    <div className="study-hub-empty-icon">📚</div>
                    <h2 className="heading-lg">No playlist loaded</h2>
                    <p>Import a playlist to start using the Study Hub.</p>
                    <Link to="/" className="btn btn-primary">Import a Playlist</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="page study-hub">
            {/* Quiz Modal */}
            {showQuizModal && quizData && (
                <QuizModal
                    quiz={quizData}
                    quizSessionId={quizSessionId}
                    onSubmit={handleQuizSubmit}
                    onSkip={handleQuizSkip}
                    onClose={handleQuizClose}
                />
            )}

            <div className="study-hub-container container">
                {/* Header */}
                <div className="study-hub-header">
                    <div>
                        <h1 className="heading-lg">Study Hub</h1>
                        <p className="study-hub-subtitle">Your notes, quizzes, and learning progress — all in one place.</p>
                    </div>
                    <div className="study-hub-stats">
                        <div className="study-hub-stat">
                            <FiBookOpen size={14} />
                            <span>{totalNotes} notes</span>
                        </div>
                        <div className="study-hub-stat">
                            <FiTarget size={14} />
                            <span>{totalQuizzes} quizzes taken</span>
                        </div>
                        {totalQuizzes > 0 && (
                            <div className="study-hub-stat">
                                <FiBarChart2 size={14} />
                                <span>Avg score: {avgScore}%</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="study-hub-tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`study-hub-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                            {tab.count != null && tab.count > 0 && (
                                <span className="study-hub-tab-count">{tab.count}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ═══ NOTES TAB ═══ */}
                {activeTab === 'notes' && (
                    <div className="study-hub-panel">
                        <div className="study-hub-search">
                            <FiSearch size={14} />
                            <input
                                placeholder="Search your notes..."
                                value={noteSearch}
                                onChange={e => setNoteSearch(e.target.value)}
                            />
                        </div>

                        {filteredNotes.length === 0 ? (
                            <div className="study-hub-empty-state">
                                <p>📝 No notes yet. Take notes while watching videos in the Learning Session.</p>
                                <Link to="/learn" className="btn btn-primary btn-sm">Go to Learning Session</Link>
                            </div>
                        ) : (
                            <div className="study-hub-notes-grid">
                                {filteredNotes.map(([videoId, text]) => {
                                    const video = playlist.find(v => v.videoId === videoId);
                                    return (
                                        <div key={videoId} className="study-hub-note-card glass-card-static">
                                            <div className="note-card-header">
                                                <h3 className="note-card-title">{video?.title || videoId}</h3>
                                                <span className="note-card-duration">{video?.duration || ''}</span>
                                            </div>
                                            <div className="note-card-body">
                                                {text.split('\n').map((line, i) => (
                                                    <p key={i}>{line || '\u00A0'}</p>
                                                ))}
                                            </div>
                                            <div className="note-card-footer">
                                                <span className="note-card-length">{text.length} characters</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ TAKE QUIZ TAB ═══ */}
                {activeTab === 'quiz' && (
                    <div className="study-hub-panel">
                        <div className="quiz-difficulty-filter">
                            <span className="filter-label">Difficulty:</span>
                            {['easy', 'medium', 'hard'].map(d => (
                                <button
                                    key={d}
                                    className={`filter-btn ${selectedDifficulty === d ? 'active' : ''}`}
                                    onClick={() => setSelectedDifficulty(d)}
                                >
                                    {d.charAt(0).toUpperCase() + d.slice(1)}
                                </button>
                            ))}
                        </div>

                        <p className="quiz-tab-desc">
                            Select a video to generate a personalized quiz based on its transcript content.
                            Each quiz contains <strong>10 questions per difficulty level</strong> — strictly from the video content.
                        </p>

                        <div className="quiz-video-grid">
                            {playlist.map((v, i) => (
                                <div key={v.videoId} className="quiz-video-card glass-card-static">
                                    <div className="quiz-video-info">
                                        <span className="quiz-video-idx">{i + 1}</span>
                                        <div>
                                            <h4 className="quiz-video-title">{v.title}</h4>
                                            <span className="quiz-video-dur">{v.duration}</span>
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => handleGenerateQuiz(v.videoId)}
                                        disabled={quizGenerating && selectedVideo === v.videoId}
                                    >
                                        {quizGenerating && selectedVideo === v.videoId ? (
                                            <>Generating...</>
                                        ) : (
                                            <><FiPlay size={12} /> Take Quiz</>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ═══ QUIZ HISTORY TAB ═══ */}
                {activeTab === 'history' && (
                    <div className="study-hub-panel">
                        {historyLoading ? (
                            <div className="study-hub-empty-state">
                                <p>Loading quiz history...</p>
                            </div>
                        ) : quizHistory.length === 0 ? (
                            <div className="study-hub-empty-state">
                                <p>📊 No quizzes taken yet. Take a quiz to see your history here.</p>
                                <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('quiz')}>
                                    Take a Quiz
                                </button>
                            </div>
                        ) : (
                            <div className="quiz-history-list">
                                {quizHistory.map((q, i) => (
                                    <div key={i} className="quiz-history-card glass-card-static">
                                        <div
                                            className="quiz-history-header"
                                            onClick={() => setExpandedQuiz(expandedQuiz === i ? null : i)}
                                        >
                                            <div className="quiz-history-main">
                                                <span className={`quiz-history-score ${q.passed ? 'passed' : 'failed'}`}>
                                                    {q.percentageCorrect?.toFixed(0)}%
                                                </span>
                                                <div className="quiz-history-info">
                                                    <h4>{q.concept || q.videoId || 'Quiz'}</h4>
                                                    <span className="quiz-history-date">
                                                        <FiClock size={11} />
                                                        {q.takenAt ? new Date(q.takenAt).toLocaleDateString() : 'Recently'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="quiz-history-right">
                                                <span className={`badge ${q.passed ? 'badge-success' : 'badge-danger'}`}>
                                                    {q.passed ? 'Passed' : 'Needs Review'}
                                                </span>
                                                {expandedQuiz === i ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                                            </div>
                                        </div>

                                        {expandedQuiz === i && q.evaluations && (
                                            <div className="quiz-history-details">
                                                {q.evaluations.map((ev, j) => (
                                                    <div key={j} className={`quiz-eval-item ${ev.isCorrect ? 'correct' : 'incorrect'}`}>
                                                        <span className="quiz-eval-icon">
                                                            {ev.isCorrect ? <FiCheckCircle size={14} /> : <FiXCircle size={14} />}
                                                        </span>
                                                        <div className="quiz-eval-content">
                                                            <span className="quiz-eval-q">{ev.question}</span>
                                                            {!ev.isCorrect && ev.explanation && (
                                                                <span className="quiz-eval-exp">💡 {ev.explanation}</span>
                                                            )}
                                                        </div>
                                                        <span className={`quiz-eval-diff ${ev.difficulty}`}>
                                                            {ev.difficulty}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
