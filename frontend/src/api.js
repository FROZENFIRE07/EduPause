import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
});

// Ingestion
export const ingestPlaylist = (playlistUrl) =>
  api.post('/ingest', { playlistUrl });

export const getIngestionStatus = (jobId) =>
  api.get(`/ingest/status/${jobId}`);

// Clickstream
export const sendClickstreamEvent = (sessionId, event) =>
  api.post('/clickstream', { sessionId, event });

// Session
export const createSession = (userId, playlistId) =>
  api.post('/session', { userId, playlistId });

export const getSession = (sessionId) =>
  api.get(`/session/${sessionId}`);

export const getMasteryData = (sessionId) =>
  api.get(`/session/${sessionId}/mastery`);

// Agent
export const invokeAgent = (sessionId, action, payload = {}) =>
  api.post('/agent/invoke', { sessionId, action, ...payload });

export const getAgentResponse = (sessionId) =>
  api.get(`/agent/response/${sessionId}`);

// Knowledge Graph
export const getKnowledgeGraph = (playlistId) =>
  api.get(`/graph/${playlistId}`);

export default api;
