import fs from 'node:fs'
import path from 'node:path'
import config from '../payload.config'
import { getPayload } from 'payload'
import { issueInvite } from '@/lib/invites'

type StoreSeed = {
  name: string
}

type AgencySeed = {
  name: string
  stores: StoreSeed[]
}

type MetricsRow = {
  agency_name: string
  store_name: string
  metric_date: string
  source: string
  net_sales: string | number
  gross_profit: string | number
  marketing_ad_spend: string | number
  mer: string | number
}

const AGENCY_SEED: AgencySeed[] = [
  {
    name: 'Aurora Agency',
    stores: [
      { name: 'Aurora Bikes' },
      { name: 'Aurora Coffee' },
      { name: 'Aurora Fitness' },
      { name: 'Aurora Pets' },
      { name: 'Aurora Apparel' },
    ],
  },
  {
    name: 'Beacon Agency',
    stores: [
      { name: 'Beacon Home' },
      { name: 'Beacon Outdoor' },
      { name: 'Beacon Grooming' },
      { name: 'Beacon Snacks' },
      { name: 'Beacon Supplements' },
    ],
  },
  {
    name: 'Catalyst Agency',
    stores: [
      { name: 'Catalyst Beauty' },
      { name: 'Catalyst Tech' },
      { name: 'Catalyst Wellness' },
      { name: 'Catalyst Kids' },
      { name: 'Catalyst Studio' },
    ],
  },
]

const PARQUET_PATH = path.resolve(process.cwd(), 'data/fixtures/shopify_metrics_daily.parquet')
const DEMO_PASSWORD = 'Passw0rd!Demo'

function toNumber(value: string | number): number {
  if (typeof value === 'number') return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

async function ensureDatabaseIsEmpty(payload: any) {
  const agencies = await payload.count({ collection: 'agencies', overrideAccess: true })
  if (agencies.totalDocs > 0) {
    throw new Error('Database is not empty. Run `npm run db:reseed` to reset and reseed.')
  }
}

async function loadParquetRows(): Promise<MetricsRow[]> {
  if (!fs.existsSync(PARQUET_PATH)) {
    throw new Error(`Parquet fixture not found at ${PARQUET_PATH}. Run python3 scripts/data/generate_shopify_metrics_parquet.py`)
  }

  const parquetModule = await import('parquetjs-lite')
  const parquet = parquetModule.default
  const reader = await parquet.ParquetReader.openFile(PARQUET_PATH)
  const cursor = reader.getCursor()
  const rows: MetricsRow[] = []

  while (true) {
    const row = await cursor.next()
    if (!row) break
    rows.push(row as MetricsRow)
  }

  await reader.close()
  return rows
}

async function main() {
  const payload = await getPayload({ config }) as any
  console.log('Seeding Postgres demo data...')
  await ensureDatabaseIsEmpty(payload)

  const storeheroRoot = await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: {
      name: 'Storehero Root',
      email: process.env.SEED_STOREHERO_ROOT_EMAIL || 'storehero.root@poc.local',
      password: process.env.SEED_STOREHERO_ROOT_PASSWORD || DEMO_PASSWORD,
      role: 'storehero-root',
      status: 'active',
    },
  })

  const storeheroMember = await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: {
      name: 'Storehero Member',
      email: 'storehero.member@poc.local',
      password: DEMO_PASSWORD,
      role: 'storehero-member',
      status: 'active',
    },
  })

  const agencyByName = new Map<string, any>()
  const agencyRootByAgencyId = new Map<number, any>()
  const agencyMemberByAgencyId = new Map<number, any>()
  const storeByComposite = new Map<string, any>()

  for (const agencySeed of AGENCY_SEED) {
    const agency = await payload.create({
      collection: 'agencies',
      overrideAccess: true,
      data: {
        name: agencySeed.name,
        status: 'active',
        primaryContactName: `${agencySeed.name} Contact`,
        primaryContactEmail: `${agencySeed.name.toLowerCase().replace(/\s+/g, '.')}@poc.local`,
        primaryContactPhone: '+1-555-0100',
      },
      user: storeheroRoot,
    })
    agencyByName.set(agencySeed.name, agency)

    const agencyRoot = await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        name: `${agencySeed.name} Root`,
        email: `${agencySeed.name.toLowerCase().replace(/\s+/g, '.')}+root@poc.local`,
        password: DEMO_PASSWORD,
        role: 'agency-root',
        status: 'active',
        agency: agency.id,
      },
      user: storeheroRoot,
    })

    const agencyMember = await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        name: `${agencySeed.name} Member`,
        email: `${agencySeed.name.toLowerCase().replace(/\s+/g, '.')}+member@poc.local`,
        password: DEMO_PASSWORD,
        role: 'agency-member',
        status: 'active',
        agency: agency.id,
        hasGlobalStoreAccess: false,
      },
      user: agencyRoot,
    })

    agencyRootByAgencyId.set(agency.id, agencyRoot)
    agencyMemberByAgencyId.set(agency.id, agencyMember)

    for (let index = 0; index < agencySeed.stores.length; index += 1) {
      const storeSeed = agencySeed.stores[index]
      const store = await payload.create({
        collection: 'stores',
        overrideAccess: true,
        data: {
          agency: agency.id,
          name: storeSeed.name,
          status: 'active',
          contactName: `${storeSeed.name} Owner`,
          contactEmail: `${storeSeed.name.toLowerCase().replace(/\s+/g, '.')}@poc.local`,
          contactPhone: '+1-555-2000',
        },
        user: agencyRoot,
      })
      storeByComposite.set(`${agencySeed.name}::${storeSeed.name}`, store)

      const createdStoreMember = await payload.create({
        collection: 'users',
        overrideAccess: true,
        data: {
          name: `${storeSeed.name} Root`,
          email: `${storeSeed.name.toLowerCase().replace(/\s+/g, '.')}+root@poc.local`,
          password: DEMO_PASSWORD,
          role: 'store-root',
          status: 'active',
          agency: agency.id,
          store: store.id,
        },
        user: agencyRoot,
      })

      const storeMemberStatus = agencySeed.name === 'Aurora Agency' && index === 0 ? 'invited' : 'active'

      await payload.create({
        collection: 'users',
        overrideAccess: true,
        data: {
          name: `${storeSeed.name} Member`,
          email: `${storeSeed.name.toLowerCase().replace(/\s+/g, '.')}+member@poc.local`,
          password: DEMO_PASSWORD,
          role: 'store-member',
          status: storeMemberStatus,
          agency: agency.id,
          store: store.id,
        },
        user: agencyRoot,
      })

      if (storeMemberStatus === 'invited') {
        await issueInvite({
          targetUserId: createdStoreMember.id,
          email: createdStoreMember.email,
          actor: agencyRoot,
          agency: agency.id,
          store: store.id,
        })
      }
    }
  }

  for (const agencySeed of AGENCY_SEED) {
    const agency = agencyByName.get(agencySeed.name)
    const agencyRoot = agencyRootByAgencyId.get(agency.id)
    const agencyMember = agencyMemberByAgencyId.get(agency.id)

    for (let index = 0; index < agencySeed.stores.length; index += 1) {
      if (index >= 3) break
      const store = storeByComposite.get(`${agencySeed.name}::${agencySeed.stores[index].name}`)
      await payload.create({
        collection: 'agency-store-assignments',
        overrideAccess: true,
        data: {
          agency: agency.id,
          agencyUser: agencyMember.id,
          store: store.id,
          assignedBy: agencyRoot.id,
          status: 'active',
        },
        user: agencyRoot,
      })
    }
  }

  const metricRows = await loadParquetRows()
  for (let index = 0; index < metricRows.length; index += 1) {
    const row = metricRows[index]
    const agency = agencyByName.get(row.agency_name)
    const store = storeByComposite.get(`${row.agency_name}::${row.store_name}`)
    if (!agency || !store) {
      continue
    }

    await payload.create({
      collection: 'store-daily-metrics',
      overrideAccess: true,
      data: {
        tenant: agency.id,
        store: store.id,
        source: 'shopify',
        metricDate: row.metric_date,
        netSales: toNumber(row.net_sales),
        grossProfit: toNumber(row.gross_profit),
        marketingAdSpend: toNumber(row.marketing_ad_spend),
        mer: toNumber(row.mer),
      },
      user: storeheroMember,
    })

    if ((index + 1) % 1000 === 0) {
      console.log(`Inserted ${index + 1}/${metricRows.length} metric rows...`)
    }
  }

  const counts = {
    agencies: (await payload.count({ collection: 'agencies', overrideAccess: true })).totalDocs,
    stores: (await payload.count({ collection: 'stores', overrideAccess: true })).totalDocs,
    users: (await payload.count({ collection: 'users', overrideAccess: true })).totalDocs,
    assignments: (await payload.count({ collection: 'agency-store-assignments', overrideAccess: true })).totalDocs,
    metrics: (await payload.count({ collection: 'store-daily-metrics', overrideAccess: true })).totalDocs,
  }

  console.log('Seed complete', counts)
  console.log('Storehero root:', storeheroRoot.email)
  console.log('Storehero member:', storeheroMember.email)
  console.log('All seeded passwords use:', DEMO_PASSWORD)
}

main().catch((error) => {
  console.error('Seed failed')
  console.error(error)
  process.exit(1)
})
