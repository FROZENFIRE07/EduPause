import { useState, useCallback, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSearch, FiX, FiClock, FiPlay, FiBookOpen, FiExternalLink, FiFilter, FiGrid, FiList } from 'react-icons/fi';
import { searchContent } from '../api';
import './Search.css';

const RECENT_SEARCHES_KEY = 'edupause-recent-searches';

function getRecentSearches() {
    try {
        return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY)) || [];
    } catch { return []; }
}

function saveRecentSearch(query) {
    const recent = getRecentSearches().filter(s => s !== query);
    recent.unshift(query);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, 8)));
}

function getMasteryColor(mastery) {
    if (mastery >= 90) return 'var(--accent-warning)';
    if (mastery >= 70) return 'var(--accent-success)';
    if (mastery >= 40) return 'var(--accent-primary)';
    if (mastery >= 10) return 'var(--accent-tertiary)';
    return 'var(--text-muted)';
}

export default function Search() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [filterType, setFilterType] = useState('all');
    const [viewMode, setViewMode] = useState('grid');
    const [recentSearches, setRecentSearches] = useState(getRecentSearches);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    // Autofocus on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Live search with debounce
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setHasSearched(false);
            return;
        }

        const timeout = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await searchContent(query, filterType);
                setResults(res.data || []);
            } catch {
                // API not available — return empty results
                setResults([]);
            }
            setHasSearched(true);
            setLoading(false);
        }, 300);

        return () => clearTimeout(timeout);
    }, [query, filterType]);

    const handleSearch = useCallback((searchQuery) => {
        const q = searchQuery || query;
        if (!q.trim()) return;
        setQuery(q);
        saveRecentSearch(q);
        setRecentSearches(getRecentSearches());
    }, [query]);

    const clearSearch = () => {
        setQuery('');
        setResults([]);
        setHasSearched(false);
        inputRef.current?.focus();
    };

    const removeRecentSearch = (term) => {
        const updated = recentSearches.filter(s => s !== term);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        setRecentSearches(updated);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSearch();
        if (e.key === 'Escape') clearSearch();
    };

    return (
        <div className="page search-page">
            {/* ===== Hero search ===== */}
            <section className="search-hero container">
                <motion.div
                    className="search-hero-inner"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <h1 className="heading-xl search-title">
                        <span className="text-gradient">Search</span> your knowledge
                    </h1>
                    <p className="search-subtitle">
                        Find videos, concepts, and playlists across your learning library
                    </p>

                    <div className="search-bar-wrapper">
                        <div className="search-bar">
                            <FiSearch className="search-bar-icon" size={20} />
                            <input
                                ref={inputRef}
                                type="text"
                                className="search-bar-input"
                                placeholder="Search videos, concepts, topics..."
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                            {query && (
                                <button className="search-bar-clear" onClick={clearSearch}>
                                    <FiX size={16} />
                                </button>
                            )}
                            <button className="btn btn-primary search-bar-btn" onClick={() => handleSearch()}>
                                Search
                            </button>
                        </div>

                        {/* Filters */}
                        <div className="search-controls">
                            <div className="search-filters">
                                <FiFilter size={14} />
                                {[
                                    { key: 'all', label: 'All' },
                                    { key: 'video', label: 'Videos' },
                                    { key: 'concept', label: 'Concepts' },
                                    { key: 'playlist', label: 'Playlists' },
                                ].map(f => (
                                    <button
                                        key={f.key}
                                        className={`search-filter-btn ${filterType === f.key ? 'active' : ''}`}
                                        onClick={() => setFilterType(f.key)}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                            <div className="search-view-toggle">
                                <button
                                    className={`search-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                                    onClick={() => setViewMode('grid')}
                                    title="Grid view"
                                >
                                    <FiGrid size={14} />
                                </button>
                                <button
                                    className={`search-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                                    onClick={() => setViewMode('list')}
                                    title="List view"
                                >
                                    <FiList size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* ===== Results / Empty states ===== */}
            <section className="search-results container">
                <AnimatePresence mode="wait">
                    {/* No query yet — show suggestions */}
                    {!hasSearched && !query && (
                        <motion.div
                            key="suggestions"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="search-suggestions"
                        >
                            {/* Recent searches */}
                            {recentSearches.length > 0 && (
                                <div className="search-suggestion-group">
                                    <h3 className="search-group-title">
                                        <FiClock size={14} />
                                        Recent Searches
                                    </h3>
                                    <div className="search-tag-list">
                                        {recentSearches.map(term => (
                                            <div key={term} className="search-tag recent">
                                                <button className="search-tag-text" onClick={() => { setQuery(term); handleSearch(term); }}>
                                                    {term}
                                                </button>
                                                <button className="search-tag-remove" onClick={() => removeRecentSearch(term)}>
                                                    <FiX size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Empty library message */}
                            {recentSearches.length === 0 && (
                                <div className="search-empty">
                                    <div className="search-empty-icon">📚</div>
                                    <h3 className="heading-md">Your library is empty</h3>
                                    <p className="search-empty-desc">
                                        Import a playlist to start building your searchable learning library.
                                    </p>
                                    <Link to="/" className="btn btn-primary" style={{ marginTop: 8 }}>
                                        Import a Playlist
                                    </Link>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Loading */}
                    {loading && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="search-empty"
                        >
                            <div className="search-empty-icon">🔍</div>
                            <p className="search-empty-desc">Searching...</p>
                        </motion.div>
                    )}

                    {/* Search results */}
                    {hasSearched && !loading && results.length > 0 && (
                        <motion.div
                            key="results"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <p className="search-result-count">
                                Found <strong>{results.length}</strong> result{results.length !== 1 ? 's' : ''} for "<strong>{query}</strong>"
                            </p>
                            <div className={`search-result-grid ${viewMode}`}>
                                {results.map((item, i) => (
                                    <motion.div
                                        key={item.id || i}
                                        className={`search-result-card glass-card ${item.type || 'concept'}`}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        onClick={() => {
                                            if (item.type === 'video') navigate('/learn');
                                            else if (item.type === 'playlist') navigate('/');
                                            else navigate('/dashboard');
                                        }}
                                    >
                                        {/* Type badge */}
                                        <span className={`search-type-badge ${item.type || 'concept'}`}>
                                            {item.type === 'video' ? <FiPlay size={10} /> :
                                                item.type === 'concept' ? <FiBookOpen size={10} /> :
                                                    <FiExternalLink size={10} />}
                                            {item.type || 'concept'}
                                        </span>

                                        <h4 className="search-result-title">{item.title || item.label}</h4>

                                        {item.description && (
                                            <p className="search-result-desc">{item.description}</p>
                                        )}

                                        <div className="search-result-meta">
                                            {item.playlist && (
                                                <span className="search-result-playlist">{item.playlist}</span>
                                            )}
                                            {item.duration && (
                                                <span className="search-result-duration">{item.duration}</span>
                                            )}
                                            {item.videos && (
                                                <span className="search-result-vcount">{item.videos} videos</span>
                                            )}
                                        </div>

                                        {/* Mastery bar */}
                                        {item.mastery !== undefined && (
                                            <div className="search-result-mastery">
                                                <div className="progress-bar" style={{ flex: 1, height: 4 }}>
                                                    <div
                                                        className="progress-bar-fill"
                                                        style={{
                                                            width: `${item.mastery}%`,
                                                            background: getMasteryColor(item.mastery),
                                                        }}
                                                    />
                                                </div>
                                                <span className="search-result-mastery-val" style={{ color: getMasteryColor(item.mastery) }}>
                                                    {item.mastery}%
                                                </span>
                                            </div>
                                        )}

                                        {/* Tags */}
                                        {item.tags && item.tags.length > 0 && (
                                            <div className="search-result-tags">
                                                {item.tags.slice(0, 3).map(t => (
                                                    <span key={t} className="search-result-tag">{t}</span>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* No results */}
                    {hasSearched && !loading && results.length === 0 && (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="search-empty"
                        >
                            <div className="search-empty-icon">🔍</div>
                            <h3 className="heading-md">No results found</h3>
                            <p className="search-empty-desc">
                                We couldn't find anything matching "<strong>{query}</strong>".
                                Try a different search term or import a new playlist.
                            </p>
                            <Link to="/" className="btn btn-primary" style={{ marginTop: 8 }}>
                                Import a Playlist
                            </Link>
                        </motion.div>
                    )}
                </AnimatePresence>
            </section>

            <div style={{ height: 60 }} />
        </div>
    );
}
