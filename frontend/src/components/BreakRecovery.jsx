import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowRight, FiClock, FiAward, FiZap } from 'react-icons/fi';
import './BreakRecovery.css';

const TIPS = [
    "💡 Try explaining what you learned to an imaginary student.",
    "🧠 Spaced repetition helps move knowledge to long-term memory.",
    "🎯 Focus on understanding concepts, not just memorizing facts.",
    "☕ A short break actually helps consolidate what you've learned.",
    "📝 Taking notes in your own words boosts retention by 34%.",
];

export default function BreakRecovery({
    onContinue,
    lastProgress = 67,
    lastTopics = ['Neural Networks', 'Backpropagation', 'Loss Functions'],
}) {
    const [phase, setPhase] = useState(0);
    const tip = TIPS[Math.floor(Math.random() * TIPS.length)];

    const phases = [
        {
            title: 'Welcome Back! 👋',
            subtitle: `You've been away for a bit. Let's get you back on track.`,
        },
        {
            title: 'Your Last Session',
            subtitle: 'Here\'s what you covered before your break',
        },
        {
            title: 'Quick Warmup',
            subtitle: 'A tip to get your brain in learning mode',
        },
        {
            title: 'Ready to Go! 🚀',
            subtitle: 'Pick up right where you left off',
        },
    ];

    return (
        <div className="break-overlay">
            <div className="break-container glass-card-static">
                {/* Phase dots */}
                <div className="break-dots">
                    {phases.map((_, i) => (
                        <div key={i} className={`break-dot ${i === phase ? 'active' : i < phase ? 'done' : ''}`} />
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={phase}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.3 }}
                        className="break-phase"
                    >
                        <h2 className="heading-lg">{phases[phase].title}</h2>
                        <p className="break-subtitle">{phases[phase].subtitle}</p>

                        {/* Phase 0: Welcome */}
                        {phase === 0 && (
                            <div className="break-content">
                                <div className="break-stats-row">
                                    <div className="break-stat">
                                        <FiClock size={20} />
                                        <span className="break-stat-value">{lastProgress}%</span>
                                        <span className="break-stat-label">Progress</span>
                                    </div>
                                    <div className="break-stat">
                                        <FiAward size={20} />
                                        <span className="break-stat-value">{lastTopics.length}</span>
                                        <span className="break-stat-label">Topics</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Phase 1: Recap */}
                        {phase === 1 && (
                            <div className="break-content">
                                <div className="break-timeline">
                                    {lastTopics.map((topic, i) => (
                                        <div key={i} className="break-timeline-item animate-fade-in-up" style={{ animationDelay: `${i * 0.15}s` }}>
                                            <div className="break-timeline-dot" />
                                            <div className="break-timeline-text">
                                                <span className="break-timeline-topic">{topic}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Phase 2: Warmup */}
                        {phase === 2 && (
                            <div className="break-content">
                                <div className="break-tip-card">
                                    <FiZap className="break-tip-icon" />
                                    <p className="break-tip-text">{tip}</p>
                                </div>
                            </div>
                        )}

                        {/* Phase 3: Ready */}
                        {phase === 3 && (
                            <div className="break-content">
                                <div className="break-ready animate-bounce-in">🎯</div>
                                <p className="break-ready-text">Your learning session is ready. Let's keep the momentum going!</p>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                <div className="break-actions">
                    {phase > 0 && (
                        <button className="btn btn-ghost" onClick={() => setPhase(phase - 1)}>Back</button>
                    )}
                    <div style={{ flex: 1 }} />
                    {phase < phases.length - 1 ? (
                        <button className="btn btn-primary" onClick={() => setPhase(phase + 1)}>
                            Next <FiArrowRight size={16} />
                        </button>
                    ) : (
                        <button className="btn btn-primary btn-lg" onClick={onContinue}>
                            Resume Learning <FiArrowRight size={16} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
