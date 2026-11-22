import axios from 'axios'

const api = axios.create({ baseURL: '/api', timeout: 15000, headers: { Accept: 'application/json' } })
let csrfToken = ''
api.interceptors.request.use((config) => {
  if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(String(config.method).toLowerCase())) {
    config.headers['X-CSRF-Token'] = csrfToken
  }
  return config
})
const staticData = axios.create({ headers: { Accept: 'application/json' } })
const YEARS = Array.from({ length: 27 }, (_, index) => 2000 + index)

async function getStaticJson(path) {
  const response = await staticData.get(path)
  return response.data
}

async function getStaticCatalog() {
  const [classes, subjects] = await Promise.all([
    getStaticJson('/data/classes.json'),
    getStaticJson('/data/subjects.json'),
  ])

  return {
    classes: classes
      .filter((item) => item.status === 'active')
      .sort((a, b) => a.order - b.order)
      .map((item) => ({
        ...item,
        subjects: subjects
          .filter((subject) => subject.classId === item.id && subject.status === 'active')
          .sort((a, b) => a.order - b.order),
      })),
    years: YEARS,
  }
}

export const getCatalog = async () => {
  try {
    const { data } = await api.get('/public/catalog')
    if (Array.isArray(data?.classes) && Array.isArray(data?.years)) return data
  } catch {
    // Vite's development server does not run Vercel functions; use the public JSON files.
  }
  return getStaticCatalog()
}

export const getSearchIndex = async () => {
  try {
    const { data } = await api.get('/public/index')
    if (Array.isArray(data)) return data
  } catch {
    // Fall through to the same published JSON index used by the Vercel function.
  }
  return getStaticJson('/data/index.json')
}

export const searchArchive = async (params) => {
  try {
    const { data } = await api.get('/public/search', { params })
    if (Array.isArray(data?.results)) return data
  } catch {
    // Search the published index locally while running without serverless functions.
  }

  const query = String(params.query || '').trim().normalize('NFC').toLocaleLowerCase()
  const hasFilters = Boolean(params.classSlug || params.year || params.subjectId)
  const page = Math.max(1, Number.parseInt(params.page, 10) || 1)
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(params.pageSize, 10) || 20))
  if (query.length < 2 && !hasFilters) return { results: [], total: 0, page, pageSize }

  const index = await getSearchIndex()
  const terms = query.split(/\s+/).filter(Boolean)
  const results = []
  for (const exam of index) {
    if (params.classSlug && exam.classId !== params.classSlug) continue
    if (params.year && String(exam.year) !== String(params.year)) continue
    if (params.subjectId && exam.subjectId !== params.subjectId) continue
    for (const section of exam.sections || []) {
      for (const question of section.questions || []) {
        const questionText = question.questionText || ''
        const answerText = question.answerText || ''
        const keywords = Array.isArray(question.keywords)
          ? question.keywords.join(' ')
          : String(question.keywords || '')
        const searchable = `${questionText} ${answerText} ${keywords}`.normalize('NFC').toLocaleLowerCase()
        if (terms.every((term) => searchable.includes(term))) {
          results.push({
            id: question.id,
            classSlug: exam.classId,
            className: exam.className,
            year: exam.year,
            subjectId: exam.subjectId,
            subjectName: exam.subjectName,
            title: exam.title,
            questionNumber: question.number,
            questionText,
            answerText,
            sectionId: section.id,
          })
        }
      }
    }
  }
  const start = (page - 1) * pageSize
  return { results: results.slice(start, start + pageSize), total: results.length, page, pageSize }
}

export const getExam = async (params) => {
  try {
    const { data } = await api.get('/public/exam', { params })
    if (data && typeof data === 'object' && Array.isArray(data.sections)) return data
  } catch {
    // Fall through to the published exam JSON for Vite's development server.
  }

  const catalog = await getStaticCatalog()
  const selectedClass = catalog.classes.find((item) => item.slug === params.classSlug)
  const subject = selectedClass?.subjects.find(
    (item) => item.id === params.subjectId || item.slug === params.subjectId,
  )
  if (!selectedClass || !subject) throw new Error('Examination not found')

  const exam = await getStaticJson(
    `/data/exams/${selectedClass.slug}/${params.year}/${subject.slug}.json`,
  )
  if (exam.status !== 'published') throw new Error('Examination not found')
  return exam
}
export const adminLogin = async (username, password) => { const { data } = await api.post('/admin/login', { username, password }); csrfToken = data.csrfToken || ''; return data }
export const getSession = async () => { const { data } = await api.get('/admin/session'); csrfToken = data.csrfToken || ''; return data }
export const adminLogout = async () => { const result = await api.post('/admin/logout'); csrfToken = ''; return result.data }
export const getAdminCatalog = async () => (await api.get('/admin/catalog')).data
export const saveClass = async (payload) => (await api.put('/admin/catalog', payload)).data
export const getAdminDashboard = async () => (await api.get('/admin/dashboard')).data
export const searchAdmin = async (params) => (await api.get('/admin/search', { params })).data
export const saveExam = async (exam) => (await api.put('/admin/exam', exam)).data
export const getAdminExam = async (params) => (await api.get('/admin/exam', { params })).data
export const publishExam = async (exam) => (await api.post('/admin/publish', exam)).data
export const saveSubject = async (subject) => (await api.put('/admin/subject', subject)).data
export const deleteExam = async (payload) => (await api.delete('/admin/exam', { data: payload })).data
export const importCatalog = async (catalog) => (await api.post('/admin/import', catalog)).data
export const validateArchive = async (backup) => (await api.post('/admin/validate', backup)).data
export const exportArchive = async () => (await api.get('/admin/export')).data
export default api
