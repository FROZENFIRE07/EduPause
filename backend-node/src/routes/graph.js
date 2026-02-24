import { Router } from 'express';
import { getConceptGraph } from '../utils/neo4jClient.js';
import { log } from '../utils/logger.js';

const router = Router();

/**
 * Collapse child concepts into their parents.
 * Children with a parentConcept are removed from the top level;
 * the parent gets a childCount and children array.
 */
function collapseGraph(concepts, edges) {
    const conceptMap = new Map(concepts.map(c => [c.id, { ...c, children: [], childCount: 0 }]));

    // Find children and attach to parents
    for (const c of concepts) {
        if (c.parentConcept && conceptMap.has(c.parentConcept)) {
            const parent = conceptMap.get(c.parentConcept);
            parent.children.push({ id: c.id, label: c.label, definition: c.definition });
            parent.childCount++;
        }
    }

    // Remove children from top level (keep only parents and orphans)
    const topLevel = [];
    for (const c of conceptMap.values()) {
        const isChild = c.parentConcept && conceptMap.has(c.parentConcept);
        if (!isChild) {
            topLevel.push(c);
        }
    }

    // Filter edges to only include top-level concepts
    const topIds = new Set(topLevel.map(c => c.id));
    const filteredEdges = edges.filter(e => topIds.has(e.from) && topIds.has(e.to));

    return { concepts: topLevel, edges: filteredEdges };
}

/**
 * Cap the graph to maxNodes by keeping the most connected concepts.
 */
function capGraph(concepts, edges, maxNodes = 15) {
    if (concepts.length <= maxNodes) return { concepts, edges };

    // Score each concept by connection count
    const connectionCount = new Map(concepts.map(c => [c.id, 0]));
    for (const e of edges) {
        connectionCount.set(e.from, (connectionCount.get(e.from) || 0) + 1);
        connectionCount.set(e.to, (connectionCount.get(e.to) || 0) + 1);
    }

    // Also boost concepts with children
    for (const c of concepts) {
        if (c.childCount > 0) {
            connectionCount.set(c.id, (connectionCount.get(c.id) || 0) + c.childCount);
        }
    }

    // Sort by connection count, keep top N
    const sorted = [...concepts].sort((a, b) =>
        (connectionCount.get(b.id) || 0) - (connectionCount.get(a.id) || 0)
    );
    const kept = sorted.slice(0, maxNodes);
    const keptIds = new Set(kept.map(c => c.id));
    const keptEdges = edges.filter(e => keptIds.has(e.from) && keptIds.has(e.to));

    return { concepts: kept, edges: keptEdges };
}

// GET /api/graph/:playlistId — get knowledge graph for visualization
// Optional query params: ?videoId=xxx&collapsed=true
router.get('/:playlistId', async (req, res) => {
    const { videoId, collapsed } = req.query;
    const shouldCollapse = collapsed !== 'false'; // collapse by default

    log('🕸️', 'GRAPH', `Fetching graph for playlist="${req.params.playlistId}"${videoId ? ` video=${videoId}` : ''} collapsed=${shouldCollapse}`);

    try {
        const graph = await getConceptGraph(req.params.playlistId, videoId || null);
        log('✅', 'GRAPH', `Raw graph: ${graph.concepts?.length || 0} concepts, ${graph.edges?.length || 0} edges`);

        let result = graph;

        // Collapse children into parents (for playlist-level view)
        if (shouldCollapse && !videoId) {
            result = collapseGraph(result.concepts, result.edges);
            log('📦', 'GRAPH', `Collapsed to ${result.concepts.length} top-level concepts`);
        }

        // Cap at 15 nodes max for readability
        result = capGraph(result.concepts, result.edges, 15);
        log('📊', 'GRAPH', `Final graph: ${result.concepts.length} concepts, ${result.edges.length} edges`);

        res.json(result);
    } catch (err) {
        log('⚠️', 'GRAPH', `Neo4j unavailable — returning empty graph: ${err.message}`);
        res.json({ concepts: [], edges: [] });
    }
});

export default router;
