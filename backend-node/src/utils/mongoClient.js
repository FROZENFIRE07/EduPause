import { MongoClient } from 'mongodb';
import { log } from './logger.js';

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
        log('🔌', 'MONGODB', `Connecting to ${DB_NAME}...`);
        client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DB_NAME);
        log('✅', 'MONGODB', `Connected to ${DB_NAME}`);

        // Create indexes
        await db.collection('sessions').createIndex({ sessionId: 1 }, { unique: true });
        await db.collection('clickstream').createIndex({ sessionId: 1, receivedAt: -1 });
        await db.collection('playlists').createIndex({ playlistUrl: 1 });
        log('📇', 'MONGODB', `Indexes created for sessions, clickstream, playlists`);

        return db;
    } catch (err) {
        log('⚠️', 'MONGODB', `Connection failed: ${err.message}`);
        log('📦', 'MONGODB', `Using in-memory mock store`);

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
        log('🔌', 'MONGODB', `Closing connection...`);
        await client.close();
        client = null;
        db = null;
    }
}
