import config from '../payload.config.ts'
import { getPayload } from 'payload'

async function upsertAgency(payload: any, name: string, data: Record<string, any>) {
  const existing = await payload.find({ collection: 'agencies', overrideAccess: true, limit: 1, where: { name: { equals: name } } })
  if (existing.totalDocs > 0) {
    return payload.update({ collection: 'agencies', id: existing.docs[0].id, overrideAccess: true, data })
  }
  return payload.create({ collection: 'agencies', overrideAccess: true, data: { name, ...data } })
}

async function upsertUser(payload: any, email: string, data: Record<string, any>) {
  const existing = await payload.find({ collection: 'users', overrideAccess: true, limit: 1, where: { email: { equals: email } } })
  if (existing.totalDocs > 0) {
    return payload.update({ collection: 'users', id: existing.docs[0].id, overrideAccess: true, data })
  }
  return payload.create({ collection: 'users', overrideAccess: true, data: { email, ...data } })
}

async function upsertCustomer(payload: any, agency: string | number, name: string, data: Record<string, any>) {
  const existing = await payload.find({
    collection: 'customers',
    overrideAccess: true,
    limit: 1,
    where: {
      and: [
        { agency: { equals: agency } },
        { name: { equals: name } },
      ],
    },
  })

  if (existing.totalDocs > 0) {
    return payload.update({ collection: 'customers', id: existing.docs[0].id, overrideAccess: true, data: { agency, ...data } })
  }

  return payload.create({ collection: 'customers', overrideAccess: true, data: { agency, name, ...data } })
}

async function ensureAssignment(payload: any, agency: string | number, agencyUser: string | number, customer: string | number, assignedBy: string | number) {
  const existing = await payload.find({
    collection: 'agency-customer-assignments',
    overrideAccess: true,
    limit: 1,
    where: {
      and: [
        { agencyUser: { equals: agencyUser } },
        { customer: { equals: customer } },
      ],
    },
  })

  if (existing.totalDocs > 0) {
    return payload.update({
      collection: 'agency-customer-assignments',
      id: existing.docs[0].id,
      overrideAccess: true,
      data: { agency, agencyUser, customer, assignedBy, status: 'active' },
    })
  }

  return payload.create({
    collection: 'agency-customer-assignments',
    overrideAccess: true,
    data: { agency, agencyUser, customer, assignedBy, status: 'active' },
  })
}

async function main() {
  const payload = await getPayload({ config })
  console.log('Seeding demo data...')

  const alphaAgency = await upsertAgency(payload, 'Alpha Agency', {
    status: 'active',
    primaryContactName: 'Alice Agency',
    primaryContactEmail: 'contact@alpha-agency.local',
    primaryContactPhone: '+49 555 000 100',
  })

  const betaAgency = await upsertAgency(payload, 'Beta Agency', {
    status: 'active',
    primaryContactName: 'Ben Beta',
    primaryContactEmail: 'contact@beta-agency.local',
    primaryContactPhone: '+49 555 000 200',
  })

  const platformAdmin = await upsertUser(payload, process.env.SEED_PLATFORM_ADMIN_EMAIL || 'platform.admin@poc.local', {
    name: 'Platform Admin',
    password: process.env.SEED_PLATFORM_ADMIN_PASSWORD || 'Passw0rd!Demo',
    role: 'platform-admin',
    status: 'active',
    agency: null,
    customer: null,
  })

  const alphaAdmin = await upsertUser(payload, process.env.SEED_AGENCY_ADMIN_EMAIL || 'alpha.admin@poc.local', {
    name: 'Alpha Admin',
    password: process.env.SEED_AGENCY_ADMIN_PASSWORD || 'Passw0rd!Demo',
    role: 'agency-admin',
    status: 'active',
    agency: alphaAgency.id,
    customer: null,
    hasGlobalCustomerAccess: true,
  })

  const alphaManager = await upsertUser(payload, 'alpha.manager@poc.local', {
    name: 'Alpha Manager',
    password: 'Passw0rd!Demo',
    role: 'agency-manager',
    status: 'active',
    agency: alphaAgency.id,
    customer: null,
    hasGlobalCustomerAccess: true,
  })

  const alphaUser = await upsertUser(payload, 'alpha.user@poc.local', {
    name: 'Alpha Specialist',
    password: 'Passw0rd!Demo',
    role: 'agency-user',
    status: 'active',
    agency: alphaAgency.id,
    customer: null,
    hasGlobalCustomerAccess: false,
  })

  await upsertUser(payload, 'beta.admin@poc.local', {
    name: 'Beta Admin',
    password: 'Passw0rd!Demo',
    role: 'agency-admin',
    status: 'active',
    agency: betaAgency.id,
    customer: null,
    hasGlobalCustomerAccess: true,
  })

  const storeOne = await upsertCustomer(payload, alphaAgency.id, 'Northwind Bikes', {
    status: 'active',
    contactName: 'Nora Northwind',
    contactEmail: 'owner@northwind-bikes.local',
    contactPhone: '+49 555 111 000',
  })

  const storeTwo = await upsertCustomer(payload, alphaAgency.id, 'Summit Coffee', {
    status: 'active',
    contactName: 'Sam Summit',
    contactEmail: 'owner@summit-coffee.local',
    contactPhone: '+49 555 111 001',
  })

  const betaCustomer = await upsertCustomer(payload, betaAgency.id, 'Orbit Fitness', {
    status: 'active',
    contactName: 'Olivia Orbit',
    contactEmail: 'owner@orbit-fitness.local',
    contactPhone: '+49 555 222 000',
  })

  const northwindAdmin = await upsertUser(payload, 'store1.admin@poc.local', {
    name: 'Northwind Admin',
    password: 'Passw0rd!Demo',
    role: 'customer-admin',
    status: 'active',
    agency: alphaAgency.id,
    customer: storeOne.id,
  })

  await upsertUser(payload, 'store1.user@poc.local', {
    name: 'Northwind Staff',
    password: 'Passw0rd!Demo',
    role: 'customer-user',
    status: 'active',
    agency: alphaAgency.id,
    customer: storeOne.id,
  })

  await upsertUser(payload, 'store2.admin@poc.local', {
    name: 'Summit Admin',
    password: 'Passw0rd!Demo',
    role: 'customer-admin',
    status: 'active',
    agency: alphaAgency.id,
    customer: storeTwo.id,
  })

  await upsertUser(payload, 'orbit.admin@poc.local', {
    name: 'Orbit Admin',
    password: 'Passw0rd!Demo',
    role: 'customer-admin',
    status: 'active',
    agency: betaAgency.id,
    customer: betaCustomer.id,
  })

  await upsertUser(payload, 'pending.invite@poc.local', {
    name: 'Pending Invite Demo',
    role: 'customer-user',
    status: 'invited',
    agency: alphaAgency.id,
    customer: storeOne.id,
  })

  await ensureAssignment(payload, alphaAgency.id, alphaUser.id, storeOne.id, alphaAdmin.id)
  await ensureAssignment(payload, alphaAgency.id, alphaManager.id, storeOne.id, alphaAdmin.id)
  await ensureAssignment(payload, alphaAgency.id, alphaManager.id, storeTwo.id, alphaAdmin.id)

  const counts = {
    agencies: (await payload.count({ collection: 'agencies', overrideAccess: true })).totalDocs,
    customers: (await payload.count({ collection: 'customers', overrideAccess: true })).totalDocs,
    users: (await payload.count({ collection: 'users', overrideAccess: true })).totalDocs,
    assignments: (await payload.count({ collection: 'agency-customer-assignments', overrideAccess: true })).totalDocs,
  }

  console.log('Seed complete', counts)
  console.log('Platform admin:', platformAdmin.email)
  console.log('Agency admin:', alphaAdmin.email)
  console.log('Customer admin:', northwindAdmin.email)
  console.log('All seeded passwords use: Passw0rd!Demo')
}

main().catch((error) => {
  console.error('Seed failed')
  console.error(error)
  process.exit(1)
})
