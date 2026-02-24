import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowRight, FiBookOpen, FiTarget, FiHeart, FiCheck, FiUser, FiUsers } from 'react-icons/fi';
import { useAppStore } from '../store';
import './Onboarding.css';

const LEARNING_STYLES = [
    { id: 'visual', icon: '👁️', label: 'Visual', desc: 'I learn by seeing diagrams and charts' },
    { id: 'auditory', icon: '🎧', label: 'Auditory', desc: 'I learn by listening and discussing' },
    { id: 'reading', icon: '📖', label: 'Reading', desc: 'I learn by reading and taking notes' },
    { id: 'kinesthetic', icon: '🛠️', label: 'Hands-On', desc: 'I learn by doing and experimenting' },
];

const ROLES = [
    { id: 'student', icon: '🎓', reactIcon: FiUser, label: 'Student', desc: 'I\'m here to learn new skills and track my progress' },
    { id: 'tutor', icon: '👨‍🏫', reactIcon: FiUsers, label: 'Tutor', desc: 'I\'m here to create learning paths and guide students' },
];

const TOPICS = [
    '🧠 Machine Learning', '📊 Data Science', '💻 Programming',
    '🔢 Mathematics', '🎨 Design', '📱 Mobile Dev',
    '☁️ Cloud Computing', '🔒 Cybersecurity', '🤖 AI/Deep Learning',
    '📈 Statistics', '🌐 Web Dev', '🗄️ Databases',
];

const STEPS = [
    { title: 'Welcome to EduPause', subtitle: 'Your AI-powered learning companion' },
    { title: 'I am a...', subtitle: 'Tell us your role so we can tailor your experience' },
    { title: 'How do you learn best?', subtitle: 'This helps us personalize your experience' },
    { title: 'Set your goal', subtitle: 'How much time can you dedicate daily?' },
    { title: 'What interests you?', subtitle: 'Select topics you want to explore' },
    { title: "You're all set!", subtitle: 'Let\'s start your learning journey' },
];

export default function Onboarding() {
    const [step, setStep] = useState(0);
    const [name, setName] = useState('');
    const [selectedRole, setSelectedRole] = useState(null);
    const [selectedStyle, setSelectedStyle] = useState(null);
    const [dailyGoal, setDailyGoal] = useState(30);
    const [selectedTopics, setSelectedTopics] = useState([]);

    const { setOnboardingComplete, setUserName, setUserRole, setLearningStyle, setDailyGoal: storeDailyGoal, setInterests } = useAppStore();

    const nextStep = () => {
        if (step < STEPS.length - 1) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 0) setStep(step - 1);
    };

    const handleFinish = () => {
        if (name.trim()) setUserName(name.trim());
        if (selectedRole) setUserRole(selectedRole);
        if (selectedStyle) setLearningStyle(selectedStyle);
        storeDailyGoal(dailyGoal);
        setInterests(selectedTopics);
        setOnboardingComplete(true);
    };

    const toggleTopic = (topic) => {
        setSelectedTopics(prev =>
            prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
        );
    };

    return (
        <div className="onboarding-overlay">
            <div className="onboarding-container glass-card-static">
                {/* Progress dots */}
                <div className="onb-progress">
                    {STEPS.map((_, i) => (
                        <div key={i} className={`onb-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} />
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.3 }}
                        className="onb-step"
                    >
                        <h2 className="heading-lg">{STEPS[step].title}</h2>
                        <p className="onb-subtitle">{STEPS[step].subtitle}</p>

                        {/* Step 0: Welcome + Name */}
                        {step === 0 && (
                            <div className="onb-content">
                                <div className="onb-welcome-icon animate-float">🚀</div>
                                <div className="input-group" style={{ maxWidth: 320 }}>
                                    <label htmlFor="onb-name">What should we call you?</label>
                                    <input
                                        id="onb-name"
                                        className="input input-large"
                                        type="text"
                                        placeholder="Your name"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 1: Role Selection */}
                        {step === 1 && (
                            <div className="onb-content">
                                <div className="onb-role-grid">
                                    {ROLES.map(role => (
                                        <button
                                            key={role.id}
                                            className={`onb-role-card ${selectedRole === role.id ? 'selected' : ''}`}
                                            onClick={() => setSelectedRole(role.id)}
                                        >
                                            <span className="onb-role-emoji">{role.icon}</span>
                                            <span className="onb-style-label">{role.label}</span>
                                            <span className="onb-style-desc">{role.desc}</span>
                                            {selectedRole === role.id && <FiCheck className="onb-style-check" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 2: Learning Style */}
                        {step === 2 && (
                            <div className="onb-content">
                                <div className="onb-style-grid">
                                    {LEARNING_STYLES.map(style => (
                                        <button
                                            key={style.id}
                                            className={`onb-style-card ${selectedStyle === style.id ? 'selected' : ''}`}
                                            onClick={() => setSelectedStyle(style.id)}
                                        >
                                            <span className="onb-style-icon">{style.icon}</span>
                                            <span className="onb-style-label">{style.label}</span>
                                            <span className="onb-style-desc">{style.desc}</span>
                                            {selectedStyle === style.id && <FiCheck className="onb-style-check" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 3: Daily Goal */}
                        {step === 3 && (
                            <div className="onb-content">
                                <div className="onb-goal-display">
                                    <span className="onb-goal-value">{dailyGoal}</span>
                                    <span className="onb-goal-unit">min / day</span>
                                </div>
                                <input
                                    type="range"
                                    className="onb-range"
                                    min={10}
                                    max={120}
                                    step={5}
                                    value={dailyGoal}
                                    onChange={e => setDailyGoal(Number(e.target.value))}
                                />
                                <div className="onb-range-labels">
                                    <span>10 min</span>
                                    <span>1 hour</span>
                                    <span>2 hours</span>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Topics */}
                        {step === 4 && (
                            <div className="onb-content">
                                <div className="onb-topics-grid">
                                    {TOPICS.map(topic => (
                                        <button
                                            key={topic}
                                            className={`onb-topic-chip ${selectedTopics.includes(topic) ? 'selected' : ''}`}
                                            onClick={() => toggleTopic(topic)}
                                        >
                                            {topic}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 5: Ready */}
                        {step === 5 && (
                            <div className="onb-content">
                                <div className="onb-ready-icon animate-bounce-in">🎉</div>
                                <div className="onb-ready-summary">
                                    {name && <p>Welcome, <strong className="text-gradient">{name}</strong>!</p>}
                                    {selectedRole && <p>Role: <strong>{ROLES.find(r => r.id === selectedRole)?.label}</strong></p>}
                                    {selectedStyle && <p>Learning style: <strong>{LEARNING_STYLES.find(s => s.id === selectedStyle)?.label}</strong></p>}
                                    <p>Daily goal: <strong>{dailyGoal} minutes</strong></p>
                                    {selectedTopics.length > 0 && <p>Interests: <strong>{selectedTopics.length} topics</strong></p>}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div className="onb-actions">
                    {step > 0 && (
                        <button className="btn btn-ghost" onClick={prevStep}>Back</button>
                    )}
                    {step === 0 && (
                        <button className="btn btn-ghost" onClick={handleFinish}>Skip</button>
                    )}
                    <div style={{ flex: 1 }} />
                    {step < STEPS.length - 1 ? (
                        <button className="btn btn-primary" onClick={nextStep}>
                            Continue <FiArrowRight size={16} />
                        </button>
                    ) : (
                        <button className="btn btn-primary btn-lg" onClick={handleFinish}>
                            Start Learning <FiArrowRight size={16} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
