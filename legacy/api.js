import axios from 'axios';

const BASE = import.meta.en .VITE_API_URL|| 'http://localhost:5000/api';

const getToken = () => localStorage.getItem('token');
const authHeader = () => ({ headers: { Authorization: `Bearer ${getToken()}` } });

export const register = (payload) => axios.post(`${BASE}/auth/register`, payload);
export const login = (payload) => axios.post(`${BASE}/auth/login`, payload);

export const fetchTasks = () => axios.get(`${BASE}/tasks`, authHeader());
export const createTask = (data) => axios.post(`${BASE}/tasks`, data, authHeader());
export const updateTask = (id, data) => axios.put(`${BASE}/tasks/${id}`, data, authHeader());
export const deleteTask = (id) => axios.delete(`${BASE}/tasks/${id}`, authHeader());

export const fetchPerformance = (days = 14) => axios.get(`${BASE}/performance?days=${days}`, authHeader());