import axios from 'axios'

const api = axios.create({ baseURL: '/api', timeout: 15000, headers: { Accept: 'application/json' } })
export const getCatalog = async () => (await api.get('/public/catalog')).data
export const getSearchIndex = async () => (await api.get('/public/index')).data
export const searchArchive = async (params) => (await api.get('/public/search', { params })).data
export const getExam = async (params) => (await api.get('/public/exam', { params })).data
export const adminLogin = async (password) => (await api.post('/admin/login', { password })).data
export const getSession = async () => (await api.get('/admin/session')).data
export const saveExam = async (exam) => (await api.put('/admin/exam', exam)).data
export const getAdminExam = async (params) => (await api.get('/admin/exam', { params })).data
export const publishExam = async (exam) => (await api.post('/admin/publish', exam)).data
export const saveSubject = async (subject) => (await api.put('/admin/subject', subject)).data
export const importCatalog = async (catalog) => (await api.post('/admin/import', catalog)).data
export const exportArchive = async () => (await api.get('/admin/export')).data
export default api
