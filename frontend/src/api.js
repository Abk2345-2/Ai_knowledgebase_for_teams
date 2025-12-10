import axios from "axios";

const API_BASE_URL = '/api';

export const api = {
    getDocuments: async () => {
        const response = await axios.get(`${API_BASE_URL}/documents`);
        return response.data;
    },
    getDocument: async (id) => {
        const response = await axios.get(`${API_BASE_URL}/documents/${id}`);
        return response.data;
    },
    uploadDocument: async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },
    askQuestion: async (question) => {
        const response = await axios.post(`${API_BASE_URL}/ask?question=${encodeURIComponent(question)}`);
        return response.data;
    },
    login: async (email, password) => {
        const response = await axios.post(`${API_BASE_URL}/login`, { email, password });
        return response.data;
    },
    register: async (email, name, password) => {
        const response = await axios.post(`${API_BASE_URL}/register`, { email, name, password });
        return response.data;
    },
}

axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
})

axios.interceptors.response.use((response) => {
    return response;
}, (error) => {
    if (error.response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
    }
    return Promise.reject(error);
})