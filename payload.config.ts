import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import sharp from 'sharp'
import { Agencies } from '@/collections/Agencies'
import { Users } from '@/collections/Users'
import { Customers } from '@/collections/Customers'
import { AgencyCustomerAssignments } from '@/collections/AgencyCustomerAssignments'
import { InviteTokens } from '@/collections/InviteTokens'
import { AuditLogs } from '@/collections/AuditLogs'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

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
  collections: [Agencies, Users, Customers, AgencyCustomerAssignments, InviteTokens, AuditLogs],
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URI || 'file:./.data/agency-portal.db',
    },
    wal: true,
    busyTimeout: 3000,
  }),
  sharp,
  telemetry: false,
  typescript: {
    outputFile: path.resolve(dirname, 'src/payload-types.ts'),
  },
})
