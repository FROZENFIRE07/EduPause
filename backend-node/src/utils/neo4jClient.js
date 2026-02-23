import neo4j from 'neo4j-driver';

let driver = null;

function getDriver() {
    if (driver) return driver;

    const uri = process.env.NEO4J_URI;
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD;

    if (!uri || !password) {
        console.warn('[Neo4j] No connection configured — using mock mode');
        return null;
    }

    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    return driver;
}

/**
 * Write concept nodes and prerequisite edges to Neo4j
 * @param {{ concept: string, label: string, prerequisites: string[], definition: string }[]} concepts
 */
export async function writeConceptsToGraph(concepts) {
    const d = getDriver();
    if (!d) {
        console.log(`[Neo4j Mock] Would write ${concepts.length} concepts`);
        return;
    }

    const session = d.session();
    try {
        for (const c of concepts) {
            // Create or merge concept node
            await session.run(
                `MERGE (n:Concept {id: $id})
         SET n.label = $label, n.definition = $definition`,
                { id: c.concept, label: c.label || c.concept, definition: c.definition || '' }
            );

            // Create prerequisite edges
            for (const prereq of (c.prerequisites || [])) {
                await session.run(
                    `MERGE (pre:Concept {id: $prereqId})
           MERGE (cur:Concept {id: $conceptId})
           MERGE (pre)-[:PREREQUISITE_OF]->(cur)`,
                    { prereqId: prereq, conceptId: c.concept }
                );
            }
        }
        console.log(`[Neo4j] Wrote ${concepts.length} concepts to graph`);
    } finally {
        await session.close();
    }
}

/**
 * Get the full concept graph for visualization
 * @returns {{ concepts: object[], edges: object[] }}
 */
export async function getConceptGraph(playlistId) {
    const d = getDriver();
    if (!d) {
        throw new Error('Neo4j not configured');
    }

    const session = d.session();
    try {
        const nodesResult = await session.run('MATCH (n:Concept) RETURN n');
        const edgesResult = await session.run(
            'MATCH (a:Concept)-[:PREREQUISITE_OF]->(b:Concept) RETURN a.id AS from, b.id AS to'
        );

        const concepts = nodesResult.records.map(r => {
            const n = r.get('n').properties;
            return { id: n.id, label: n.label || n.id };
        });

        const edges = edgesResult.records.map(r => ({
            from: r.get('from'),
            to: r.get('to'),
        }));

        return { concepts, edges };
    } finally {
        await session.close();
    }
}

/**
 * Get prerequisites for a specific concept
 */
export async function getPrerequisites(conceptId) {
    const d = getDriver();
    if (!d) return [];

    const session = d.session();
    try {
        const result = await session.run(
            `MATCH (pre:Concept)-[:PREREQUISITE_OF]->(cur:Concept {id: $id})
       RETURN pre.id AS id, pre.label AS label`,
            { id: conceptId }
        );
        return result.records.map(r => ({
            id: r.get('id'),
            label: r.get('label'),
        }));
    } finally {
        await session.close();
    }
}
