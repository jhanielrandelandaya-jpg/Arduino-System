const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, '..', 'data')
const usersFile = path.join(dataDir, 'users.json')

const ensureStore = async () => {
  await fs.promises.mkdir(dataDir, { recursive: true })

  try {
    await fs.promises.access(usersFile)
  } catch {
    await fs.promises.writeFile(usersFile, '[]', 'utf8')
  }
}

const readUsers = async () => {
  await ensureStore()
  const raw = await fs.promises.readFile(usersFile, 'utf8')

  try {
    const users = JSON.parse(raw)
    return Array.isArray(users) ? users : []
  } catch {
    return []
  }
}

const writeUsers = async (users) => {
  await ensureStore()
  await fs.promises.writeFile(
    usersFile,
    `${JSON.stringify(users, null, 2)}\n`,
    'utf8',
  )
}

module.exports = { readUsers, writeUsers }
