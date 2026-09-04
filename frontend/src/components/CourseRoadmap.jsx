import { useState, useEffect, useRef } from 'react';
import { generateRoadmapApi, getStructuredRoadmap } from '../api';
import { useAppStore } from '../store';
import './CourseRoadmap.css';

export default function CourseRoadmap({ playlist = [], playlistId = null }) {
    const [milestones, setMilestones] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [useStructured, setUseStructured] = useState(false);
    const fetchedRef = useRef(false);
    const { roadmap, setRoadmap, setRoadmapLoading, userProgress } = useAppStore();

    useEffect(() => {
        if (fetchedRef.current || playlist.length === 0) return;
        fetchedRef.current = true;

        (async () => {
            setLoading(true);
            setRoadmapLoading(true);
            setError(null);
            
            try {
                // Try to get structured roadmap first if playlistId is available
                if (playlistId) {
                    try {
                        const res = await getStructuredRoadmap(playlistId);
                        if (res.data?.roadmap) {
                            setRoadmap(res.data.roadmap);
                            setUseStructured(true);
                            // Convert structured roadmap to milestone format for display
                            const structuredMilestones = Object.entries(res.data.roadmap.milestones).map(([level, data]) => ({
                                id: level,
                                title: data.title,
                                description: data.description,
                                icon: data.icon,
                                concepts: data.concepts || [],
                                level,
                            }));
                            setMilestones(structuredMilestones);
                            setLoading(false);
                            setRoadmapLoading(false);
                            return;
                        }
                    } catch (err) {
                        console.warn('[Roadmap] Structured roadmap not available, falling back to LLM generation');
                    }
                }

                // Fallback to LLM-generated milestones
                const videoIds = playlist.map(v => v.videoId);
                const res = await generateRoadmapApi(videoIds);
                const data = res.data?.milestones || [];
                
                if (data.length > 0) {
                    setMilestones(data);
                } else {
                    // Final fallback: derive from video titles
                    setMilestones(playlist.slice(0, 8).map((v, i) => ({
                        id: `milestone-${i}`,
                        title: v.title?.replace(/^(But )?what (is|are) /i, '').replace(/\?$/i, '').trim().substring(0, 35) || `Topic ${i + 1}`,
                        description: `Master the concepts from video ${i + 1}`,
                        icon: ['🎯', '📐', '🧮', '⚡', '🔬', '🧠', '🏗️', '🚀'][i % 8],
                    })));
                }
            } catch (err) {
                console.warn('[Roadmap] Generation failed:', err.message);
                setError('Could not generate roadmap');
                // Fallback to video titles
                setMilestones(playlist.slice(0, 8).map((v, i) => ({
                    id: `milestone-${i}`,
                    title: v.title?.replace(/^(But )?what (is|are) /i, '').replace(/\?$/i, '').trim().substring(0, 35) || `Topic ${i + 1}`,
                    description: `Master the concepts from video ${i + 1}`,
                    icon: ['🎯', '📐', '🧮', '⚡', '🔬', '🧠', '🏗️', '🚀'][i % 8],
                })));
            } finally {
                setLoading(false);
                setRoadmapLoading(false);
            }
        })();
    }, [playlist, playlistId]);

    if (loading) {
        return (
            <div className="roadmap-container">
                <div className="roadmap-loading">
                    <div className="roadmap-loading-icon">🗺️</div>
                    <p className="roadmap-loading-text">
                        {useStructured ? 'Analyzing knowledge graph...' : 'Generating your course roadmap...'}
                    </p>
                    <div className="roadmap-loading-bar">
                        <div className="roadmap-loading-fill" />
                    </div>
                </div>
            </div>
        );
    }

    if (!milestones || milestones.length === 0) {
        return (
            <div className="roadmap-container">
                <p className="roadmap-empty">No roadmap data available yet.</p>
            </div>
        );
    }

    // Calculate progress if we have userProgress data
    const getMilestoneProgress = (milestone) => {
        if (!userProgress || !useStructured) return 0;
        
        const concepts = milestone.concepts || [];
        if (concepts.length === 0) return 0;
        
        const masteredCount = concepts.filter(conceptId => {
            const mastery = userProgress.conceptsCovered?.[conceptId];
            return mastery && mastery.skillConfidence === 'high';
        }).length;
        
        return Math.round((masteredCount / concepts.length) * 100);
    };

    return (
        <div className="roadmap-container">
            <div className="roadmap-header">
                <span className="roadmap-title">
                    {useStructured ? 'Learning Journey' : 'Course Roadmap'}
                </span>
                <span className="roadmap-count">{milestones.length} milestones</span>
                {useStructured && roadmap && (
                    <span className="roadmap-stats">
                        {roadmap.stats?.totalConcepts || 0} concepts
                    </span>
                )}
            </div>

            <div className="roadmap-snake">
                {milestones.map((m, i) => {
                    const isRight = i % 2 === 0;
                    const isLast = i === milestones.length - 1;
                    const progress = getMilestoneProgress(m);

                    return (
                        <div key={m.id || i} className={`roadmap-row ${isRight ? 'right' : 'left'}`}>
                            {/* Connector line */}
                            {i > 0 && (
                                <div className={`roadmap-connector ${isRight ? 'from-left' : 'from-right'}`}>
                                    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="roadmap-curve">
                                        <path
                                            d={isRight
                                                ? 'M 10 0 C 10 30, 90 10, 90 40'
                                                : 'M 90 0 C 90 30, 10 10, 10 40'
                                            }
                                            fill="none"
                                            stroke="var(--accent-primary)"
                                            strokeWidth="2"
                                            strokeDasharray="4 3"
                                            opacity="0.4"
                                        />
                                    </svg>
                                </div>
                            )}

                            {/* Milestone node */}
                            <div
                                className={`roadmap-node animate-fade-in-up ${progress === 100 ? 'completed' : ''}`}
                                style={{ animationDelay: `${i * 0.1}s` }}
                            >
                                <div className="roadmap-node-number">{i + 1}</div>
                                <div className="roadmap-node-icon">{m.icon || '📌'}</div>
                                <div className="roadmap-node-body">
                                    <h4 className="roadmap-node-title">{m.title}</h4>
                                    <p className="roadmap-node-desc">{m.description}</p>
                                    {useStructured && m.concepts && m.concepts.length > 0 && (
                                        <div className="roadmap-node-meta">
                                            <span className="roadmap-concept-count">
                                                {m.concepts.length} concept{m.concepts.length !== 1 ? 's' : ''}
                                            </span>
                                            {userProgress && (
                                                <span className={`roadmap-progress ${progress === 100 ? 'complete' : ''}`}>
                                                    {progress}% mastered
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {progress > 0 && progress < 100 && (
                                    <div className="roadmap-node-progress">
                                        <div 
                                            className="roadmap-node-progress-fill" 
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Finish flag on last */}
                            {isLast && (
                                <div className="roadmap-finish">
                                    <span className="roadmap-finish-icon">🏁</span>
                                    <span className="roadmap-finish-text">
                                        {useStructured ? 'Mastery Achieved' : 'Course Complete'}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
