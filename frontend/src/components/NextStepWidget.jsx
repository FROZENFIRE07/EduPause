import { useState, useEffect } from 'react';
import { getNextStep } from '../api';
import { useAppStore } from '../store';
import { motion } from 'framer-motion';
import './NextStepWidget.css';

export default function NextStepWidget({ userId, playlistId, onStartLearning }) {
    const [nextStep, setNextStepData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { setNextStep: setStoreNextStep } = useAppStore();

    useEffect(() => {
        if (!userId || !playlistId) return;

        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await getNextStep(userId, playlistId);
                setNextStepData(res.data);
                setStoreNextStep(res.data);
            } catch (err) {
                console.error('[NextStep] Failed to fetch:', err);
                setError(err.response?.data?.error || 'Failed to load recommendation');
            } finally {
                setLoading(false);
            }
        })();
    }, [userId, playlistId]);

    if (loading) {
        return (
            <div className="next-step-widget loading">
                <div className="next-step-loader">
                    <div className="next-step-spinner" />
                    <p>Analyzing your progress...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="next-step-widget error">
                <div className="next-step-error-icon">⚠️</div>
                <p className="next-step-error-text">{error}</p>
            </div>
        );
    }

    if (!nextStep) {
        return null;
    }

    // Handle completion state
    if (nextStep.type === 'complete') {
        return (
            <motion.div
                className="next-step-widget complete"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="next-step-complete-icon">🎉</div>
                <h3 className="next-step-complete-title">Playlist Complete!</h3>
                <p className="next-step-complete-message">{nextStep.message}</p>
                <div className="next-step-stats-grid">
                    <div className="next-step-stat">
                        <span className="next-step-stat-value">{nextStep.stats.totalConcepts}</span>
                        <span className="next-step-stat-label">Concepts Mastered</span>
                    </div>
                    <div className="next-step-stat">
                        <span className="next-step-stat-value">{nextStep.stats.progress}%</span>
                        <span className="next-step-stat-label">Completion</span>
                    </div>
                </div>
            </motion.div>
        );
    }

    // Handle concept recommendation
    const { concept, video, reasoning, why, stats } = nextStep;
    const milestoneColor = {
        beginner: 'var(--accent-primary)',
        intermediate: 'var(--accent-info)',
        advanced: 'var(--accent-success)',
    };

    const milestoneLabel = {
        beginner: 'Foundation',
        intermediate: 'Core',
        advanced: 'Advanced',
    };

    return (
        <motion.div
            className="next-step-widget"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            {/* Header */}
            <div className="next-step-header">
                <div className="next-step-title-row">
                    <h3 className="next-step-title">What to Learn Next</h3>
                    <span 
                        className="next-step-milestone"
                        style={{ color: milestoneColor[concept.milestone] }}
                    >
                        {milestoneLabel[concept.milestone]}
                    </span>
                </div>
                <div className="next-step-progress-bar">
                    <div 
                        className="next-step-progress-fill"
                        style={{ width: `${stats.progress}%` }}
                    />
                </div>
                <div className="next-step-stats">
                    <span className="next-step-stats-text">
                        {stats.masteredConcepts} of {stats.totalConcepts} concepts mastered
                    </span>
                    <span className="next-step-stats-percent">{stats.progress}%</span>
                </div>
            </div>

            {/* Concept Card */}
            <div className="next-step-concept">
                <div className="next-step-concept-header">
                    <div className="next-step-concept-icon">🎯</div>
                    <div className="next-step-concept-text">
                        <h4 className="next-step-concept-label">{concept.label}</h4>
                        {concept.definition && (
                            <p className="next-step-concept-definition">{concept.definition}</p>
                        )}
                    </div>
                </div>

                {/* Reasoning */}
                <div className="next-step-reasoning">
                    <div className="next-step-reasoning-icon">💡</div>
                    <div className="next-step-reasoning-text">
                        <p className="next-step-reasoning-why">{why}</p>
                    </div>
                </div>
            </div>

            {/* Video Link (if available) */}
            {video && (
                <div className="next-step-video">
                    <div className="next-step-video-thumb">
                        {video.thumbnail && (
                            <img src={video.thumbnail} alt={video.title} />
                        )}
                        <div className="next-step-video-play">▶</div>
                    </div>
                    <div className="next-step-video-info">
                        <p className="next-step-video-title">{video.title}</p>
                        {video.startTime && (
                            <p className="next-step-video-time">
                                Start at {video.startTime}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Action Button */}
            <button
                className="next-step-cta"
                onClick={() => onStartLearning && onStartLearning(concept, video)}
            >
                <span className="next-step-cta-icon">🚀</span>
                <span className="next-step-cta-text">Start Learning</span>
            </button>

            {/* Remaining Concepts Indicator */}
            {stats.remaining > 1 && (
                <p className="next-step-remaining">
                    {stats.remaining - 1} more concept{stats.remaining - 1 !== 1 ? 's' : ''} after this
                </p>
            )}
        </motion.div>
    );
}
