import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiPlay, FiBookOpen, FiAward, FiClock, FiTarget, FiZap, FiEdit3 } from 'react-icons/fi';
import SkillGraph from '../components/SkillGraph';
import ProgressRing from '../components/ProgressRing';
import { useAppStore } from '../store';
import { useAchievementToast } from '../components/AchievementToast';
import './Dashboard.css';

function getGreeting(name) {
    const hour = new Date().getHours();
    if (hour < 12) return `Good morning, ${name}`;
    if (hour < 17) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
}

function AnimatedCounter({ value, suffix = '' }) {
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        const num = parseInt(value) || 0;
        if (num === 0) { setDisplay(0); return; }
        let start = 0;
        const duration = 1200;
        const stepTime = 16;
        const steps = duration / stepTime;
        const increment = num / steps;

        const timer = setInterval(() => {
            start += increment;
            if (start >= num) {
                setDisplay(num);
                clearInterval(timer);
            } else {
                setDisplay(Math.floor(start));
            }
        }, stepTime);

        return () => clearInterval(timer);
    }, [value]);

    return <span>{display.toLocaleString()}{suffix}</span>;
}

export default function Dashboard() {
    const { userName, achievements, dailyGoal, notes } = useAppStore();
    const { triggerToast, ConfettiComponent } = useAchievementToast();

    const unlockedCount = achievements.filter(a => a.unlocked).length;
    const notesCount = Object.keys(notes || {}).length;
    const dailyProgress = 0; // Real: would come from session tracking

    const STATS = [
        { icon: <FiEdit3 />, value: notesCount, label: 'Notes Taken', color: '#6366f1' },
        { icon: <FiAward />, value: unlockedCount, label: 'Badges Earned', color: '#10b981' },
        { icon: <FiClock />, value: dailyGoal, label: 'Daily Goal (min)', color: '#06b6d4', suffix: 'm' },
        { icon: <FiTarget />, value: achievements.length, label: 'Total Badges', color: '#f59e0b' },
    ];

    return (
        <div className="page dashboard">
            {ConfettiComponent}

            {/* ===== HEADER ===== */}
            <section className="dash-header container">
                <div className="dash-header-left">
                    <h1 className="heading-xl animate-fade-in-up">{getGreeting(userName)} 👋</h1>
                    <p className="dash-header-desc animate-fade-in-up stagger-1">
                        Here's your learning progress at a glance.
                    </p>
                </div>
                <div className="dash-header-right animate-fade-in-up stagger-2">
                    <ProgressRing progress={dailyProgress} size={90} label="Daily" glowEffect />
                </div>
            </section>

            {/* Quick actions */}
            <section className="dash-actions container animate-fade-in-up stagger-2">
                <Link to="/learn" className="dash-action btn btn-primary">
                    <FiPlay size={16} />
                    Continue Learning
                </Link>
                <Link to="/" className="dash-action btn btn-secondary">
                    <FiBookOpen size={16} />
                    Import Playlist
                </Link>
            </section>

            {/* ===== BADGES BAR ===== */}
            <section className="dash-gamification container animate-fade-in-up stagger-3">
                <div className="dash-gami-card glass-card-static">
                    <div className="dash-gami-badges">
                        <FiAward size={16} />
                        <span>{unlockedCount}/{achievements.length} badges</span>
                    </div>
                </div>
            </section>

            {/* ===== STATS ===== */}
            <section className="dash-stats container">
                <div className="dash-stats-grid">
                    {STATS.map((s, i) => (
                        <div
                            key={i}
                            className="dash-stat-card glass-card animate-fade-in-up"
                            style={{ animationDelay: `${0.1 * i}s` }}
                        >
                            <div className="dash-stat-icon" style={{ color: s.color, background: `${s.color}15` }}>{s.icon}</div>
                            <div className="dash-stat-info">
                                <span className="dash-stat-value">
                                    <AnimatedCounter value={s.value} suffix={s.suffix || ''} />
                                </span>
                                <span className="dash-stat-label">{s.label}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ===== KNOWLEDGE MAP ===== */}
            <section className="dash-section container">
                <h2 className="heading-lg dash-section-title">
                    <FiZap size={20} />
                    Knowledge Map
                </h2>
                <SkillGraph />
            </section>

            {/* ===== ACHIEVEMENTS ===== */}
            <section className="dash-section container">
                <h2 className="heading-lg dash-section-title">
                    <FiAward size={20} />
                    Achievements
                </h2>
                <div className="dash-achievements-grid">
                    {achievements.map((a) => (
                        <div key={a.id} className={`dash-ach-card glass-card-static ${a.unlocked ? 'unlocked' : 'locked'}`}>
                            <span className="dash-ach-icon">{a.icon}</span>
                            <span className="dash-ach-title">{a.title}</span>
                            <span className="dash-ach-desc">{a.desc}</span>
                        </div>
                    ))}
                </div>
            </section>

            <div style={{ height: 60 }} />
        </div>
    );
}
