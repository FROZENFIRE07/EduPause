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
export const getKnowledgeGraph = (playlistId, videoId = null) => {
  const params = {};
  if (videoId) params.videoId = videoId;
  return api.get(`/graph/${playlistId}`, { params });
};

// Transcripts
export const getTranscript = (videoId) =>
  api.get(`/transcript/${videoId}`);

// Search
export const searchContent = (query, type = 'all') =>
  api.get('/search', { params: { q: query, type } });

// Playlist videos
export const getPlaylistVideos = (playlistId) =>
  api.get(`/playlist/${playlistId}/videos`);

export default api;

// Roadmap
export const generateRoadmapApi = (videoIds) =>
  api.post('/roadmap', { videoIds });

export const getStructuredRoadmap = (playlistId) =>
  api.get(`/roadmap/${playlistId}`);

export const regenerateRoadmap = (playlistId) =>
  api.post(`/roadmap/${playlistId}/regenerate`);

// User Progress
export const getUserProgress = (userId, playlistId) =>
  api.get(`/progress/${userId}/${playlistId}`);

export const recordVideoWatch = (userId, playlistId, videoId, durationWatched, completed) =>
  api.post('/progress/watch', { userId, playlistId, videoId, durationWatched, completed });

export const getConceptMastery = (userId, playlistId) =>
  api.get(`/progress/${userId}/${playlistId}/mastery`);

export const detectBreak = (userId, playlistId) =>
  api.get(`/progress/${userId}/${playlistId}/break`);

// Next-Step Recommendations
export const getNextStep = (userId, playlistId) =>
  api.get(`/next-step/${userId}/${playlistId}`);

export const getLearningPath = (userId, playlistId, limit = 5) =>
  api.get(`/next-step/${userId}/${playlistId}/path`, { params: { limit } });

// Quiz
export const triggerQuiz = (userId, playlistId, videoId) =>
  api.post('/quiz/trigger', { userId, playlistId, videoId });

export const submitQuizAnswers = (quizSessionId, responses) =>
  api.post('/quiz/submit', { quizSessionId, responses });

export const skipQuizSession = (quizSessionId) =>
  api.post('/quiz/skip', { quizSessionId });

export const getQuizHistory = (userId, playlistId) =>
  api.get(`/quiz/history/${userId}/${playlistId}`);

export const generateQuizManual = (userId, playlistId, videoId, difficulty) =>
  api.post('/quiz/generate', { userId, playlistId, videoId, difficulty });

// Progress Visualization
export const getProgressVisualization = (userId, playlistId) =>
  api.get(`/progress/${userId}/${playlistId}/visualization`);

// Break Recovery
export const checkRecapNeeded = (userId, playlistId) =>
  api.get(`/break-recovery/check/${userId}/${playlistId}`);

export const generateRecap = (userId, playlistId) =>
  api.post('/break-recovery/generate', { userId, playlistId });

export const markRecapViewed = (userId, playlistId) =>
  api.post('/break-recovery/viewed', { userId, playlistId });
