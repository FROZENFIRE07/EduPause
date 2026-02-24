import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMail, FiLock, FiUser, FiArrowRight, FiCheck } from 'react-icons/fi';
import { useAppStore } from '../store';
import './AuthPage.css';



function getUsers() {
    try { return JSON.parse(localStorage.getItem('edupause-users') || '[]'); }
    catch { return []; }
}
function saveUsers(users) { localStorage.setItem('edupause-users', JSON.stringify(users)); }

function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

export default function AuthPage() {
    const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'verify'
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [expectedCode, setExpectedCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const codeRefs = useRef([]);
    const navigate = useNavigate();
    const { setAuth, setUserName } = useAppStore();

    // Focus first code input on verify step
    useEffect(() => {
        if (mode === 'verify') codeRefs.current[0]?.focus();
    }, [mode]);

    const handleSignUp = (e) => {
        e.preventDefault();
        setError('');
        if (!name.trim() || !email.trim() || !password.trim()) {
            setError('All fields are required'); return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Enter a valid email address'); return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters'); return;
        }
        const users = getUsers();
        if (users.find(u => u.email === email.toLowerCase())) {
            setError('An account with this email already exists'); return;
        }
        const vCode = generateCode();
        setExpectedCode(vCode);
        // Store pending user
        const pending = { name: name.trim(), email: email.toLowerCase(), password, verified: false, code: vCode };
        saveUsers([...users.filter(u => u.email !== pending.email), pending]);
        // Show code in an alert for dev (no backend)
        alert(`Your verification code is: ${vCode}`);
        setMode('verify');
    };

    const handleVerify = () => {
        setError('');
        const entered = code.join('');
        if (entered.length < 6) { setError('Enter all 6 digits'); return; }
        const users = getUsers();
        const user = users.find(u => u.email === email.toLowerCase());
        if (!user) { setError('User not found'); return; }
        if (user.code !== entered) { setError('Invalid verification code'); return; }
        // Mark verified & login
        user.verified = true;
        delete user.code;
        saveUsers(users);
        const token = btoa(JSON.stringify({ email: user.email, ts: Date.now() }));
        setAuth({ name: user.name, email: user.email }, token);
        setUserName(user.name);

        navigate('/');
    };

    const handleSignIn = (e) => {
        e.preventDefault();
        setError('');
        if (!email.trim() || !password.trim()) { setError('Email and password are required'); return; }
        const users = getUsers();
        const user = users.find(u => u.email === email.toLowerCase());
        if (!user) { setError('No account found with this email'); return; }
        if (user.password !== password) { setError('Incorrect password'); return; }
        if (!user.verified) {
            // Resend code
            const vCode = generateCode();
            user.code = vCode;
            saveUsers(users);
            setExpectedCode(vCode);
            alert(`Your verification code is: ${vCode}`);
            setMode('verify');
            return;
        }
        const token = btoa(JSON.stringify({ email: user.email, ts: Date.now() }));
        setAuth({ name: user.name, email: user.email }, token);
        setUserName(user.name);

        navigate('/');
    };

    const handleCodeChange = (idx, val) => {
        if (val.length > 1) val = val.slice(-1);
        if (val && !/^\d$/.test(val)) return;
        const next = [...code];
        next[idx] = val;
        setCode(next);
        if (val && idx < 5) codeRefs.current[idx + 1]?.focus();
    };

    const handleCodeKeyDown = (idx, e) => {
        if (e.key === 'Backspace' && !code[idx] && idx > 0) {
            codeRefs.current[idx - 1]?.focus();
        }
        if (e.key === 'Enter' && code.every(c => c)) handleVerify();
    };

    const handleCodePaste = (e) => {
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 6) {
            setCode(pasted.split(''));
            codeRefs.current[5]?.focus();
            e.preventDefault();
        }
    };

    return (
        <div className="auth-overlay">
            <motion.div
                className="auth-card glass-card-static"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
            >
                <div className="auth-logo">🎓</div>
                <h1 className="auth-title">EduPause</h1>

                <AnimatePresence mode="wait">
                    {/* ─── Sign In ─── */}
                    {mode === 'signin' && (
                        <motion.form key="signin" className="auth-form" onSubmit={handleSignIn}
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                            <h2 className="auth-heading">Welcome back</h2>
                            <p className="auth-sub">Sign in to continue learning</p>

                            <div className="auth-field">
                                <FiMail className="auth-field-icon" />
                                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
                            </div>
                            <div className="auth-field">
                                <FiLock className="auth-field-icon" />
                                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
                            </div>

                            {error && <p className="auth-error">{error}</p>}

                            <button type="submit" className="auth-btn">
                                Sign In <FiArrowRight />
                            </button>

                            <p className="auth-switch">
                                Don't have an account?{' '}
                                <button type="button" onClick={() => { setMode('signup'); setError(''); }}>Sign Up</button>
                            </p>
                        </motion.form>
                    )}

                    {/* ─── Sign Up ─── */}
                    {mode === 'signup' && (
                        <motion.form key="signup" className="auth-form" onSubmit={handleSignUp}
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                            <h2 className="auth-heading">Create account</h2>
                            <p className="auth-sub">Start your learning journey</p>

                            <div className="auth-field">
                                <FiUser className="auth-field-icon" />
                                <input type="text" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} autoFocus />
                            </div>
                            <div className="auth-field">
                                <FiMail className="auth-field-icon" />
                                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                            </div>
                            <div className="auth-field">
                                <FiLock className="auth-field-icon" />
                                <input type="password" placeholder="Password (min 6 chars)" value={password} onChange={e => setPassword(e.target.value)} />
                            </div>

                            {error && <p className="auth-error">{error}</p>}

                            <button type="submit" className="auth-btn">
                                Sign Up <FiArrowRight />
                            </button>

                            <p className="auth-switch">
                                Already have an account?{' '}
                                <button type="button" onClick={() => { setMode('signin'); setError(''); }}>Sign In</button>
                            </p>
                        </motion.form>
                    )}

                    {/* ─── Verify ─── */}
                    {mode === 'verify' && (
                        <motion.div key="verify" className="auth-form"
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }}>
                            <h2 className="auth-heading">Verify your email</h2>
                            <p className="auth-sub">Enter the 6-digit code sent to<br /><strong>{email}</strong></p>

                            <div className="auth-code-row" onPaste={handleCodePaste}>
                                {code.map((d, i) => (
                                    <input
                                        key={i}
                                        ref={el => codeRefs.current[i] = el}
                                        className="auth-code-input"
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={d}
                                        onChange={e => handleCodeChange(i, e.target.value)}
                                        onKeyDown={e => handleCodeKeyDown(i, e)}
                                    />
                                ))}
                            </div>

                            {error && <p className="auth-error">{error}</p>}

                            <button type="button" className="auth-btn" onClick={handleVerify} disabled={code.some(c => !c)}>
                                Verify <FiCheck />
                            </button>

                            <p className="auth-switch">
                                <button type="button" onClick={() => { setMode('signup'); setError(''); setCode(['', '', '', '', '', '']); }}>Back to Sign Up</button>
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
