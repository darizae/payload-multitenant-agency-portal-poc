import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function collectFiles(root: string): string[] {
  const entries = fs.readdirSync(root, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(absolutePath))
      continue
    }
    files.push(absolutePath)
  }

  return files
}

describe('server component boundaries', () => {
  it('prevents passing next/link functions into server-rendered MUI components', () => {
    const roots = ['app', 'src/components']
    const violations: string[] = []

    for (const root of roots) {
      for (const file of collectFiles(root)) {
        if (!file.endsWith('.tsx')) continue
        const source = fs.readFileSync(file, 'utf8')
        const trimmed = source.replace(/^\uFEFF/, '').trimStart()
        const isClientComponent = /^['"]use client['"];?/.test(trimmed)

        if (isClientComponent) continue
        if (/(component|LinkComponent)=\{Link\}/.test(source)) {
          violations.push(file)
        }
      }
    }

    expect(violations).toEqual([])
  })
})
