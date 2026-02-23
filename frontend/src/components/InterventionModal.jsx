import { useState } from 'react';
import { FiX, FiCheck, FiHelpCircle, FiSkipForward, FiStar } from 'react-icons/fi';
import './InterventionModal.css';

export default function InterventionModal({
    isOpen,
    intervention,
    onAnswer,
    onSkip,
    onClose,
}) {
    const [userAnswer, setUserAnswer] = useState('');
    const [feedback, setFeedback] = useState(null);
    const [selectedOption, setSelectedOption] = useState(null);

    if (!isOpen || !intervention) return null;

    const handleSubmit = () => {
        if (intervention.type === 'mcq') {
            onAnswer?.(selectedOption);
        } else {
            onAnswer?.(userAnswer);
        }
    };

    const handleSkip = () => {
        setUserAnswer('');
        setSelectedOption(null);
        setFeedback(null);
        onSkip?.();
    };

    return (
        <div className="modal-overlay animate-fade-in" onClick={onClose}>
            <div className="modal-content glass-card animate-fade-in-up" onClick={e => e.stopPropagation()}>
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
                    <button className="modal-close" onClick={onClose}>
                        <FiX size={18} />
                    </button>
                </div>

                {/* Question */}
                <div className="modal-body">
                    <div className="question-box">
                        <p className="question-text">{intervention.question}</p>
                    </div>

                    {/* MCQ options */}
                    {intervention.type === 'mcq' && intervention.options && (
                        <div className="options-grid">
                            {intervention.options.map((opt, i) => (
                                <button
                                    key={i}
                                    className={`option-card ${selectedOption === i ? 'selected' : ''} ${feedback && i === intervention.correctIndex ? 'correct' : ''
                                        } ${feedback && selectedOption === i && i !== intervention.correctIndex ? 'incorrect' : ''}`}
                                    onClick={() => !feedback && setSelectedOption(i)}
                                    disabled={!!feedback}
                                >
                                    <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                                    <span className="option-text">{opt}</span>
                                    {feedback && i === intervention.correctIndex && <FiCheck className="option-icon correct" />}
                                </button>
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
                    {intervention.hint && (
                        <div className="hint-box">
                            <FiStar size={14} />
                            <span><strong>Hint:</strong> {intervention.hint}</span>
                        </div>
                    )}

                    {/* Feedback */}
                    {feedback && (
                        <div className={`feedback-box ${feedback.correct ? 'correct' : 'incorrect'}`}>
                            <p>{feedback.message}</p>
                        </div>
                    )}
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
                        <button className="btn btn-primary" onClick={onClose}>
                            Continue Learning
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
