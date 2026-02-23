import { useEffect, useRef, useMemo } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import './SkillGraph.css';

const MASTERY_COLORS = {
    none: { bg: '#1e293b', border: '#334155', font: '#94a3b8' },
    beginner: { bg: '#1e1b4b', border: '#6366f1', font: '#a5b4fc' },
    medium: { bg: '#172554', border: '#3b82f6', font: '#93c5fd' },
    advanced: { bg: '#052e16', border: '#10b981', font: '#6ee7b7' },
    mastered: { bg: '#fbbf24', border: '#f59e0b', font: '#1a1f35' },
};

function getMasteryLevel(score) {
    if (score >= 90) return 'mastered';
    if (score >= 70) return 'advanced';
    if (score >= 40) return 'medium';
    if (score >= 10) return 'beginner';
    return 'none';
}

export default function SkillGraph({ concepts = [], edges = [], masteryScores = {} }) {
    const containerRef = useRef(null);
    const networkRef = useRef(null);

    // Sample data if none provided
    const sampleConcepts = useMemo(() => concepts.length > 0 ? concepts : [
        { id: 'linear-algebra', label: 'Linear Algebra' },
        { id: 'derivatives', label: 'Derivatives' },
        { id: 'chain-rule', label: 'Chain Rule' },
        { id: 'gradient-descent', label: 'Gradient Descent' },
        { id: 'neural-networks', label: 'Neural Networks' },
        { id: 'backpropagation', label: 'Backpropagation' },
        { id: 'loss-functions', label: 'Loss Functions' },
        { id: 'activation-functions', label: 'Activation Functions' },
        { id: 'optimizers', label: 'Optimizers' },
        { id: 'regularization', label: 'Regularization' },
        { id: 'cnn', label: 'CNNs' },
        { id: 'rnn', label: 'RNNs' },
    ], [concepts]);

    const sampleEdges = useMemo(() => edges.length > 0 ? edges : [
        { from: 'linear-algebra', to: 'neural-networks' },
        { from: 'derivatives', to: 'chain-rule' },
        { from: 'chain-rule', to: 'backpropagation' },
        { from: 'gradient-descent', to: 'backpropagation' },
        { from: 'derivatives', to: 'gradient-descent' },
        { from: 'neural-networks', to: 'backpropagation' },
        { from: 'loss-functions', to: 'gradient-descent' },
        { from: 'activation-functions', to: 'neural-networks' },
        { from: 'backpropagation', to: 'optimizers' },
        { from: 'neural-networks', to: 'cnn' },
        { from: 'neural-networks', to: 'rnn' },
        { from: 'optimizers', to: 'regularization' },
    ], [edges]);

    const sampleMastery = useMemo(() => Object.keys(masteryScores).length > 0 ? masteryScores : {
        'linear-algebra': 92,
        'derivatives': 85,
        'chain-rule': 72,
        'gradient-descent': 55,
        'neural-networks': 40,
        'backpropagation': 15,
        'loss-functions': 60,
        'activation-functions': 78,
        'optimizers': 0,
        'regularization': 0,
        'cnn': 5,
        'rnn': 0,
    }, [masteryScores]);

    useEffect(() => {
        if (!containerRef.current) return;

        const nodes = new DataSet(
            sampleConcepts.map(c => {
                const score = sampleMastery[c.id] || 0;
                const level = getMasteryLevel(score);
                const colors = MASTERY_COLORS[level];
                return {
                    id: c.id,
                    label: `${c.label}\n${score}%`,
                    shape: 'box',
                    color: {
                        background: colors.bg,
                        border: colors.border,
                        highlight: { background: colors.border, border: colors.font },
                        hover: { background: colors.border, border: colors.font },
                    },
                    font: {
                        color: colors.font,
                        size: 13,
                        face: 'Inter, sans-serif',
                        multi: 'md',
                        bold: { color: colors.font, size: 14 },
                    },
                    borderWidth: score >= 90 ? 3 : 2,
                    shadow: score >= 70 ? { enabled: true, color: colors.border, size: 12 } : false,
                    size: 20 + score * 0.15,
                    mass: 1 + score * 0.01,
                };
            })
        );

        const edgeData = new DataSet(
            sampleEdges.map((e, i) => ({
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

        return () => {
            networkRef.current?.destroy();
        };
    }, [sampleConcepts, sampleEdges, sampleMastery]);

    return (
        <div className="skill-graph-wrapper">
            <div className="skill-graph-header">
                <h3 className="heading-md">Knowledge Map</h3>
                <div className="legend">
                    {Object.entries(MASTERY_COLORS).map(([level, colors]) => (
                        <div key={level} className="legend-item">
                            <span className="legend-dot" style={{ background: colors.border }}></span>
                            <span>{level.charAt(0).toUpperCase() + level.slice(1)}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div ref={containerRef} className="skill-graph-canvas" />
        </div>
    );
}
