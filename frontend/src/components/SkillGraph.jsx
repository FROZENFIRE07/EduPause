import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { getKnowledgeGraph } from '../api';
import './SkillGraph.css';

const MASTERY_COLORS = {
    none: { bg: '#1e293b', border: '#334155', font: '#94a3b8' },
    beginner: { bg: '#1e1b4b', border: '#6366f1', font: '#a5b4fc' },
    medium: { bg: '#172554', border: '#3b82f6', font: '#93c5fd' },
    advanced: { bg: '#052e16', border: '#10b981', font: '#6ee7b7' },
    mastered: { bg: '#fbbf24', border: '#f59e0b', font: '#1a1f35' },
};

// Vibrant colors for nodes when no mastery data exists
const NODE_COLORS = [
    { bg: '#6366f1', border: '#818cf8', font: '#ffffff' },   // indigo
    { bg: '#06b6d4', border: '#22d3ee', font: '#ffffff' },   // cyan
    { bg: '#10b981', border: '#34d399', font: '#ffffff' },   // emerald
    { bg: '#f59e0b', border: '#fbbf24', font: '#1a1f35' },   // amber
    { bg: '#ec4899', border: '#f472b6', font: '#ffffff' },   // pink
    { bg: '#8b5cf6', border: '#a78bfa', font: '#ffffff' },   // violet
    { bg: '#14b8a6', border: '#2dd4bf', font: '#ffffff' },   // teal
    { bg: '#f97316', border: '#fb923c', font: '#ffffff' },   // orange
    { bg: '#ef4444', border: '#f87171', font: '#ffffff' },   // red
    { bg: '#84cc16', border: '#a3e635', font: '#1a1f35' },   // lime
];

function getMasteryLevel(score) {
    if (score >= 90) return 'mastered';
    if (score >= 70) return 'advanced';
    if (score >= 40) return 'medium';
    if (score >= 10) return 'beginner';
    return 'none';
}

export default function SkillGraph({ playlistId, videoId, masteryScores = {} }) {
    const containerRef = useRef(null);
    const networkRef = useRef(null);
    const [concepts, setConcepts] = useState([]);
    const [edges, setEdges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedNode, setSelectedNode] = useState(null);

    const hasMastery = Object.keys(masteryScores).length > 0;

    // Fetch real graph data from API
    useEffect(() => {
        let cancelled = false;

        async function fetchGraph() {
            const pid = playlistId || 'default';
            setLoading(true);
            try {
                const res = await getKnowledgeGraph(pid, videoId || null);
                if (cancelled) return;
                setConcepts(res.data?.concepts || []);
                setEdges(res.data?.edges || []);
            } catch {
                if (cancelled) return;
                setConcepts([]);
                setEdges([]);
            }
            setLoading(false);
        }

        fetchGraph();
        return () => { cancelled = true; };
    }, [playlistId, videoId]);

    // Render vis-network when data changes
    useEffect(() => {
        if (!containerRef.current || concepts.length === 0) return;

        const nodes = new DataSet(
            concepts.map((c, idx) => {
                const isParent = c.childCount > 0;
                let colors;

                if (hasMastery) {
                    const score = masteryScores[c.id] || 0;
                    const level = getMasteryLevel(score);
                    colors = MASTERY_COLORS[level];
                } else {
                    // Assign vibrant per-node colors
                    colors = NODE_COLORS[idx % NODE_COLORS.length];
                }

                return {
                    id: c.id,
                    label: c.label,
                    title: c.definition || c.label,
                    shape: 'dot',
                    color: {
                        background: colors.bg,
                        border: colors.border,
                        highlight: { background: colors.border, border: '#ffffff' },
                        hover: { background: colors.border, border: '#ffffff' },
                    },
                    font: {
                        color: '#e0e0f0',
                        size: isParent ? 14 : 12,
                        face: 'Inter, sans-serif',
                        strokeWidth: 3,
                        strokeColor: '#0a0a14',
                    },
                    borderWidth: isParent ? 3 : 2,
                    shadow: { enabled: true, color: colors.bg + '80', size: 15 },
                    size: isParent ? 28 : 18 + Math.random() * 8,
                    mass: isParent ? 1.5 : 1,
                };
            })
        );

        const edgeData = new DataSet(
            edges.map((e, i) => ({
                id: `e-${i}`,
                from: e.from,
                to: e.to,
                arrows: { to: { enabled: true, scaleFactor: 0.6 } },
                color: { color: '#334155', highlight: '#6366f1', hover: '#6366f1' },
                width: 1.5,
                smooth: { type: 'curvedCW', forceDirection: 'none', roundness: 0.15 },
            }))
        );

        const options = {
            physics: {
                enabled: true,
                solver: 'forceAtlas2Based',
                forceAtlas2Based: {
                    gravitationalConstant: -60,
                    centralGravity: 0.008,
                    springLength: 130,
                    springConstant: 0.06,
                    damping: 0.4,
                },
                stabilization: { iterations: 200, fit: true },
            },
            interaction: {
                hover: true,
                tooltipDelay: 100,
                zoomView: true,
                dragView: true,
                navigationButtons: false,
            },
            layout: { improvedLayout: true },
            nodes: {
                borderWidthSelected: 3,
                shapeProperties: { borderRadius: 8 },
                margin: { top: 10, bottom: 10, left: 14, right: 14 },
            },
        };

        networkRef.current = new Network(containerRef.current, { nodes, edges: edgeData }, options);

        // Click handler for parent nodes — show children in panel
        networkRef.current.on('click', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const concept = concepts.find(c => c.id === nodeId);
                setSelectedNode(concept || null);
            } else {
                setSelectedNode(null);
            }
        });

        return () => {
            networkRef.current?.destroy();
        };
    }, [concepts, edges, masteryScores]);

    // Empty state
    if (!loading && concepts.length === 0) {
        return (
            <div className="skill-graph-wrapper">
                <div className="skill-graph-empty">
                    <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🗺️</div>
                    <h3 className="heading-md" style={{ marginBottom: 8 }}>No knowledge map yet</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: '0.85rem' }}>
                        Import a playlist to build your learning knowledge graph.
                    </p>
                    <Link to="/" className="btn btn-primary">Import a Playlist</Link>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="skill-graph-wrapper">
                <div className="skill-graph-empty">
                    <p style={{ color: 'var(--text-muted)' }}>Loading knowledge map...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="skill-graph-wrapper">
            <div className="skill-graph-header">
                <h3 className="heading-md">Knowledge Map</h3>
                <span className="sg-concept-count">{concepts.length} concepts</span>
                <div className="legend">
                    {Object.entries(MASTERY_COLORS).map(([level, colors]) => (
                        <div key={level} className="legend-item">
                            <span className="legend-dot" style={{ background: colors.border }}></span>
                            <span>{level.charAt(0).toUpperCase() + level.slice(1)}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="sg-body">
                <div ref={containerRef} className="skill-graph-canvas" />
                {selectedNode && (
                    <div className="sg-panel">
                        <div className="sg-panel-top">
                            <h4>{selectedNode.label}</h4>
                            <button className="sg-panel-close" onClick={() => setSelectedNode(null)}>✕</button>
                        </div>
                        {selectedNode.definition && (
                            <p className="sg-panel-desc">{selectedNode.definition}</p>
                        )}
                        {selectedNode.children && selectedNode.children.length > 0 && (
                            <div className="sg-panel-children">
                                <span className="sg-panel-children-label">Sub-concepts</span>
                                {selectedNode.children.map(child => (
                                    <div key={child.id} className="sg-panel-child">
                                        <span className="sg-panel-child-dot" />
                                        <span>{child.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {selectedNode.videoId && (
                            <div className="sg-panel-meta">
                                From video: {selectedNode.videoId.substring(0, 8)}...
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
