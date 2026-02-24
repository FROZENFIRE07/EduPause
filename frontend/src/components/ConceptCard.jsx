import clsx from 'clsx';
import './ConceptCard.css';

function getMasteryLevel(score) {
    if (score >= 90) return 'mastered';
    if (score >= 70) return 'advanced';
    if (score >= 40) return 'intermediate';
    if (score >= 10) return 'beginner';
    return 'none';
}

function getMasteryLabel(level) {
    return { mastered: 'Mastered', advanced: 'Advanced', intermediate: 'Intermediate', beginner: 'Beginner', none: 'Not Started' }[level];
}

export default function ConceptCard({ concept, mastery = 0, prerequisites = [], onClick }) {
    const level = getMasteryLevel(mastery);

    return (
        <button
            className={clsx('concept-card glass-card', `concept-card--${level}`, { 'concept-card--glow': mastery >= 70 })}
            onClick={() => onClick?.(concept)}
        >
            <div className="concept-card-header">
                <span className="concept-card-name">{concept?.label || concept}</span>
                <span className={clsx('badge', `badge-mastery--${level}`)}>{getMasteryLabel(level)}</span>
            </div>
            <div className="concept-card-progress">
                <div className="progress-bar">
                    <div
                        className="progress-bar-fill"
                        style={{
                            width: `${mastery}%`,
                            background: level === 'mastered' ? 'var(--gradient-gold)' : 'var(--gradient-primary)',
                        }}
                    />
                </div>
                <span className="concept-card-score">{mastery}%</span>
            </div>
            {prerequisites.length > 0 && (
                <div className="concept-card-prereqs">
                    <span className="concept-card-prereqs-label">Prerequisites:</span>
                    {prerequisites.map((p, i) => (
                        <span key={i} className="concept-card-prereq-tag">{p}</span>
                    ))}
                </div>
            )}
        </button>
    );
}
