/**
 * QuizModal — Checkpoint-based quiz modal component
 * Appears after video completion (non-intrusive)
 * Displays 3 questions: easy, medium, hard
 */

import React, { useState } from 'react';
import './QuizModal.css';

const QuizModal = ({ quiz, quizSessionId, onSubmit, onSkip, onClose }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [evaluationResults, setEvaluationResults] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    return null;
  }

  const questions = quiz.questions;
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const hasAnsweredCurrent = selectedAnswers[currentQuestionIndex] !== undefined;

  const difficultyColors = {
    easy: '#4ade80',
    medium: '#fbbf24',
    hard: '#f87171'
  };

  const handleSelectAnswer = (answerIndex) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [currentQuestionIndex]: answerIndex
    });
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    // Convert selectedAnswers object to array format
    const responses = Object.keys(selectedAnswers).map(qIndex => ({
      questionIndex: parseInt(qIndex),
      answerIndex: selectedAnswers[qIndex]
    }));

    if (responses.length === 0) {
      alert('Please answer at least one question before submitting');
      return;
    }

    setIsSubmitting(true);
    const results = await onSubmit(quizSessionId, responses);
    setEvaluationResults(results);
    setShowResults(true);
    setIsSubmitting(false);
  };

  const handleSkip = async () => {
    if (confirm('Are you sure you want to skip this quiz? You can always review the concepts later.')) {
      await onSkip(quizSessionId);
      onClose();
    }
  };

  const getScoreColor = (percentage) => {
    if (percentage >= 80) return '#4ade80';
    if (percentage >= 60) return '#fbbf24';
    return '#f87171';
  };

  // Results View
  if (showResults && evaluationResults) {
    const { correctCount, totalQuestions, percentageCorrect, passed, evaluations } = evaluationResults;
    
    return (
      <div className="quiz-modal-overlay" onClick={onClose}>
        <div className="quiz-modal" onClick={(e) => e.stopPropagation()}>
          <div className="quiz-results">
            <div className="quiz-results-header">
              <div className="quiz-trophy-icon">{passed ? '🏆' : '📚'}</div>
              <h2>{passed ? 'Great Job!' : 'Keep Learning!'}</h2>
              <div 
                className="quiz-score-big" 
                style={{ color: getScoreColor(percentageCorrect) }}
              >
                {correctCount}/{totalQuestions}
              </div>
              <p className="quiz-score-text">
                {percentageCorrect.toFixed(0)}% Correct
              </p>
            </div>

            <div className="quiz-results-breakdown">
              <h3>Question Breakdown</h3>
              {evaluations.map((resultItem, idx) => (
                <div key={idx} className={`quiz-result-item ${resultItem.isCorrect ? 'correct' : 'incorrect'}`}>
                  <div className="quiz-result-header">
                    <span className="quiz-result-icon">
                      {resultItem.isCorrect ? '✅' : '❌'}
                    </span>
                    <span className="quiz-result-difficulty">{resultItem.difficulty}</span>
                    <span className="quiz-result-score">
                      {resultItem.isCorrect ? `+${resultItem.score.toFixed(0)}` : '0'}
                    </span>
                  </div>
                  <div className="quiz-result-question">{resultItem.question}</div>
                  {!resultItem.isCorrect && (
                    <div className="quiz-result-explanation">
                      <strong>💡 </strong>{resultItem.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="quiz-results-actions">
              <button className="quiz-btn quiz-btn-primary" onClick={onClose}>
                Continue Learning
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Quiz Taking View
  return (
    <div className="quiz-modal-overlay">
      <div className="quiz-modal">
        <div className="quiz-header">
          <div className="quiz-title">
            <span className="quiz-icon">📝</span>
            <div>
              <h2>Checkpoint Quiz</h2>
              <p className="quiz-subtitle">{quiz.video_title || quiz.concept}</p>
            </div>
          </div>
          <button className="quiz-close-btn" onClick={handleSkip}>
            Skip
          </button>
        </div>

        <div className="quiz-progress">
          <div className="quiz-progress-text">
            Question {currentQuestionIndex + 1} of {questions.length}
          </div>
          <div className="quiz-progress-bar">
            <div 
              className="quiz-progress-fill" 
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="quiz-content">
          <div className="quiz-difficulty-badge" style={{ backgroundColor: difficultyColors[currentQuestion.difficulty] }}>
            {currentQuestion.difficulty}
          </div>

          <div className="quiz-question">
            {currentQuestion.question}
          </div>

          <div className="quiz-options">
            {currentQuestion.options.map((option, idx) => (
              <button
                key={idx}
                className={`quiz-option ${selectedAnswers[currentQuestionIndex] === idx ? 'selected' : ''}`}
                onClick={() => handleSelectAnswer(idx)}
              >
                <span className="quiz-option-letter">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="quiz-option-text">{option}</span>
                {selectedAnswers[currentQuestionIndex] === idx && (
                  <span className="quiz-option-check">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="quiz-footer">
          <div className="quiz-answer-status">
            {Object.keys(selectedAnswers).length} / {questions.length} answered
          </div>

          <div className="quiz-actions">
            <button 
              className="quiz-btn quiz-btn-secondary" 
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
            >
              ← Previous
            </button>

            {!isLastQuestion ? (
              <button 
                className="quiz-btn quiz-btn-primary" 
                onClick={handleNext}
                disabled={!hasAnsweredCurrent}
              >
                Next →
              </button>
            ) : (
              <button 
                className="quiz-btn quiz-btn-success" 
                onClick={handleSubmit}
                disabled={isSubmitting || Object.keys(selectedAnswers).length === 0}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizModal;
