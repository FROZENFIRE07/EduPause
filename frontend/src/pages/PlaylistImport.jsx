import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ReactConfetti from 'react-confetti';
import { FiUploadCloud, FiPlay, FiCpu, FiBookOpen, FiCheck, FiChevronDown, FiChevronUp, FiZap, FiBarChart2, FiLayers, FiAward } from 'react-icons/fi';
import { ingestPlaylist, getIngestionStatus } from '../api';
import { useAppStore } from '../store';
import './PlaylistImport.css';

const PIPELINE_STEPS = [
    { label: 'Fetch Metadata', icon: <FiUploadCloud /> },
    { label: 'Extract Content', icon: <FiCpu /> },
    { label: 'Build Knowledge', icon: <FiBookOpen /> },
    { label: 'Ready to Learn', icon: <FiPlay /> },
];

const SAMPLE_PLAYLISTS = [
    { title: '3Blue1Brown — Neural Networks', url: 'https://www.youtube.com/playlist?list=PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi', videos: 4, difficulty: 'Intermediate' },
    { title: 'MIT 6.006 — Algorithms', url: 'https://www.youtube.com/playlist?list=PLUl4u3cNGP63EdVPNLG3ToM6LaEUuStEY', videos: 34, difficulty: 'Advanced' },
    { title: 'CS50 — Introduction', url: 'https://www.youtube.com/playlist?list=PLhQjrBD2T381WAHyx1pq-sBfykqMBI7V4', videos: 26, difficulty: 'Beginner' },
];

const HOW_IT_WORKS = [
    { icon: <FiUploadCloud size={24} />, title: 'Paste a Link', desc: 'Drop any YouTube playlist URL and we\'ll handle the rest.' },
    { icon: <FiCpu size={24} />, title: 'AI Analysis', desc: 'We extract concepts, map dependencies, and build your knowledge graph.' },
    { icon: <FiLayers size={24} />, title: 'Smart Structure', desc: 'Content is organized into an optimal learning path just for you.' },
    { icon: <FiAward size={24} />, title: 'Learn & Master', desc: 'Track your mastery through quizzes, reviews, and active learning.' },
];

const FAQ = [
    { q: 'What types of playlists work best?', a: 'Educational playlists with structured, sequential content work best — think lecture series, tutorials, and courses. We support any public YouTube playlist.' },
    { q: 'How does the AI build a knowledge graph?', a: 'We analyze transcripts, titles, and descriptions to extract key concepts, then map relationships and dependencies between them using NLP.' },
    { q: 'Can I import multiple playlists?', a: 'Absolutely! Each playlist creates its own learning path. Overlapping concepts are automatically linked across playlists.' },
    { q: 'Is my data private?', a: 'Yes. All data is processed locally and stored in your browser. We never share your learning data with third parties.' },
];



export default function PlaylistImport() {
    const [playlistUrl, setPlaylistUrl] = useState('');
    const [status, setStatus] = useState('idle');
    const [pipelineStep, setPipelineStep] = useState(0);
    const [error, setError] = useState('');
    const [showConfetti, setShowConfetti] = useState(false);
    const [openFaq, setOpenFaq] = useState(null);
    const [typedText, setTypedText] = useState('');
    const navigate = useNavigate();
    const setCurrentPlaylist = useAppStore(s => s.setCurrentPlaylist);
    const addSavedPlaylist = useAppStore(s => s.addSavedPlaylist);

    const headline = 'Transform any playlist into mastery.';

    // Typing animation
    useEffect(() => {
        let i = 0;
        const interval = setInterval(() => {
            if (i <= headline.length) {
                setTypedText(headline.slice(0, i));
                i++;
            } else {
                clearInterval(interval);
            }
        }, 50);
        return () => clearInterval(interval);
    }, []);

    const handleIngest = useCallback(async () => {
        if (!playlistUrl.trim()) return;
        setStatus('loading');
        setError('');
        setPipelineStep(0);

        try {
            const res = await ingestPlaylist(playlistUrl);
            const jobId = res.data?.jobId;

            // Simulate pipeline progress
            const stepInterval = setInterval(() => {
                setPipelineStep(prev => {
                    if (prev >= PIPELINE_STEPS.length - 1) {
                        clearInterval(stepInterval);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 2000);

            // Poll for status
            if (jobId) {
                const pollInterval = setInterval(async () => {
                    try {
                        const statusRes = await getIngestionStatus(jobId);
                        if (statusRes.data?.status === 'complete') {
                            clearInterval(pollInterval);
                            clearInterval(stepInterval);
                            setPipelineStep(PIPELINE_STEPS.length - 1);
                            setStatus('success');
                            setShowConfetti(true);
                            setTimeout(() => setShowConfetti(false), 5000);
                            // Save video list to store so LearningSession can use it
                            if (statusRes.data?.videos?.length) {
                                setCurrentPlaylist(statusRes.data.videos);
                                // Save permanently to savedPlaylists
                                addSavedPlaylist({
                                    title: statusRes.data.videos[0]?.title?.split(' - ')[0] || 'Imported Playlist',
                                    url: playlistUrl,
                                    videos: statusRes.data.videos,
                                });
                            }
                        } else if (statusRes.data?.status === 'failed' || statusRes.data?.status === 'error') {
                            clearInterval(pollInterval);
                            clearInterval(stepInterval);
                            setError(statusRes.data?.error || 'Ingestion failed. Please try again.');
                            setStatus('idle');
                        }
                    } catch {
                        clearInterval(pollInterval);
                    }
                }, 3000);
            } else {
                // No jobId returned — shouldn't happen but handle gracefully
                setTimeout(() => {
                    clearInterval(stepInterval);
                    setPipelineStep(PIPELINE_STEPS.length - 1);
                    setStatus('success');
                    setShowConfetti(true);
                    setTimeout(() => setShowConfetti(false), 5000);
                }, 8000);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to start ingestion');
            setStatus('idle');
        }
    }, [playlistUrl, setCurrentPlaylist]);

    const useSample = (url) => {
        setPlaylistUrl(url);
        setStatus('idle');
        setError('');
    };

    return (
        <div className="page playlist-import">
            {showConfetti && (
                <ReactConfetti
                    width={window.innerWidth}
                    height={window.innerHeight}
                    recycle={false}
                    numberOfPieces={300}
                    colors={['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899']}
                    style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999, pointerEvents: 'none' }}
                />
            )}

            {/* ===== FLOATING PARTICLES ===== */}
            <div className="pi-particles" aria-hidden="true">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="pi-particle" style={{ '--delay': `${i * 2}s`, '--x': `${15 + i * 14}%` }} />
                ))}
            </div>

            {/* ===== HERO ===== */}
            <section className="pi-hero">
                <div className="container">
                    <div className="pi-hero-content">
                        <span className="badge badge-primary animate-fade-in-up">
                            <FiZap size={12} /> AI-Powered Learning
                        </span>
                        <h1 className="heading-xl pi-headline">
                            <span className="pi-typed">{typedText}</span>
                            <span className="pi-cursor" />
                        </h1>




                        {/* Input form */}
                        <div className="pi-input-row animate-fade-in-up stagger-4">
                            <div className="pi-input-wrapper">
                                <FiUploadCloud className="pi-input-icon" size={18} />
                                <input
                                    type="url"
                                    className="input input-large pi-url-input"
                                    placeholder="Paste YouTube playlist URL..."
                                    value={playlistUrl}
                                    onChange={e => setPlaylistUrl(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleIngest()}
                                    disabled={status === 'loading'}
                                />
                            </div>
                            <button
                                className="btn btn-primary btn-lg pi-go-btn"
                                onClick={handleIngest}
                                disabled={!playlistUrl.trim() || status === 'loading'}
                            >
                                {status === 'loading' ? (
                                    <><span className="pi-spinner" /> Processing...</>
                                ) : status === 'success' ? (
                                    <><FiCheck /> Done!</>
                                ) : (
                                    <><FiZap /> Start Learning</>
                                )}
                            </button>
                        </div>

                        {error && <p className="pi-error animate-shake">{error}</p>}
                    </div>
                </div>
            </section>

            {/* ===== PIPELINE ===== */}
            {status !== 'idle' && (
                <section className="pi-pipeline container animate-fade-in-up">
                    <div className="pi-pipeline-track">
                        {PIPELINE_STEPS.map((step, i) => (
                            <div key={i} className={`pi-pipe-step ${i <= pipelineStep ? 'active' : ''} ${i === pipelineStep ? 'current' : ''}`}>
                                <div className="pi-pipe-icon">{i < pipelineStep ? <FiCheck /> : step.icon}</div>
                                <span className="pi-pipe-label">{step.label}</span>
                                {i < PIPELINE_STEPS.length - 1 && (
                                    <div className={`pi-pipe-line ${i < pipelineStep ? 'filled' : ''}`}>
                                        {i === pipelineStep && <div className="pi-pipe-particle" />}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    {status === 'success' && (
                        <motion.div
                            className="pi-success-msg"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <span>🎉</span>
                            <p>Your learning path is ready!</p>
                            <button className="btn btn-primary" onClick={() => navigate('/learn')}>
                                Start Learning
                            </button>
                        </motion.div>
                    )}
                </section>
            )}

            {/* ===== SAMPLE PLAYLISTS ===== */}
            <section className="pi-samples container">
                <h2 className="heading-md pi-section-title">Recommendation</h2>
                <div className="pi-sample-grid">
                    {SAMPLE_PLAYLISTS.map((p, i) => (
                        <button
                            key={i}
                            className="pi-sample-card glass-card"
                            onClick={() => useSample(p.url)}
                        >
                            <div className="pi-sample-header">
                                <span className="pi-sample-title">{p.title}</span>
                                <span className={`badge ${p.difficulty === 'Beginner' ? 'badge-success' : p.difficulty === 'Intermediate' ? 'badge-primary' : 'badge-warning'}`}>
                                    {p.difficulty}
                                </span>
                            </div>
                            <span className="pi-sample-meta">{p.videos} videos</span>
                        </button>
                    ))}
                </div>
            </section>

            {/* ===== HOW IT WORKS ===== */}
            <section className="pi-how container">
                <h2 className="heading-lg pi-section-title">How It Works</h2>
                <div className="pi-how-grid">
                    {HOW_IT_WORKS.map((item, i) => (
                        <div key={i} className="pi-how-card glass-card-static animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                            <div className="pi-how-icon">{item.icon}</div>
                            <h3 className="heading-md">{item.title}</h3>
                            <p className="pi-how-desc">{item.desc}</p>
                            <span className="pi-how-step">Step {i + 1}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* ===== FAQ ===== */}
            <section className="pi-faq container">
                <h2 className="heading-lg pi-section-title">Frequently Asked Questions</h2>
                <div className="accordion">
                    {FAQ.map((item, i) => (
                        <div key={i} className="accordion-item">
                            <button
                                className="accordion-trigger"
                                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                aria-expanded={openFaq === i}
                            >
                                {item.q}
                                {openFaq === i ? <FiChevronUp /> : <FiChevronDown />}
                            </button>
                            {openFaq === i && (
                                <div className="accordion-content animate-fade-in">
                                    {item.a}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            <div style={{ height: 80 }} />
        </div>
    );
}
