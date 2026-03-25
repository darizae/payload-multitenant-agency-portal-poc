import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import sharp from 'sharp'
import { Agencies } from '@/collections/Agencies'
import { Users } from '@/collections/Users'
import { Stores } from '@/collections/Stores'
import { AgencyStoreAssignments } from '@/collections/AgencyStoreAssignments'
import { InviteTokens } from '@/collections/InviteTokens'
import { AuditLogs } from '@/collections/AuditLogs'
import { StoreDailyMetrics } from '@/collections/StoreDailyMetrics'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
const shouldPushDatabaseSchema = process.env.PAYLOAD_PUSH_SCHEMA === 'true'

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || 'dev-only-secret',
  serverURL,
  cors: [serverURL],
  csrf: [serverURL],
  admin: {
    user: 'users',
    meta: {
      titleSuffix: '· Agency Portal POC',
    },
    importMap: {
      baseDir: dirname,
    },
  },
  collections: [Agencies, Users, Stores, AgencyStoreAssignments, InviteTokens, AuditLogs, StoreDailyMetrics],
  db: postgresAdapter({
    push: shouldPushDatabaseSchema,
    pool: {
      connectionString: process.env.DATABASE_URI || 'postgresql://postgres:postgres@localhost:5432/agency_portal',
    },
  }),
  sharp,
  telemetry: false,
  typescript: {
    outputFile: path.resolve(dirname, 'src/payload-types.ts'),
  },
})
