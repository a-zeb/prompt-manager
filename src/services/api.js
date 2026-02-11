import axios from 'axios';

const API_BASE_URL = 'http://localhost:5005/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

export const aiService = {
    optimize: async (prompt) => {
        const response = await api.post('/ai/optimize', { prompt });
        return response.data;
    },
    analyze: async (prompts) => {
        const response = await api.post('/ai/analyze', { prompts });
        return response.data;
    }
};

export const promptService = {
    getAll: async () => {
        const response = await api.get('/prompts');
        return response.data;
    },
    create: async (data) => {
        const response = await api.post('/prompts', data);
        return response.data;
    },
    update: async (id, data) => {
        const response = await api.put(`/prompts/${id}`, data);
        return response.data;
    },
    delete: async (id) => {
        const response = await api.delete(`/prompts/${id}`);
        return response.data;
    }
};

export default api;
