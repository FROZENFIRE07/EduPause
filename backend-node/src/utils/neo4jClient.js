import neo4j from 'neo4j-driver';
import { log } from './logger.js';

let driver = null;
let connectionFailed = false;

function getDriver() {
    if (connectionFailed) return null;
    if (driver) return driver;

    const uri = process.env.NEO4J_URI;
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD;

    if (!uri || !password) {
        log('⚠️', 'NEO4J', 'No connection configured — concepts will not be persisted to graph');
        connectionFailed = true;
        return null;
    }

    try {
        driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
            maxConnectionPoolSize: 5,
            connectionAcquisitionTimeout: 10000, // 10s timeout
            connectionTimeout: 10000,
            logging: {
                level: 'warn',
                logger: (level, msg) => log('⚠️', 'NEO4J', msg),
            },
        });
        log('🔗', 'NEO4J', `Driver created for ${uri.substring(0, 30)}...`);
        return driver;
    } catch (e) {
        log('❌', 'NEO4J', `Driver creation failed: ${e.message}`);
        connectionFailed = true;
        return null;
    }
}

/**
 * Write concept nodes and prerequisite edges to Neo4j
 */
export async function writeConceptsToGraph(concepts) {
    const d = getDriver();
    if (!d) {
        log('📝', 'NEO4J', `[Mock] Would write ${concepts.length} concepts (no connection)`);
        return;
    }

    const session = d.session();
    try {
        for (const c of concepts) {
            await session.run(
                `MERGE (n:Concept {id: $id})
         SET n.label = $label, n.definition = $definition,
             n.videoId = $videoId, n.startTime = $startTime, n.endTime = $endTime,
             n.parentConcept = $parentConcept`,
                {
                    id: c.concept,
                    label: c.label || c.concept,
                    definition: c.definition || '',
                    videoId: c.videoId || '',
                    startTime: c.startTime || '',
                    endTime: c.endTime || '',
                    parentConcept: c.parentConcept || null,
                }
            );

            for (const prereq of (c.prerequisites || [])) {
                await session.run(
                    `MERGE (pre:Concept {id: $prereqId})
           MERGE (cur:Concept {id: $conceptId})
           MERGE (pre)-[:PREREQUISITE_OF]->(cur)`,
                    { prereqId: prereq, conceptId: c.concept }
                );
            }

            // Create CHILD_OF edge if parentConcept exists
            if (c.parentConcept) {
                await session.run(
                    `MERGE (parent:Concept {id: $parentId})
           MERGE (child:Concept {id: $childId})
           MERGE (child)-[:CHILD_OF]->(parent)`,
                    { parentId: c.parentConcept, childId: c.concept }
                );
            }
        }
        log('✅', 'NEO4J', `Wrote ${concepts.length} concepts to graph`);
    } catch (e) {
        // If the database is unreachable, mark as failed to avoid retrying
        if (e.message?.includes('routing') || e.message?.includes('No routing servers')) {
            log('⚠️', 'NEO4J', `Database unreachable (AuraDB may be paused). Disabling graph writes for this session.`);
            connectionFailed = true;
        } else {
            log('⚠️', 'NEO4J', `Write failed: ${e.message}`);
        }
        throw e; // Let caller handle
    } finally {
        await session.close();
    }
}

/**
 * Get the concept graph for visualization
 * @param {string} playlistId - not used for filtering today but kept for API compat
 * @param {string} [videoId] - optional: scope to a specific video
 */
export async function getConceptGraph(playlistId, videoId = null) {
    const d = getDriver();
    if (!d) {
        throw new Error('Neo4j not configured or unreachable');
    }

    const session = d.session();
    try {
        let nodesQuery, nodesParams;
        if (videoId) {
            nodesQuery = 'MATCH (n:Concept) WHERE n.videoId = $videoId RETURN n';
            nodesParams = { videoId };
        } else {
            nodesQuery = 'MATCH (n:Concept) RETURN n';
            nodesParams = {};
        }

        const nodesResult = await session.run(nodesQuery, nodesParams);

        // Get all edges involving our concepts
        const conceptIds = nodesResult.records.map(r => r.get('n').properties.id);
        const edgesResult = await session.run(
            `MATCH (a:Concept)-[:PREREQUISITE_OF]->(b:Concept) 
             WHERE a.id IN $ids AND b.id IN $ids
             RETURN a.id AS from, b.id AS to`,
            { ids: conceptIds }
        );

        return {
            concepts: nodesResult.records.map(r => {
                const n = r.get('n').properties;
                return {
                    id: n.id,
                    label: n.label || n.id,
                    definition: n.definition || '',
                    videoId: n.videoId || '',
                    parentConcept: n.parentConcept || null,
                    startTime: n.startTime || '',
                    endTime: n.endTime || '',
                };
            }),
            edges: edgesResult.records.map(r => ({
                from: r.get('from'),
                to: r.get('to'),
            })),
        };
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
