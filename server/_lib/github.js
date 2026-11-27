const apiRoot = 'https://api.github.com'

function config() {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH = 'main', GITHUB_DATA_PATH = 'public/data' } = process.env
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) throw Error('GitHub storage is not configured')
  if (!/^[A-Za-z0-9_.-]+$/.test(GITHUB_OWNER) || !/^[A-Za-z0-9_.-]+$/.test(GITHUB_REPO)) throw Error('GitHub repository configuration is invalid')
  if (!GITHUB_BRANCH || GITHUB_BRANCH.startsWith('-')) throw Error('GitHub branch configuration is invalid')
  const root = GITHUB_DATA_PATH.replace(/^\/+|\/+$/g, '')
  if (root.split('/').some((part) => !/^[A-Za-z0-9_.-]+$/.test(part) || part === '.' || part === '..')) throw Error('GitHub data path configuration is invalid')
  return { token: GITHUB_TOKEN, owner: GITHUB_OWNER, repo: GITHUB_REPO, branch: GITHUB_BRANCH, path: root }
}

function headers(c) {
  return { Accept: 'application/vnd.github+json', Authorization: `Bearer ${c.token}`, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }
}

function storagePath(relative, root) {
  const c = config()
  const selectedRoot = root === undefined ? c.path : root
  if (selectedRoot !== '' && selectedRoot !== c.path) throw Error('Invalid JSON storage root')
  if (typeof relative !== 'string' || relative.includes('\\') || relative.startsWith('/') || relative.includes('\0')) throw Error('Invalid JSON storage path')
  const parts = relative.split('/')
  if (parts.some((part) => !part || part === '.' || part === '..' || !/^[A-Za-z0-9_.-]+$/.test(part)) || !relative.endsWith('.json')) throw Error('Invalid JSON storage path')
  const allowed = selectedRoot === ''
    ? /^drafts\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/20(?:0[0-9]|1[0-9]|2[0-6])\/[a-z0-9]+(?:-[a-z0-9]+)*|lessons\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*)\.json$/
    : /^(?:classes|subjects|index|lessons)\.json$|^exams\/[a-z0-9]+(?:-[a-z0-9]+)*\/20(?:0[0-9]|1[0-9]|2[0-6])\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$|^lessons\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/
  if (!allowed.test(relative)) throw Error('Invalid JSON storage path')
  return `${selectedRoot ? `${selectedRoot}/` : ''}${relative}`
}

async function request(url, options = {}) {
  let result
  try {
    const c = config()
    result = await fetch(url, { ...options, headers: { ...headers(c), ...(options.headers || {}) } })
  } catch (cause) {
    const error = Error('Could not reach GitHub. Check the network and retry.')
    error.status = 503
    error.cause = cause
    throw error
  }
  if (!result.ok) {
    let details = ''
    try { details = (await result.json()).message || '' } catch { /* GitHub may return an empty error body. */ }
    const error = Error(result.status === 409 || (result.status === 422 && /sha|conflict|reference/i.test(details)) ? 'GitHub reported a concurrent update conflict.' : `GitHub request failed (${result.status})${details ? `: ${details}` : ''}`)
    error.status = result.status === 422 && /sha|conflict|reference/i.test(details) ? 409 : result.status
    throw error
  }
  return result.status === 204 ? null : result.json()
}

async function api(path, options = {}) {
  const c = config()
  return request(`${apiRoot}/repos/${c.owner}/${c.repo}/${path}`, options)
}

async function contents(relative, root, options, query = '') {
  const c = config()
  const path = storagePath(relative, root).split('/').map(encodeURIComponent).join('/')
  return request(`${apiRoot}/repos/${c.owner}/${c.repo}/contents/${path}${query}`, options)
}

async function gitCommit(relative, data, message, root, remove = false, expectedSha) {
  const c = config()
  const path = storagePath(relative, root)
  const head = await api(`git/ref/heads/${encodeURIComponent(c.branch)}`)
  const parent = await api(`git/commits/${head.object.sha}`)
  const baseTree = await api(`git/trees/${parent.tree.sha}?recursive=1`)
  const current = baseTree.tree.find((file) => file.path === path)
  if ((current?.sha || null) !== (expectedSha || null)) {
    const conflict = Error('GitHub file changed during update')
    conflict.status = 409
    throw conflict
  }
  let blobSha = null
  if (!remove) blobSha = (await api('git/blobs', { method: 'POST', body: JSON.stringify({ content: data, encoding: 'utf-8' }) })).sha
  const tree = await api('git/trees', { method: 'POST', body: JSON.stringify({ base_tree: parent.tree.sha, tree: [{ path, mode: '100644', type: 'blob', sha: blobSha }] }) })
  const commit = await api('git/commits', { method: 'POST', body: JSON.stringify({ message, tree: tree.sha, parents: [head.object.sha] }) })
  const updatedRef = await api(`git/refs/heads/${encodeURIComponent(c.branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) })
  if (updatedRef?.object?.sha !== commit.sha) throw Error('GitHub did not confirm the new commit on the configured branch')
  return { commit }
}

export async function readJson(relative, root) {
  try {
    const filePath = storagePath(relative, root)
    const file = await contents(relative, root, { method: 'GET', headers: { Accept: 'application/vnd.github+json' } }, `?ref=${encodeURIComponent(config().branch)}`)
    const encoded = file.content ? Buffer.from(file.content, 'base64').toString('utf8') : (await api(`git/blobs/${file.sha}`)).content
    const source = file.content ? encoded : Buffer.from(encoded, 'base64').toString('utf8')
    try { return { data: JSON.parse(source), sha: file.sha } } catch {
      const error = Error(`Invalid JSON stored at ${filePath}`)
      error.status = 502
      throw error
    }
  } catch (error) {
    if (error.status === 404) return { data: null, sha: null }
    throw error
  }
}

export async function writeJson(relative, data, message, sha, root) {
  const filePath = storagePath(relative, root)
  const serialized = `${JSON.stringify(data, null, 2)}\n`
  if (Buffer.byteLength(serialized, 'utf8') > 900000) return gitCommit(relative, serialized, message, root, false, sha)
  const c = config()
  const result = await contents(relative, root, { method: 'PUT', body: JSON.stringify({ message, content: Buffer.from(serialized).toString('base64'), branch: c.branch, ...(sha ? { sha } : {}) }) })
  if (!result?.commit?.sha) throw Error('GitHub did not confirm the JSON commit')
  return result
}

export async function deleteJson(relative, sha, message = 'Remove JSON archive file', root) {
  storagePath(relative, root)
  if (!sha) throw Error('Cannot remove a file without its current SHA')
  const c = config()
  const result = await contents(relative, root, { method: 'DELETE', body: JSON.stringify({ message, sha, branch: c.branch }) })
  if (!result?.commit?.sha) throw Error('GitHub did not confirm the JSON deletion commit')
  return result
}

export async function treeFiles(folder = 'exams', root) {
  const c = config()
  const selectedRoot = root === undefined ? c.path : root
  if (!['exams', 'lessons', 'drafts'].includes(folder) || (selectedRoot !== '' && selectedRoot !== c.path)) throw Error('Invalid JSON storage folder')
  const head = await api(`git/ref/heads/${encodeURIComponent(c.branch)}`)
  const commit = await api(`git/commits/${head.object.sha}`)
  const tree = await api(`git/trees/${commit.tree.sha}?recursive=1`)
  const base = selectedRoot ? `${selectedRoot}/` : ''
  const prefix = `${base}${folder}/`
  return (tree.tree || []).filter((file) => file.type === 'blob' && file.path.startsWith(prefix) && file.path.endsWith('.json')).map((file) => file.path.slice(base.length))
}
