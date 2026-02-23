import { Router } from 'express';
import { getConceptGraph } from '../utils/neo4jClient.js';

const router = Router();

// GET /api/graph/:playlistId — get knowledge graph for visualization
router.get('/:playlistId', async (req, res) => {
    try {
        const graph = await getConceptGraph(req.params.playlistId);
        res.json(graph);
    } catch (err) {
        // Return sample data if Neo4j unavailable
        res.json({
            concepts: [
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
            ],
            edges: [
                { from: 'linear-algebra', to: 'neural-networks' },
                { from: 'derivatives', to: 'chain-rule' },
                { from: 'chain-rule', to: 'backpropagation' },
                { from: 'gradient-descent', to: 'backpropagation' },
                { from: 'derivatives', to: 'gradient-descent' },
                { from: 'neural-networks', to: 'backpropagation' },
                { from: 'loss-functions', to: 'gradient-descent' },
                { from: 'activation-functions', to: 'neural-networks' },
                { from: 'backpropagation', to: 'optimizers' },
                { from: 'optimizers', to: 'regularization' },
            ],
        });
    }
});

export default router;
