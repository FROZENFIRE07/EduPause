import { useState, useEffect } from 'react';
import { getUserProgress } from '../api';
import { useAppStore } from '../store';
import { motion } from 'framer-motion';
import './SkillsDashboard.css';

export default function SkillsDashboard({ userId, playlistId }) {
    const [stats, setStats] = useState(null);
    const [concepts, setConcepts] = useState([]);
    const [loading, setLoading] = useState(true);
    const { userProgress } = useAppStore();

    useEffect(() => {
        if (!userId || !playlistId) return;

        (async () => {
            setLoading(true);
            try {
                const res = await getUserProgress(userId, playlistId);
                const progress = res.data;
                
                setStats(progress.stats || {});
                
                // Convert concepts object to array with stats
                const conceptsArray = Object.entries(progress.conceptsCovered || {}).map(([id, data]) => ({
                    id,
                    ...data,
                })).sort((a, b) => {
                    // Sort by confidence desc, then by last exposure
                    const confOrder = { high: 3, medium: 2, low: 1 };
                    if (confOrder[b.skillConfidence] !== confOrder[a.skillConfidence]) {
                        return confOrder[b.skillConfidence] - confOrder[a.skillConfidence];
                    }
                    return new Date(b.lastExposedAt) - new Date(a.lastExposedAt);
                });
                
                setConcepts(conceptsArray);
            } catch (err) {
                console.error('[SkillsDashboard] Failed to load:', err);
            } finally {
                setLoading(false);
            }
        })();
    }, [userId, playlistId, userProgress]);

    if (loading) {
        return (
            <div className="skills-dashboard loading">
                <div className="skills-loader">
                    <div className="skills-spinner" />
                    <p>Loading your skills...</p>
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="skills-dashboard empty">
                <div className="skills-empty-icon">📚</div>
                <p>Start learning to track your skills!</p>
            </div>
        );
    }

    const masteredConcepts = concepts.filter(c => c.skillConfidence === 'high');
    const inProgressConcepts = concepts.filter(c => c.skillConfidence === 'medium');
    const recentConcepts = concepts.slice(0, 5);

    return (
        <div className="skills-dashboard">
            {/* Stats Grid */}
            <div className="skills-stats-grid">
                <motion.div 
                    className="skills-stat-card primary"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="skills-stat-icon">🏆</div>
                    <div className="skills-stat-content">
                        <div className="skills-stat-value">{masteredConcepts.length}</div>
                        <div className="skills-stat-label">Skills Mastered</div>
                    </div>
                </motion.div>

                <motion.div 
                    className="skills-stat-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="skills-stat-icon">🎯</div>
                    <div className="skills-stat-content">
                        <div className="skills-stat-value">{inProgressConcepts.length}</div>
                        <div className="skills-stat-label">In Progress</div>
                    </div>
                </motion.div>

                <motion.div 
                    className="skills-stat-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <div className="skills-stat-icon">📺</div>
                    <div className="skills-stat-content">
                        <div className="skills-stat-value">{stats.videosCompleted || 0}</div>
                        <div className="skills-stat-label">Videos Completed</div>
                    </div>
                </motion.div>

                <motion.div 
                    className="skills-stat-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <div className="skills-stat-icon">✅</div>
                    <div className="skills-stat-content">
                        <div className="skills-stat-value">{stats.quizzesPassed || 0}/{stats.quizzesTaken || 0}</div>
                        <div className="skills-stat-label">Quizzes Passed</div>
                    </div>
                </motion.div>
            </div>

            {/* Recent Skills */}
            {recentConcepts.length > 0 && (
                <div className="skills-recent-section">
                    <h3 className="skills-section-title">Recently Learned</h3>
                    <div className="skills-concept-list">
                        {recentConcepts.map((concept, i) => (
                            <motion.div
                                key={concept.id}
                                className={`skills-concept-card ${concept.skillConfidence}`}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <div className="skills-concept-header">
                                    <div className={`skills-concept-badge ${concept.skillConfidence}`}>
                                        {concept.skillConfidence === 'high' && '🌟'}
                                        {concept.skillConfidence === 'medium' && '📈'}
                                        {concept.skillConfidence === 'low' && '🌱'}
                                    </div>
                                    <div className="skills-concept-info">
                                        <div className="skills-concept-id">{concept.id}</div>
                                        <div className="skills-concept-meta">
                                            <span className="skills-concept-exposure">
                                                {concept.exposureCount}x seen
                                            </span>
                                            <span className="skills-concept-confidence">
                                                {Math.round(concept.confidenceScore * 100)}% confident
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="skills-concept-progress">
                                    <div 
                                        className="skills-concept-progress-bar"
                                        style={{ width: `${concept.confidenceScore * 100}%` }}
                                    />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* Skill Tree Visualization Link */}
            <div className="skills-view-all">
                <button className="skills-view-all-btn">
                    <span>View Full Skill Tree</span>
                    <span className="skills-view-all-icon">→</span>
                </button>
            </div>
        </div>
    );
}
