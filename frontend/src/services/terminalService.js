import api from '../api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const startSession = async (language, code) => {
  const res = await api.post('/terminal/start', { language, code });
  return res.data;
};

export const getActiveSession = async () => {
  const res = await api.get('/terminal/active');
  return res.data;
};

export const stopSession = async (sessionId) => {
  const res = await api.post(`/terminal/${sessionId}/stop`);
  return res.data;
};

export const getHistory = async () => {
  const res = await api.get('/terminal/history');
  return res.data;
};

export const getWebSocketUrl = (sessionId) => {
  if (API_URL.startsWith('http')) {
    const url = new URL(API_URL);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}/ws/terminal/${sessionId}`;
  } else {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/terminal/${sessionId}`;
  }
};
