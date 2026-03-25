import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('parquet fixture', () => {
  it('exists and contains the expected deterministic row count', async () => {
    const fixture = path.resolve(process.cwd(), 'data/fixtures/shopify_metrics_daily.parquet')
    expect(fs.existsSync(fixture)).toBe(true)

    const parquetModule = await import('parquetjs-lite')
    const parquet = parquetModule.default
    const reader = await parquet.ParquetReader.openFile(fixture)
    const cursor = reader.getCursor()
    let count = 0
    while (await cursor.next()) {
      count += 1
    }
    await reader.close()

    expect(count).toBe(10950)
  })
})
