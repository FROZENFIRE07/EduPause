import { useState } from 'react';
import { FiClock, FiZap, FiCheckCircle, FiArrowRight } from 'react-icons/fi';
import './BreakRecovery.css';

export default function BreakRecovery({
    breakDuration = '3 days',
    lastConcepts = ['Gradient Descent', 'Chain Rule'],
    recapSummary = 'You were learning about how neural networks adjust their weights using gradient descent. The chain rule of calculus is used to compute gradients through multiple layers (backpropagation).',
    warmupQuestion = null,
    onContinue,
    onStartWarmup,
}) {
    const [phase, setPhase] = useState('welcome'); // welcome | recap | warmup | ready

    const handleRecap = () => setPhase('recap');
    const handleWarmup = () => {
        setPhase('warmup');
        onStartWarmup?.();
    };
    const handleReady = () => {
        setPhase('ready');
        onContinue?.();
    };

    return (
        <div className="break-recovery animate-fade-in-up">
            <div className="break-recovery-inner glass-card">
                {/* Welcome Phase */}
                {phase === 'welcome' && (
                    <div className="br-phase animate-fade-in">
                        <div className="br-icon-large">👋</div>
                        <h2 className="heading-lg">Welcome back!</h2>
                        <p className="br-subtitle">
                            It's been <strong className="text-gradient">{breakDuration}</strong> since your last session.
                            Let's get you back on track with a quick recap.
                        </p>
                        <div className="br-stats">
                            <div className="br-stat">
                                <FiClock size={18} />
                                <div>
                                    <span className="br-stat-label">Away for</span>
                                    <span className="br-stat-value">{breakDuration}</span>
                                </div>
                            </div>
                            <div className="br-stat">
                                <FiZap size={18} />
                                <div>
                                    <span className="br-stat-label">Last concepts</span>
                                    <span className="br-stat-value">{lastConcepts.join(', ')}</span>
                                </div>
                            </div>
                        </div>
                        <button className="btn btn-primary btn-lg" onClick={handleRecap}>
                            Show me the recap
                            <FiArrowRight size={18} />
                        </button>
                    </div>
                )}

                {/* Recap Phase */}
                {phase === 'recap' && (
                    <div className="br-phase animate-fade-in">
                        <div className="br-icon-large">📖</div>
                        <h2 className="heading-lg">Quick Recap</h2>
                        <p className="br-subtitle">Here's a summary of what you mastered last time:</p>
                        <div className="br-recap-box">
                            <p>{recapSummary}</p>
                        </div>
                        <div className="br-concept-tags">
                            {lastConcepts.map(c => (
                                <span key={c} className="badge badge-primary">{c}</span>
                            ))}
                        </div>
                        <button className="btn btn-primary btn-lg" onClick={handleWarmup}>
                            <FiZap size={18} />
                            Take a quick warm-up
                        </button>
                        <button className="btn btn-ghost" onClick={handleReady}>
                            Skip & continue learning
                        </button>
                    </div>
                )}

                {/* Warmup Phase */}
                {phase === 'warmup' && (
                    <div className="br-phase animate-fade-in">
                        <div className="br-icon-large">🧠</div>
                        <h2 className="heading-lg">Warm-up Check</h2>
                        <p className="br-subtitle">
                            This quick, low-stakes question helps reactivate your memory — no pressure!
                        </p>
                        {/* The actual warm-up question will be handled by the InterventionModal */}
                        <div className="br-warmup-placeholder">
                            <FiCheckCircle size={24} />
                            <p>Warm-up question loading from the AI tutor...</p>
                        </div>
                        <button className="btn btn-primary btn-lg" onClick={handleReady}>
                            I'm ready to continue
                            <FiArrowRight size={18} />
                        </button>
                    </div>
                )}

                {/* Ready Phase */}
                {phase === 'ready' && (
                    <div className="br-phase animate-fade-in">
                        <div className="br-icon-large">🚀</div>
                        <h2 className="heading-lg">You're all set!</h2>
                        <p className="br-subtitle">Your brain is primed. Let's continue where you left off.</p>
                        <div className="br-progress-ring">
                            <FiCheckCircle size={48} className="text-gradient" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
