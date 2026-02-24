import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import ReactConfetti from 'react-confetti';
import './AchievementToast.css';

function AchievementToastContent({ title, description, icon }) {
    return (
        <div className="achievement-toast-content">
            <div className="achievement-toast-icon animate-bounce-in">{icon || '🎉'}</div>
            <div className="achievement-toast-text">
                <span className="achievement-toast-title">{title}</span>
                <span className="achievement-toast-desc">{description}</span>
            </div>
        </div>
    );
}

export function useAchievementToast() {
    const [showConfetti, setShowConfetti] = useState(false);

    const triggerToast = useCallback(({ title, description, icon, confetti = true, duration = 5000 }) => {
        toast.custom(
            (t) => (
                <div className={`achievement-toast ${t.visible ? 'animate-slide-in-right' : 'achievement-toast-exit'}`}>
                    <AchievementToastContent title={title} description={description} icon={icon} />
                </div>
            ),
            { duration }
        );

        if (confetti) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 4000);
        }
    }, []);

    const ConfettiComponent = showConfetti ? (
        <ReactConfetti
            width={window.innerWidth}
            height={window.innerHeight}
            recycle={false}
            numberOfPieces={200}
            gravity={0.15}
            colors={['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899']}
            style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999, pointerEvents: 'none' }}
        />
    ) : null;

    return { triggerToast, ConfettiComponent };
}
