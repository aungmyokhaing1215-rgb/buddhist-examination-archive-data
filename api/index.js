import publicCatalog from '../server/handlers/public/catalog.js'
import publicExam from '../server/handlers/public/exam.js'
import publicIndex from '../server/handlers/public/index.js'
import publicSearch from '../server/handlers/public/search.js'
import publicLesson from '../server/handlers/public/lesson.js'
import adminCatalog from '../server/handlers/admin/catalog.js'
import adminDashboard from '../server/handlers/admin/dashboard.js'
import adminExam from '../server/handlers/admin/exam.js'
import adminExport from '../server/handlers/admin/export.js'
import adminImport from '../server/handlers/admin/import.js'
import adminLogin from '../server/handlers/admin/login.js'
import adminLogout from '../server/handlers/admin/logout.js'
import adminPublish from '../server/handlers/admin/publish.js'
import adminSearch from '../server/handlers/admin/search.js'
import adminSession from '../server/handlers/admin/session.js'
import adminSubject from '../server/handlers/admin/subject.js'
import adminValidate from '../server/handlers/admin/validate.js'
import adminLesson from '../server/handlers/admin/lesson.js'
import { send } from '../server/_lib/http.js'

const handlers = {
  'public/catalog': publicCatalog,
  'public/exam': publicExam,
  'public/index': publicIndex,
  'public/search': publicSearch,
  'public/lesson': publicLesson,
  'admin/catalog': adminCatalog,
  'admin/dashboard': adminDashboard,
  'admin/exam': adminExam,
  'admin/export': adminExport,
  'admin/import': adminImport,
  'admin/login': adminLogin,
  'admin/logout': adminLogout,
  'admin/publish': adminPublish,
  'admin/search': adminSearch,
  'admin/session': adminSession,
  'admin/subject': adminSubject,
  'admin/validate': adminValidate,
  'admin/lesson': adminLesson,
}

export default async function handler(req, res) {
  const routeParam = req.query?.path ?? req.query?.route
  const route = Array.isArray(routeParam)
    ? routeParam.join('/')
    : typeof routeParam === 'string'
      ? routeParam.replace(/^\/+|\/+$/g, '')
      : String(req.url || '').split('?')[0].replace(/^\/api\/?/, '')
  const selected = handlers[route]
  if (!selected) return send(res, 404, { error: 'API route not found' })
  return selected(req, res)
}
