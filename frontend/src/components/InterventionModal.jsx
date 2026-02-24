import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactConfetti from 'react-confetti';
import { FiX, FiCheck, FiHelpCircle, FiSkipForward, FiStar } from 'react-icons/fi';
import './InterventionModal.css';

export default function InterventionModal({
    isOpen,
    intervention,
    onAnswer,
    onSkip,
    onClose,
    questionNumber = 1,
    totalQuestions = 1,
}) {
    const [userAnswer, setUserAnswer] = useState('');
    const [feedback, setFeedback] = useState(null);
    const [selectedOption, setSelectedOption] = useState(null);
    const [showConfetti, setShowConfetti] = useState(false);

    if (!isOpen || !intervention) return null;

    const handleSubmit = () => {
        if (intervention.type === 'mcq') {
            const isCorrect = selectedOption === intervention.correctIndex;
            setFeedback({
                correct: isCorrect,
                message: isCorrect
                    ? '🎉 Excellent! You got it right!'
                    : `❌ Not quite. The correct answer is: ${intervention.options[intervention.correctIndex]}`,
            });
            if (isCorrect) {
                setShowConfetti(true);
                setTimeout(() => setShowConfetti(false), 3000);
            }
        } else {
            setFeedback({ correct: true, message: '✅ Answer submitted! Keep going.' });
        }
    };

    const handleContinue = () => {
        setUserAnswer('');
        setSelectedOption(null);
        setFeedback(null);
        setShowConfetti(false);
        if (feedback?.correct) {
            onAnswer?.(intervention.type === 'mcq' ? selectedOption : userAnswer);
        } else {
            onClose?.();
        }
    };

    const handleSkip = () => {
        setUserAnswer('');
        setSelectedOption(null);
        setFeedback(null);
        onSkip?.();
    };

    return (
        <>
            {showConfetti && (
                <ReactConfetti
                    width={window.innerWidth}
                    height={window.innerHeight}
                    recycle={false}
                    numberOfPieces={150}
                    colors={['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b']}
                    style={{ position: 'fixed', top: 0, left: 0, zIndex: 10001, pointerEvents: 'none' }}
                />
            )}
            <motion.div
                className="modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className={`modal-content glass-card-static ${feedback && !feedback.correct ? 'animate-shake' : ''}`}
                    onClick={e => e.stopPropagation()}
                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                >
                    {/* Header */}
                    <div className="modal-header">
                        <div className="modal-title-row">
                            <div className="modal-icon">
                                <FiHelpCircle size={20} />
                            </div>
                            <div>
                                <h3 className="modal-title">Knowledge Check</h3>
                                <p className="modal-subtitle">
                                    {intervention.context || 'Let\'s verify your understanding of this concept'}
                                </p>
                            </div>
                        </div>
                        <div className="modal-header-right">
                            {totalQuestions > 1 && (
                                <span className="modal-progress-badge">
                                    {questionNumber} / {totalQuestions}
                                </span>
                            )}
                            <button className="modal-close" onClick={onClose}>
                                <FiX size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Progress bar */}
                    {totalQuestions > 1 && (
                        <div className="modal-progress-bar">
                            <div
                                className="modal-progress-fill"
                                style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
                            />
                        </div>
                    )}

                    {/* Question */}
                    <div className="modal-body">
                        <div className="question-box">
                            <p className="question-text">{intervention.question}</p>
                        </div>

                        {/* MCQ options */}
                        {intervention.type === 'mcq' && intervention.options && (
                            <div className="options-grid">
                                {intervention.options.map((opt, i) => (
                                    <motion.button
                                        key={i}
                                        className={`option-card ${selectedOption === i ? 'selected' : ''} ${feedback && i === intervention.correctIndex ? 'correct' : ''
                                            } ${feedback && selectedOption === i && i !== intervention.correctIndex ? 'incorrect' : ''}`}
                                        onClick={() => !feedback && setSelectedOption(i)}
                                        disabled={!!feedback}
                                        whileHover={!feedback ? { scale: 1.02 } : {}}
                                        whileTap={!feedback ? { scale: 0.98 } : {}}
                                    >
                                        <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                                        <span className="option-text">{opt}</span>
                                        {feedback && i === intervention.correctIndex && <FiCheck className="option-icon correct" />}
                                    </motion.button>
                                ))}
                            </div>
                        )}

                        {/* Free text */}
                        {intervention.type === 'text' && (
                            <textarea
                                className="answer-input input"
                                placeholder="Type your answer here..."
                                value={userAnswer}
                                onChange={e => setUserAnswer(e.target.value)}
                                rows={3}
                                disabled={!!feedback}
                            />
                        )}

                        {/* Hint */}
                        {intervention.hint && !feedback && (
                            <div className="hint-box">
                                <FiStar size={14} />
                                <span><strong>Hint:</strong> {intervention.hint}</span>
                            </div>
                        )}

                        {/* Feedback */}
                        <AnimatePresence>
                            {feedback && (
                                <motion.div
                                    className={`feedback-box ${feedback.correct ? 'correct' : 'incorrect'}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <p>{feedback.message}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Actions */}
                    <div className="modal-footer">
                        <button className="btn btn-ghost" onClick={handleSkip}>
                            <FiSkipForward size={16} />
                            Skip for now
                        </button>
                        {!feedback ? (
                            <button
                                className="btn btn-primary"
                                onClick={handleSubmit}
                                disabled={intervention.type === 'mcq' ? selectedOption === null : !userAnswer.trim()}
                            >
                                <FiCheck size={16} />
                                Submit Answer
                            </button>
                        ) : (
                            <button className="btn btn-primary" onClick={handleContinue}>
                                Continue Learning
                            </button>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </>
    );
}
