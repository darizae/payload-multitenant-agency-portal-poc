export function text(formData: FormData, key: string): string {
  return String(formData.get(key) || '').trim()
}

export function metricNumber(formData: FormData, key: string): number {
  const value = Number(text(formData, key))
  if (!Number.isFinite(value)) {
    throw new Error(`${key} must be a valid number.`)
  }
  return value
}

export async function getAgencyById(payload: any, agencyId: number) {
  const result = await payload.find({
    collection: 'agencies',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { id: { equals: agencyId } },
  })
  return result.docs[0] || null
}

export async function getStoreById(payload: any, storeId: number) {
  const result = await payload.find({
    collection: 'stores',
    overrideAccess: true,
    depth: 1,
    limit: 1,
    where: { id: { equals: storeId } },
  })
  return result.docs[0] || null
}

export async function getUserById(payload: any, userId: number) {
  const result = await payload.find({
    collection: 'users',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { id: { equals: userId } },
  })
  return result.docs[0] || null
}
