/**
 * ProgressHeatmap — Visual concept mastery heatmap
 * Shows skills colored by confidence: gray (not seen), red (low), yellow (medium), green (high)
 * Interactive: click concept to see details
 */

import React, { useState, useEffect } from 'react';
import { getProgressVisualization } from '../api';
import './ProgressHeatmap.css';

const ProgressHeatmap = ({ userId, playlistId }) => {
  const [vizData, setVizData] = useState(null);
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // grid or list

  useEffect(() => {
    if (userId && playlistId) {
      loadVisualization();
    }
  }, [userId, playlistId]);

  const loadVisualization = async () => {
    try {
      setLoading(true);
      const response = await getProgressVisualization(userId, playlistId);
      setVizData(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to load progress visualization:', err);
      setError('Failed to load progress data');
    } finally {
      setLoading(false);
    }
  };

  const handleConceptClick = (concept) => {
    setSelectedConcept(concept);
  };

  const closeModal = () => {
    setSelectedConcept(null);
  };

  if (loading) {
    return (
      <div className="progress-heatmap">
        <div className="heatmap-loading">
          <div className="spinner"></div>
          <p>Loading mastery data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="progress-heatmap">
        <div className="heatmap-error">
          <span className="error-icon">⚠️</span>
          <p>{error}</p>
          <button onClick={loadVisualization} className="retry-btn">Retry</button>
        </div>
      </div>
    );
  }

  if (!vizData || vizData.nodes.length === 0) {
    return (
      <div className="progress-heatmap">
        <div className="heatmap-empty">
          <span className="empty-icon">📊</span>
          <p>No concepts tracked yet</p>
          <p className="empty-hint">Start watching videos to see your progress here</p>
        </div>
      </div>
    );
  }

  const { nodes, grouped, summary } = vizData;

  return (
    <div className="progress-heatmap">
      <div className="heatmap-header">
        <div className="heatmap-title">
          <h3>Concept Mastery</h3>
          <p className="heatmap-subtitle">
            {summary.total} concepts • {summary.high} mastered • {summary.medium} in progress
          </p>
        </div>

        <div className="heatmap-controls">
          <button
            className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
          >
            Grid
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            List
          </button>
        </div>
      </div>

      <div className="heatmap-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#4ade80' }}></span>
          <span>High ({summary.high})</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#fbbf24' }}></span>
          <span>Medium ({summary.medium})</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#f87171' }}></span>
          <span>Low ({summary.low})</span>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="heatmap-grid">
          {nodes.map((concept) => (
            <div
              key={concept.id}
              className="heatmap-cell"
              style={{
                background: `linear-gradient(135deg, ${concept.color}22, ${concept.color}44)`,
                borderColor: concept.color,
              }}
              onClick={() => handleConceptClick(concept)}
            >
              <div className="cell-label">{concept.label}</div>
              <div className="cell-score">
                {(concept.confidenceScore * 100).toFixed(0)}%
              </div>
              <div
                className="cell-confidence"
                style={{ background: concept.color }}
              >
                {concept.confidence}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="heatmap-list">
          {['high', 'medium', 'low'].map((level) => {
            const concepts = grouped[level];
            if (concepts.length === 0) return null;

            return (
              <div key={level} className="heatmap-section">
                <h4 className="section-title">
                  {level.charAt(0).toUpperCase() + level.slice(1)} Confidence ({concepts.length})
                </h4>
                <div className="section-concepts">
                  {concepts.map((concept) => (
                    <div
                      key={concept.id}
                      className="list-concept"
                      onClick={() => handleConceptClick(concept)}
                    >
                      <div
                        className="list-indicator"
                        style={{ background: concept.color }}
                      ></div>
                      <div className="list-info">
                        <div className="list-label">{concept.label}</div>
                        <div className="list-stats">
                          {concept.exposureCount} exposures • {concept.quizAttempts} quizzes
                        </div>
                      </div>
                      <div className="list-score">
                        {(concept.confidenceScore * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Concept Detail Modal */}
      {selectedConcept && (
        <div className="concept-modal-overlay" onClick={closeModal}>
          <div className="concept-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>×</button>
            
            <div className="modal-header">
              <h3>{selectedConcept.label}</h3>
              <div
                className="modal-badge"
                style={{ background: selectedConcept.color }}
              >
                {selectedConcept.confidence}
              </div>
            </div>

            <div className="modal-score">
              <div className="score-circle">
                <svg viewBox="0 0 100 100" className="score-svg">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={selectedConcept.color}
                    strokeWidth="8"
                    strokeDasharray={`${selectedConcept.confidenceScore * 251.2} 251.2`}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="score-text">
                  {(selectedConcept.confidenceScore * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            <div className="modal-stats">
              <div className="stat-item">
                <div className="stat-label">Exposures</div>
                <div className="stat-value">{selectedConcept.exposureCount}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Quiz Attempts</div>
                <div className="stat-value">{selectedConcept.quizAttempts}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Confidence</div>
                <div className="stat-value" style={{ color: selectedConcept.color }}>
                  {selectedConcept.confidence}
                </div>
              </div>
            </div>

            {selectedConcept.lastUpdated && (
              <div className="modal-footer">
                Last updated: {new Date(selectedConcept.lastUpdated).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressHeatmap;
