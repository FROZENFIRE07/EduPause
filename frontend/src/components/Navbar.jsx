import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiBookOpen, FiLayout, FiBarChart2, FiSearch, FiMenu, FiX, FiSun, FiMoon, FiLogOut } from 'react-icons/fi';
import { useAppStore } from '../store';
import './Navbar.css';

export default function Navbar() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [hidden, setHidden] = useState(false);
    const lastScrollY = useRef(0);
    const location = useLocation();
    const navigate = useNavigate();
    const { theme, toggleTheme, authUser, logout } = useAppStore();

    const handleLogout = () => {
        logout();
        navigate('/auth');
    };

    // Scroll-hide behavior
    useEffect(() => {
        const handleScroll = () => {
            const currentY = window.scrollY;
            if (currentY > lastScrollY.current && currentY > 80) {
                setHidden(true);
            } else {
                setHidden(false);
            }
            lastScrollY.current = currentY;
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Theme keyboard shortcut
    useEffect(() => {
        const handleKey = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 't' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                toggleTheme();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [toggleTheme]);

    const links = [
        { to: '/', label: 'Import', icon: <FiBookOpen /> },
        { to: '/learn', label: 'Learn', icon: <FiLayout /> },
        { to: '/dashboard', label: 'Dashboard', icon: <FiBarChart2 /> },
        { to: '/search', label: 'Search', icon: <FiSearch /> },
    ];



    return (
        <nav className={`navbar ${hidden ? 'navbar-hidden' : ''}`}>
            <div className="navbar-inner container">
                <Link to="/" className="navbar-logo">
                    <div className="logo-icon">
                        <svg viewBox="0 0 32 32" fill="none" width="28" height="28">
                            <defs>
                                <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32">
                                    <stop offset="0%" stopColor="#fdee30" />
                                    <stop offset="100%" stopColor="#fefefe" />
                                </linearGradient>
                            </defs>
                            <circle cx="16" cy="16" r="14" stroke="url(#logoGrad)" strokeWidth="2.5" fill="none" />
                            <path d="M10 16 L14 20 L22 12" stroke="url(#logoGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <span className="logo-text">
                        <span className="text-gradient">Edu</span>Pause
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

                <div className="navbar-right">

                    {/* Theme toggle */}
                    <button
                        className="btn btn-ghost btn-icon-round nav-theme-toggle"
                        onClick={toggleTheme}
                        aria-label="Toggle theme"
                    >
                        {theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
                    </button>

                    {/* User + Sign out */}
                    {authUser && (
                        <div className="nav-user-menu">
                            <span className="nav-user-avatar">{authUser.name?.charAt(0)?.toUpperCase() || '?'}</span>
                            <button
                                className="btn btn-ghost btn-icon-round nav-logout-btn"
                                onClick={handleLogout}
                                aria-label="Sign out"
                                title="Sign out"
                            >
                                <FiLogOut size={16} />
                            </button>
                        </div>
                    )}

                    <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
                        {mobileOpen ? <FiX size={22} /> : <FiMenu size={22} />}
                    </button>
                </div>
            </div>
        </nav>
    );
}
