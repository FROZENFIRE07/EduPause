import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiBookOpen, FiLayout, FiBarChart2, FiMenu, FiX } from 'react-icons/fi';
import './Navbar.css';

export default function Navbar() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const location = useLocation();

    const links = [
        { to: '/', label: 'Import', icon: <FiBookOpen /> },
        { to: '/learn', label: 'Learn', icon: <FiLayout /> },
        { to: '/dashboard', label: 'Dashboard', icon: <FiBarChart2 /> },
    ];

    return (
        <nav className="navbar">
            <div className="navbar-inner container">
                <Link to="/" className="navbar-logo">
                    <div className="logo-icon">
                        <svg viewBox="0 0 32 32" fill="none" width="28" height="28">
                            <defs>
                                <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32">
                                    <stop offset="0%" stopColor="#6366f1" />
                                    <stop offset="100%" stopColor="#06b6d4" />
                                </linearGradient>
                            </defs>
                            <circle cx="16" cy="16" r="14" stroke="url(#logoGrad)" strokeWidth="2.5" fill="none" />
                            <path d="M10 16 L14 20 L22 12" stroke="url(#logoGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <span className="logo-text">
                        <span className="text-gradient">Mastery</span>OS
                    </span>
                </Link>

                <div className={`navbar-links ${mobileOpen ? 'open' : ''}`}>
                    {links.map(link => (
                        <Link
                            key={link.to}
                            to={link.to}
                            className={`nav-link ${location.pathname === link.to ? 'active' : ''}`}
                            onClick={() => setMobileOpen(false)}
                        >
                            {link.icon}
                            <span>{link.label}</span>
                        </Link>
                    ))}
                </div>

                <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
                    {mobileOpen ? <FiX size={22} /> : <FiMenu size={22} />}
                </button>
            </div>
        </nav>
    );
}
