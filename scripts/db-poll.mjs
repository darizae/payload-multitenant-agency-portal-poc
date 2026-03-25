import { execSync } from 'node:child_process'

const INTERVAL_MS = 2000
const TIMEOUT_MS = Number(process.env.DB_POLL_TIMEOUT_MS || 60000)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readStatus() {
  try {
    return execSync('docker compose ps --format json', { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim()
  } catch (error) {
    const message = error?.stderr?.toString()?.trim() || String(error)
    return `__ERROR__\n${message}`
  }
}

function parseRows(snapshot) {
  if (!snapshot || snapshot.startsWith('__ERROR__')) return []
  return snapshot
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

function isPostgresHealthy(rows) {
  const postgres = rows.find((row) => row.Service === 'postgres')
  if (!postgres) return false
  return postgres.State === 'running' && postgres.Health === 'healthy'
}

async function main() {
  const startedAt = Date.now()
  console.log(`Waiting for Postgres to become healthy (timeout ${Math.floor(TIMEOUT_MS / 1000)}s)...`)

  while (Date.now() - startedAt < TIMEOUT_MS) {
    const snapshot = readStatus()
    const rows = parseRows(snapshot)
    if (isPostgresHealthy(rows)) {
      console.log('Postgres is healthy.')
      process.exit(0)
    }

    if (snapshot.startsWith('__ERROR__')) {
      console.log(snapshot.replace('__ERROR__\n', ''))
    } else {
      const postgres = rows.find((row) => row.Service === 'postgres')
      if (postgres) {
        console.log(`postgres status: ${postgres.Status}`)
      } else {
        console.log('postgres status: not found')
      }
    }

    await sleep(INTERVAL_MS)
  }

  console.error(`Timed out waiting for Postgres health after ${Math.floor(TIMEOUT_MS / 1000)}s.`)
  process.exit(1)
}

await main()
