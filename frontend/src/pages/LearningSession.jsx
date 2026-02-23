import { useState, useCallback, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import InterventionModal from '../components/InterventionModal';
import BreakRecovery from '../components/BreakRecovery';
import { FiList, FiActivity, FiMessageSquare, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import './LearningSession.css';

// Demo playlist data (fallback)
const DEMO_VIDEOS = [
    { id: 'aircAruvnKk', title: 'But what is a Neural Network?', duration: '19:13' },
    { id: 'IHZwWFHWa-w', title: 'Gradient descent, how neural networks learn', duration: '21:01' },
    { id: 'Ilg3gGewQ5U', title: 'What is backpropagation really doing?', duration: '13:54' },
    { id: 'tIeHLnjs5U8', title: 'Backpropagation calculus', duration: '10:17' },
];

const DEMO_INTERVENTION = {
    type: 'mcq',
    question: 'In gradient descent, what does the learning rate control?',
    options: [
        'The number of neurons in the network',
        'How large each step is when updating weights',
        'The activation function used',
        'The size of the training dataset',
    ],
    correctIndex: 1,
    hint: 'Think about what happens to the weights when the gradient is computed...',
    context: 'From: "Gradient descent, how neural networks learn" @ 8:42',
};

function ConfusionMeter({ score }) {
    const level = score > 70 ? 'high' : score > 40 ? 'medium' : 'low';
    return (
        <div className="confusion-meter">
            <div className="confusion-label">
                <span>Confusion Score</span>
                <span className={`confusion-value ${level}`}>{score}%</span>
            </div>
            <div className="progress-bar">
                <div
                    className={`progress-bar-fill confusion-fill-${level}`}
                    style={{ width: `${score}%` }}
                />
            </div>
        </div>
    );
}

function ClickstreamLog({ events }) {
    return (
        <div className="clickstream-log">
            <h4 className="sidebar-section-title">
                <FiActivity size={14} /> Live Clickstream
            </h4>
            <div className="clickstream-events">
                {events.length === 0 && (
                    <p className="clickstream-empty">Play a video to see events...</p>
                )}
                {events.slice(-15).reverse().map((e, i) => (
                    <div key={i} className="clickstream-event">
                        <span className={`event-type ${e.type}`}>{e.type}</span>
                        <span className="event-time">{e.videoTime?.toFixed(1)}s</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function LearningSession() {
    const location = useLocation();

    // Load videos from navigation state, sessionStorage, or fallback to demo
    const videos = useMemo(() => {
        // Try sessionStorage first (set by PlaylistImport after ingestion)
        try {
            const stored = sessionStorage.getItem('masteryos_playlist');
            if (stored) {
                const data = JSON.parse(stored);
                if (data.videos && data.videos.length > 0) {
                    return data.videos.map(v => ({
                        id: v.videoId || v.id,
                        title: v.title || 'Untitled',
                        duration: v.duration || '',
                    }));
                }
            }
        } catch (e) {
            console.warn('[LearningSession] Failed to load from sessionStorage:', e);
        }
        return DEMO_VIDEOS;
    }, []);

    const [activeVideo, setActiveVideo] = useState(videos[0]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [clickstream, setClickstream] = useState([]);
    const [confusionScore, setConfusionScore] = useState(12);
    const [showIntervention, setShowIntervention] = useState(false);
    const [showBreakRecovery, setShowBreakRecovery] = useState(false);
    const [sidebarExpanded, setSidebarExpanded] = useState(true);

    const rewindCountRef = useRef(0);
    const pauseCountRef = useRef(0);

    const handleClickstreamEvent = useCallback((event) => {
        setClickstream(prev => [...prev, event]);

        // Simple confusion heuristic
        if (event.type === 'rewind') {
            rewindCountRef.current++;
        }
        if (event.type === 'pause') {
            pauseCountRef.current++;
        }

        // Calculate weighted confusion score
        const rewindWeight = 25;
        const pauseWeight = 10;
        const newScore = Math.min(
            100,
            rewindCountRef.current * rewindWeight + pauseCountRef.current * pauseWeight
        );
        setConfusionScore(newScore);

        // Trigger intervention at threshold
        if (newScore > 65 && !showIntervention) {
            setShowIntervention(true);
            setIsPlaying(false);
        }
    }, [showIntervention]);

    const handleAnswer = (answer) => {
        // In production: send to agent evaluator
        console.log('Answer submitted:', answer);
        setShowIntervention(false);
        rewindCountRef.current = 0;
        pauseCountRef.current = 0;
        setConfusionScore(0);
        setIsPlaying(true);
    };

    const handleSkip = () => {
        setShowIntervention(false);
        rewindCountRef.current = Math.max(0, rewindCountRef.current - 1);
        setIsPlaying(true);
    };

    return (
        <div className="page learning-session">
            {/* Break Recovery Overlay */}
            {showBreakRecovery && (
                <BreakRecovery onContinue={() => setShowBreakRecovery(false)} />
            )}

            <div className="session-layout container">
                {/* Main Content */}
                <div className="session-main">
                    <VideoPlayer
                        videoUrl={`https://www.youtube.com/watch?v=${activeVideo.id}`}
                        isPlaying={isPlaying}
                        setIsPlaying={setIsPlaying}
                        onClickstreamEvent={handleClickstreamEvent}
                    />

                    {/* Video Info */}
                    <div className="video-info">
                        <h2 className="heading-md">{activeVideo.title}</h2>
                        <ConfusionMeter score={confusionScore} />
                    </div>

                    {/* Playlist */}
                    <div className="playlist-panel glass-card">
                        <h3 className="sidebar-section-title">
                            <FiList size={14} /> Playlist
                        </h3>
                        <div className="playlist-items">
                            {videos.map((video, i) => (
                                <button
                                    key={video.id}
                                    className={`playlist-item ${activeVideo.id === video.id ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveVideo(video);
                                        setIsPlaying(true);
                                    }}
                                >
                                    <span className="playlist-num">{i + 1}</span>
                                    <div className="playlist-item-info">
                                        <span className="playlist-item-title">{video.title}</span>
                                        <span className="playlist-item-dur">{video.duration}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <aside className={`session-sidebar ${sidebarExpanded ? 'expanded' : 'collapsed'}`}>
                    <button
                        className="sidebar-toggle"
                        onClick={() => setSidebarExpanded(!sidebarExpanded)}
                    >
                        {sidebarExpanded ? <FiChevronUp /> : <FiChevronDown />}
                        <span>Analytics</span>
                    </button>

                    {sidebarExpanded && (
                        <>
                            <ClickstreamLog events={clickstream} />

                            <div className="sidebar-actions">
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setShowIntervention(true)}
                                >
                                    <FiMessageSquare size={14} />
                                    Test Intervention
                                </button>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setShowBreakRecovery(true)}
                                >
                                    🔄 Test Break Recovery
                                </button>
                            </div>
                        </>
                    )}
                </aside>
            </div>

            {/* Intervention Modal */}
            <InterventionModal
                isOpen={showIntervention}
                intervention={DEMO_INTERVENTION}
                onAnswer={handleAnswer}
                onSkip={handleSkip}
                onClose={() => setShowIntervention(false)}
            />
        </div>
    );
}
