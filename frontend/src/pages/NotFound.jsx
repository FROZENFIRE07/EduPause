import { Link } from 'react-router-dom';
import { FiHome, FiCompass } from 'react-icons/fi';
import './NotFound.css';

export default function NotFound() {
    return (
        <div className="page not-found">
            <div className="nf-container">
                <div className="nf-planet animate-float">🌌</div>
                <h1 className="nf-code">
                    <span className="text-gradient">404</span>
                </h1>
                <h2 className="heading-lg">Lost in Knowledge Space</h2>
                <p className="nf-desc">
                    The page you're looking for has drifted beyond our knowledge graph.
                    Let's navigate you back to familiar territory.
                </p>
                <div className="nf-actions">
                    <Link to="/" className="btn btn-primary btn-lg">
                        <FiHome size={18} />
                        Back to Home
                    </Link>
                    <Link to="/dashboard" className="btn btn-secondary">
                        <FiCompass size={18} />
                        Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
