import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB || 'mastery_os';

let client = null;
let db = null;

/**
 * Get MongoDB database instance (lazy connection)
 * @returns {Promise<import('mongodb').Db>}
 */
export async function getDB() {
    if (db) return db;

    try {
        client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DB_NAME);
        console.log(`[MongoDB] Connected to ${DB_NAME}`);

        // Create indexes
        await db.collection('sessions').createIndex({ sessionId: 1 }, { unique: true });
        await db.collection('clickstream').createIndex({ sessionId: 1, receivedAt: -1 });
        await db.collection('playlists').createIndex({ playlistUrl: 1 });

        return db;
    } catch (err) {
        console.warn('[MongoDB] Connection failed:', err.message);
        console.warn('[MongoDB] Using in-memory mock');

        // In-memory mock for demo
        const mockCollections = {};
        db = {
            collection: (name) => {
                if (!mockCollections[name]) {
                    const docs = [];
                    mockCollections[name] = {
                        insertOne: async (doc) => { docs.push({ ...doc, _id: Date.now().toString() }); return { insertedId: doc._id }; },
                        find: () => ({
                            sort: () => ({
                                limit: (n) => ({
                                    toArray: async () => docs.slice(0, n),
                                }),
                            }),
                            toArray: async () => docs,
                        }),
                        findOne: async (query) => docs.find(d => {
                            return Object.keys(query).every(k => d[k] === query[k]);
                        }) || null,
                        updateOne: async (query, update) => {
                            const doc = docs.find(d => Object.keys(query).every(k => d[k] === query[k]));
                            if (doc && update.$set) Object.assign(doc, update.$set);
                        },
                        createIndex: async () => { },
                    };
                }
                return mockCollections[name];
            },
        };
        return db;
    }
}

/**
 * Graceful shutdown
 */
export async function closeDB() {
    if (client) {
        await client.close();
        client = null;
        db = null;
    }
}
