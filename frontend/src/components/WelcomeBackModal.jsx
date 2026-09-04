/**
 * WelcomeBackModal — Break recovery UI
 * Shows when user returns after 2+ day break
 * Displays recap, last position, and next steps
 */

import React, { useState, useEffect } from 'react';
import { checkRecapNeeded, generateRecap, markRecapViewed } from '../api';
import './WelcomeBackModal.css';

const WelcomeBackModal = ({ userId, playlistId, onClose, onContinue }) => {
  const [recap, setRecap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAndLoadRecap();
  }, [userId, playlistId]);

  const checkAndLoadRecap = async () => {
    try {
      setLoading(true);
      
      // Check if recap needed
      const checkResponse = await checkRecapNeeded(userId, playlistId);
      
      if (!checkResponse.data.shouldShow) {
        // No recap needed, close modal
        onClose();
        return;
      }

      // Generate recap
      const recapResponse = await generateRecap(userId, playlistId);
      setRecap(recapResponse.data);
      setError(null);
    } catch (err) {
      console.error('Failed to load recap:', err);
      setError('Failed to load recap');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    // Mark as viewed
    try {
      await markRecapViewed(userId, playlistId);
    } catch (err) {
      console.error('Failed to mark recap viewed:', err);
    }

    // Call continue callback with last position
    if (onContinue && recap?.lastPosition) {
      onContinue(recap.lastPosition);
    }
    
    onClose();
  };

  const handleSkip = () => {
    onClose();
  };

  if (loading) {
    return (
      <div className="welcome-modal-overlay">
        <div className="welcome-modal">
          <div className="welcome-loading">
            <div className="spinner"></div>
            <p>Preparing your recap...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !recap || !recap.isBreak) {
    return null;
  }

  const { daysSince, lastConcepts, lastVideo, recapSummary, stats } = recap;

  return (
    <div className="welcome-modal-overlay">
      <div className="welcome-modal">
        <div className="welcome-header">
          <div className="welcome-emoji">👋</div>
          <h2>Welcome Back!</h2>
          <p className="welcome-subtitle">
            It's been <strong>{daysSince} {daysSince === 1 ? 'day' : 'days'}</strong> since your last session
          </p>
        </div>

        <div className="welcome-content">
          {/* AI-Generated Recap */}
          <div className="recap-section">
            <h3>📖 Quick Recap</h3>
            <p className="recap-text">{recapSummary}</p>
          </div>

          {/* Last Video */}
          {lastVideo && (
            <div className="last-video-section">
              <h3>🎥 Last Watched</h3>
              <div className="last-video-card">
                {lastVideo.thumbnail && (
                  <img 
                    src={lastVideo.thumbnail} 
                    alt={lastVideo.title}
                    className="video-thumbnail"
                  />
                )}
                <div className="video-info">
                  <div className="video-title">{lastVideo.title}</div>
                </div>
              </div>
            </div>
          )}

          {/* Last Concepts */}
          {lastConcepts && lastConcepts.length > 0 && (
            <div className="concepts-section">
              <h3>🎯 Recent Concepts</h3>
              <div className="concepts-list">
                {lastConcepts.slice(0, 3).map((concept) => (
                  <div key={concept.id} className="concept-badge">
                    <span className="concept-name">{concept.id}</span>
                    <span 
                      className={`concept-confidence ${concept.confidence}`}
                      title={`${concept.exposure} exposures`}
                    >
                      {concept.confidence}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats Summary */}
          {stats && (
            <div className="stats-section">
              <div className="stat-card">
                <div className="stat-value">{stats.videosCompleted || 0}</div>
                <div className="stat-label">Videos</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.conceptsMastered || 0}</div>
                <div className="stat-label">Mastered</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.quizzesTaken || 0}</div>
                <div className="stat-label">Quizzes</div>
              </div>
            </div>
          )}
        </div>

        <div className="welcome-actions">
          <button className="welcome-btn welcome-btn-secondary" onClick={handleSkip}>
            Start Fresh
          </button>
          <button className="welcome-btn welcome-btn-primary" onClick={handleContinue}>
            Continue Learning →
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeBackModal;
