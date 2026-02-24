import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import PlaylistImport from './pages/PlaylistImport';
import LearningSession from './pages/LearningSession';
import Dashboard from './pages/Dashboard';
import Search from './pages/Search';
import AuthPage from './pages/AuthPage';
import NotFound from './pages/NotFound';
import Onboarding from './components/Onboarding';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import FireConfetti from './components/FireConfetti';
import { useAppStore } from './store';
import './App.css';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

function AnimatedRoutes({ isLoggedIn }) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div key={location.pathname} variants={pageVariants} initial="initial" animate="animate" exit="exit">
        <Routes location={location}>
          <Route path="/auth" element={isLoggedIn ? <Navigate to="/" replace /> : <AuthPage />} />
          <Route path="/" element={isLoggedIn ? <PlaylistImport /> : <Navigate to="/auth" replace />} />
          <Route path="/learn" element={isLoggedIn ? <LearningSession /> : <Navigate to="/auth" replace />} />
          <Route path="/dashboard" element={isLoggedIn ? <Dashboard /> : <Navigate to="/auth" replace />} />
          <Route path="/search" element={isLoggedIn ? <Search /> : <Navigate to="/auth" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  const { theme, onboardingComplete, authUser } = useAppStore();
  const [showShortcuts, setShowShortcuts] = useState(false);

  const isLoggedIn = !!authUser;

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Global keyboard shortcut listener
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcuts(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <BrowserRouter>
      <FireConfetti />
      {isLoggedIn && !onboardingComplete && <Onboarding />}
      {isLoggedIn && <Navbar />}
      <AnimatedRoutes isLoggedIn={isLoggedIn} />
      <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
          },
        }}
      />
    </BrowserRouter>
  );
}
