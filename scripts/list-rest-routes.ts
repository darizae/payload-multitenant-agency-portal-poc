import config from '../payload.config'

type RouteTemplate = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  suffix: string
}

const COLLECTION_ROUTE_TEMPLATES: RouteTemplate[] = [
  { method: 'GET', suffix: '/count' },
  { method: 'POST', suffix: '/' },
  { method: 'DELETE', suffix: '/' },
  { method: 'DELETE', suffix: '/:id' },
  { method: 'POST', suffix: '/access/:id?' },
  { method: 'GET', suffix: '/versions' },
  { method: 'POST', suffix: '/:id/duplicate' },
  { method: 'GET', suffix: '/' },
  { method: 'GET', suffix: '/:id' },
  { method: 'GET', suffix: '/versions/:id' },
  { method: 'POST', suffix: '/versions/:id' },
  { method: 'PATCH', suffix: '/' },
  { method: 'PATCH', suffix: '/:id' },
]

const AUTH_COLLECTION_ROUTE_TEMPLATES: RouteTemplate[] = [
  { method: 'POST', suffix: '/forgot-password' },
  { method: 'GET', suffix: '/init' },
  { method: 'POST', suffix: '/login' },
  { method: 'POST', suffix: '/logout' },
  { method: 'GET', suffix: '/me' },
  { method: 'POST', suffix: '/refresh-token' },
  { method: 'POST', suffix: '/first-register' },
  { method: 'POST', suffix: '/reset-password' },
  { method: 'POST', suffix: '/unlock' },
  { method: 'POST', suffix: '/verify/:id' },
]

const ROOT_AUTH_ROUTE_TEMPLATES: RouteTemplate[] = [
  { method: 'GET', suffix: '/access' },
]

function joinPath(base: string, suffix: string): string {
  if (suffix === '/') return base
  return `${base}${suffix}`
}

function printRoute(method: string, path: string) {
  const padded = method.padEnd(6, ' ')
  console.log(`${padded} ${path}`)
}

async function main() {
  const resolvedConfig = await config
  const apiBase = resolvedConfig.routes?.api || '/api'
  const collections = (resolvedConfig.collections || []).filter((collection) => !collection.slug.startsWith('payload-'))

  console.log('Payload REST route map (literal paths)')
  console.log(`API base: ${apiBase}`)
  console.log('')

  console.log('Root routes:')
  for (const route of ROOT_AUTH_ROUTE_TEMPLATES) {
    printRoute(route.method, joinPath(apiBase, route.suffix))
  }
  console.log('')

  console.log('Collection routes:')
  for (const collection of collections) {
    const base = `${apiBase}/${collection.slug}`
    console.log(`- ${collection.slug}`)

    for (const route of COLLECTION_ROUTE_TEMPLATES) {
      printRoute(route.method, joinPath(base, route.suffix))
    }

    if (collection.auth) {
      for (const route of AUTH_COLLECTION_ROUTE_TEMPLATES) {
        printRoute(route.method, joinPath(base, route.suffix))
      }
    }

    console.log('')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
