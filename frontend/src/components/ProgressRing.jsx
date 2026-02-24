import { useState, useEffect } from 'react';
import './ProgressRing.css';

export default function ProgressRing({
    progress = 0,
    size = 120,
    strokeWidth = 8,
    color = 'var(--accent-primary)',
    showLabel = true,
    animated = true,
    glowEffect = false,
    label,
}) {
    const [animatedProgress, setAnimatedProgress] = useState(0);
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (animatedProgress / 100) * circumference;

    useEffect(() => {
        if (animated) {
            const timer = setTimeout(() => setAnimatedProgress(progress), 100);
            return () => clearTimeout(timer);
        } else {
            setAnimatedProgress(progress);
        }
    }, [progress, animated]);

    return (
        <div className={`progress-ring-wrapper ${glowEffect ? 'glow' : ''}`} style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="var(--bg-secondary)"
                    strokeWidth={strokeWidth}
                />
                {/* Progress circle */}
                <circle
                    className="progress-ring-circle"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={{
                        transition: animated ? 'stroke-dashoffset 1s ease-out' : 'none',
                        filter: glowEffect ? `drop-shadow(0 0 6px ${color})` : 'none',
                    }}
                />
            </svg>
            {showLabel && (
                <div className="progress-ring-label">
                    <span className="progress-ring-value">{Math.round(animatedProgress)}%</span>
                    {label && <span className="progress-ring-sublabel">{label}</span>}
                </div>
            )}
        </div>
    );
}
