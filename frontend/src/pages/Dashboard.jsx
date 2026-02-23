import SkillGraph from '../components/SkillGraph';
import { FiTrendingUp, FiTarget, FiClock, FiAward, FiBookOpen, FiZap } from 'react-icons/fi';
import './Dashboard.css';

const STATS = [
    { icon: <FiBookOpen />, label: 'Concepts Learned', value: '8 / 12', color: 'var(--accent-primary)' },
    { icon: <FiTarget />, label: 'Avg. Mastery', value: '54%', color: 'var(--accent-secondary)' },
    { icon: <FiClock />, label: 'Study Time', value: '2h 34m', color: 'var(--accent-tertiary)' },
    { icon: <FiZap />, label: 'Interventions', value: '7 passed', color: 'var(--accent-success)' },
    { icon: <FiTrendingUp />, label: 'Streak', value: '3 days', color: 'var(--accent-warning)' },
    { icon: <FiAward />, label: 'Mastered', value: '2 concepts', color: '#fbbf24' },
];

const RECENT_ACTIVITY = [
    { action: 'Mastered', concept: 'Linear Algebra', time: '2 hours ago', type: 'mastered' },
    { action: 'Passed quiz', concept: 'Derivatives', time: '3 hours ago', type: 'success' },
    { action: 'Struggled with', concept: 'Backpropagation', time: '3 hours ago', type: 'struggle' },
    { action: 'Completed video', concept: 'Gradient Descent', time: 'Yesterday', type: 'neutral' },
    { action: 'Break recovery', concept: 'Chain Rule refresher', time: '3 days ago', type: 'recovery' },
];

export default function Dashboard() {
    return (
        <div className="page dashboard">
            <div className="container">
                {/* Header */}
                <section className="dash-header animate-fade-in-up">
                    <div>
                        <h1 className="heading-lg">Progress Dashboard</h1>
                        <p className="dash-subtitle">Your learning journey at a glance</p>
                    </div>
                </section>

                {/* Stats Grid */}
                <section className="stats-grid animate-fade-in-up stagger-1">
                    {STATS.map((s, i) => (
                        <div key={i} className="stat-card glass-card">
                            <div className="stat-icon" style={{ color: s.color, background: `${s.color}15` }}>
                                {s.icon}
                            </div>
                            <div className="stat-info">
                                <span className="stat-value">{s.value}</span>
                                <span className="stat-label">{s.label}</span>
                            </div>
                        </div>
                    ))}
                </section>

                {/* Knowledge Map */}
                <section className="dash-section animate-fade-in-up stagger-2">
                    <SkillGraph />
                </section>

                {/* Recent Activity */}
                <section className="dash-section animate-fade-in-up stagger-3">
                    <div className="activity-panel glass-card">
                        <h3 className="heading-md" style={{ padding: '20px 20px 0' }}>Recent Activity</h3>
                        <div className="activity-list">
                            {RECENT_ACTIVITY.map((a, i) => (
                                <div key={i} className="activity-item">
                                    <div className={`activity-dot ${a.type}`} />
                                    <div className="activity-info">
                                        <span className="activity-action">
                                            {a.action} <strong>{a.concept}</strong>
                                        </span>
                                        <span className="activity-time">{a.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
