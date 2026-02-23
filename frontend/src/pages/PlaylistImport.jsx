import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ingestPlaylist, getIngestionStatus } from '../api';
import { FiPlay, FiLink, FiChevronRight, FiDatabase, FiCpu, FiBookOpen, FiZap, FiCheckCircle, FiLoader, FiAlertCircle } from 'react-icons/fi';
import './PlaylistImport.css';

const SAMPLE_PLAYLISTS = [
    {
        title: 'Neural Networks — 3Blue1Brown',
        url: 'https://www.youtube.com/playlist?list=PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi',
        videos: 4,
        duration: '~1 hour',
    },
    {
        title: 'Machine Learning — StatQuest',
        url: 'https://www.youtube.com/playlist?list=PLblh5JKOoLUICTaGLRoHQDuF_7q2GfuJF',
        videos: 100,
        duration: '~20 hours',
    },
    {
        title: 'Calculus — Khan Academy',
        url: 'https://www.youtube.com/playlist?list=PLSQl0a2vh4HC5feHa6Rc5c0wbRTx56nF7',
        videos: 12,
        duration: '~3 hours',
    },
];

const PIPELINE_STEPS = [
    { icon: <FiLink />, label: 'Fetching playlist metadata' },
    { icon: <FiBookOpen />, label: 'Extracting video transcripts' },
    { icon: <FiCpu />, label: 'Chunking & summarizing with AI' },
    { icon: <FiDatabase />, label: 'Building knowledge graph' },
    { icon: <FiZap />, label: 'Generating embeddings' },
];

export default function PlaylistImport() {
    const navigate = useNavigate();
    const [playlistUrl, setPlaylistUrl] = useState('');
    const [isIngesting, setIsIngesting] = useState(false);
    const [currentStep, setCurrentStep] = useState(-1);
    const [complete, setComplete] = useState(false);
    const [error, setError] = useState(null);
    const [jobDetails, setJobDetails] = useState('');
    const pollingRef = useRef(null);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    const handleIngest = useCallback(async () => {
        if (!playlistUrl.trim()) return;
        setIsIngesting(true);
        setComplete(false);
        setError(null);
        setCurrentStep(0);

        try {
            // Call the real backend ingestion API
            const res = await ingestPlaylist(playlistUrl);
            const { jobId } = res.data;

            if (!jobId) {
                throw new Error('No jobId returned from backend');
            }

            // Poll for ingestion status
            pollingRef.current = setInterval(async () => {
                try {
                    const statusRes = await getIngestionStatus(jobId);
                    const job = statusRes.data;

                    // Update pipeline step (backend steps are 1-indexed, UI is 0-indexed)
                    setCurrentStep(Math.max(0, (job.step || 1) - 1));
                    setJobDetails(job.details || '');

                    if (job.status === 'complete') {
                        clearInterval(pollingRef.current);
                        pollingRef.current = null;
                        setComplete(true);
                        setIsIngesting(false);
                        setCurrentStep(PIPELINE_STEPS.length);

                        // Extract video data from job for navigation
                        // The backend stores videos in the job response
                        const videos = job.videos || [];
                        // Store in sessionStorage for the learning page
                        sessionStorage.setItem('masteryos_playlist', JSON.stringify({
                            playlistUrl,
                            videos,
                            videoCount: job.videoCount || videos.length,
                            jobId,
                        }));
                    } else if (job.status === 'error') {
                        clearInterval(pollingRef.current);
                        pollingRef.current = null;
                        setError(job.error || 'Ingestion failed');
                        setIsIngesting(false);
                    }
                } catch (pollErr) {
                    console.error('[Poll Error]', pollErr);
                }
            }, 2000);

        } catch (err) {
            console.error('[Ingest Error]', err);
            setError(err.response?.data?.error || err.message || 'Failed to start ingestion');
            setIsIngesting(false);
        }
    }, [playlistUrl]);

    const handleStartLearning = () => {
        navigate('/learn', { state: { playlistUrl } });
    };

    const useSample = (url) => {
        setPlaylistUrl(url);
        setComplete(false);
        setCurrentStep(-1);
        setError(null);
    };

    return (
        <div className="page playlist-import">
            <div className="container">
                {/* Hero */}
                <section className="import-hero animate-fade-in-up">
                    <span className="badge badge-primary stagger-1">Powered by AI Agents</span>
                    <h1 className="heading-xl stagger-2">
                        Transform any YouTube playlist into a
                        <span className="text-gradient"> mastery-driven </span>
                        learning journey
                    </h1>
                    <p className="import-subtitle stagger-3">
                        Paste a YouTube playlist URL below. Our AI will extract transcripts, build a knowledge graph,
                        and create personalized learning pathways with Socratic interventions.
                    </p>
                </section>

                {/* Input */}
                <section className="import-input-section animate-fade-in-up stagger-2">
                    <div className="import-input-row">
                        <div className="import-input-wrapper">
                            <FiLink className="input-icon" />
                            <input
                                type="url"
                                className="input input-large import-input"
                                placeholder="https://www.youtube.com/playlist?list=..."
                                value={playlistUrl}
                                onChange={e => setPlaylistUrl(e.target.value)}
                                disabled={isIngesting}
                            />
                        </div>
                        <button
                            className="btn btn-primary btn-lg import-btn"
                            onClick={handleIngest}
                            disabled={isIngesting || !playlistUrl.trim()}
                        >
                            {isIngesting ? (
                                <>
                                    <FiLoader className="spin-icon" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <FiPlay />
                                    Start Learning
                                </>
                            )}
                        </button>
                    </div>
                </section>

                {/* Error Display */}
                {error && (
                    <section className="pipeline-section animate-fade-in-up">
                        <div className="glass-card pipeline-card" style={{ borderColor: 'var(--color-error, #ef4444)' }}>
                            <h3 className="heading-md pipeline-title" style={{ color: 'var(--color-error, #ef4444)' }}>
                                <FiAlertCircle /> Ingestion Error
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>{error}</p>
                            <button
                                className="btn btn-primary"
                                style={{ marginTop: '12px' }}
                                onClick={() => { setError(null); setCurrentStep(-1); }}
                            >
                                Try Again
                            </button>
                        </div>
                    </section>
                )}

                {/* Pipeline Progress */}
                {(isIngesting || complete) && !error && (
                    <section className="pipeline-section animate-fade-in-up">
                        <div className="glass-card pipeline-card">
                            <h3 className="heading-md pipeline-title">
                                {complete ? '✨ Ingestion Complete!' : '⚙️ Ingestion Pipeline'}
                            </h3>
                            {jobDetails && !complete && (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '12px' }}>
                                    {jobDetails}
                                </p>
                            )}
                            <div className="pipeline-steps">
                                {PIPELINE_STEPS.map((step, i) => (
                                    <div
                                        key={i}
                                        className={`pipeline-step ${i < currentStep ? 'done' : i === currentStep ? 'active' : ''
                                            }`}
                                    >
                                        <div className="pipeline-step-icon">
                                            {i < currentStep ? <FiCheckCircle /> : step.icon}
                                        </div>
                                        <span className="pipeline-step-label">{step.label}</span>
                                        {i === currentStep && !complete && (
                                            <div className="pipeline-step-loader" />
                                        )}
                                    </div>
                                ))}
                            </div>
                            {complete && (
                                <button
                                    className="btn btn-primary"
                                    style={{ marginTop: '16px' }}
                                    onClick={handleStartLearning}
                                >
                                    Start Learning <FiChevronRight />
                                </button>
                            )}
                        </div>
                    </section>
                )}

                {/* Sample Playlists */}
                <section className="samples-section animate-fade-in-up stagger-3">
                    <h3 className="heading-sm">Or try a sample playlist</h3>
                    <div className="samples-grid">
                        {SAMPLE_PLAYLISTS.map((p, i) => (
                            <button
                                key={i}
                                className="sample-card glass-card"
                                onClick={() => useSample(p.url)}
                                disabled={isIngesting}
                            >
                                <div className="sample-info">
                                    <h4 className="sample-title">{p.title}</h4>
                                    <div className="sample-meta">
                                        <span>{p.videos} videos</span>
                                        <span>•</span>
                                        <span>{p.duration}</span>
                                    </div>
                                </div>
                                <FiChevronRight className="sample-arrow" />
                            </button>
                        ))}
                    </div>
                </section>

                {/* Features */}
                <section className="features-section animate-fade-in-up stagger-4">
                    <div className="features-grid">
                        {[
                            { icon: '🧠', title: 'Knowledge Graph', desc: 'Auto-extracts concepts & prerequisites from transcripts' },
                            { icon: '🎯', title: 'Socratic Tutor', desc: 'AI intervenes when you\'re confused — not when you\'re not' },
                            { icon: '📊', title: 'Mastery Tracking', desc: 'Skill-based progress, not just watch time' },
                            { icon: '🔄', title: 'Break Recovery', desc: 'Cognitive priming when you return after a break' },
                        ].map((f, i) => (
                            <div key={i} className="feature-card glass-card">
                                <span className="feature-icon">{f.icon}</span>
                                <h4 className="feature-title">{f.title}</h4>
                                <p className="feature-desc">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
