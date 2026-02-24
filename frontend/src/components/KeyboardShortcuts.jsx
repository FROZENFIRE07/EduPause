import { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';
import './KeyboardShortcuts.css';

const SHORTCUTS = [
    {
        category: 'Video Player', items: [
            { keys: ['Space'], desc: 'Play / Pause' },
            { keys: ['←'], desc: 'Rewind 5 seconds' },
            { keys: ['→'], desc: 'Forward 5 seconds' },
            { keys: ['↑'], desc: 'Volume up' },
            { keys: ['↓'], desc: 'Volume down' },
            { keys: ['F'], desc: 'Toggle fullscreen' },
            { keys: ['M'], desc: 'Mute / Unmute' },
        ]
    },
    {
        category: 'Navigation', items: [
            { keys: ['G', 'H'], desc: 'Go to home' },
            { keys: ['G', 'L'], desc: 'Go to learn' },
            { keys: ['G', 'D'], desc: 'Go to dashboard' },
        ]
    },
    {
        category: 'General', items: [
            { keys: ['?'], desc: 'Show keyboard shortcuts' },
            { keys: ['T'], desc: 'Toggle theme' },
            { keys: ['Esc'], desc: 'Close modal / panel' },
        ]
    },
];

export default function KeyboardShortcuts({ isOpen, onClose }) {
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape' && isOpen) onClose?.();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="kbd-overlay animate-fade-in" onClick={onClose}>
            <div className="kbd-modal glass-card-static animate-scale-in" onClick={e => e.stopPropagation()}>
                <div className="kbd-header">
                    <h2 className="heading-md">Keyboard Shortcuts</h2>
                    <button className="btn btn-ghost btn-icon-round" onClick={onClose}>
                        <FiX size={18} />
                    </button>
                </div>
                <div className="kbd-body">
                    {SHORTCUTS.map((section) => (
                        <div key={section.category} className="kbd-section">
                            <h3 className="kbd-category">{section.category}</h3>
                            <div className="kbd-items">
                                {section.items.map((item, i) => (
                                    <div key={i} className="kbd-item">
                                        <span className="kbd-desc">{item.desc}</span>
                                        <div className="kbd-keys">
                                            {item.keys.map((key, j) => (
                                                <span key={j}>
                                                    <kbd className="kbd-key">{key}</kbd>
                                                    {j < item.keys.length - 1 && <span className="kbd-then">then</span>}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
