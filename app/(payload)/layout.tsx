import type { ReactNode } from 'react'
import './custom.scss'
import { importMap } from './admin/importMap'

const serverFunction = async function (args: any) {
  'use server'
  const { handleServerFunctions } = await import('@payloadcms/next/layouts')
  const config = (await import('@payload-config')).default
  return handleServerFunctions({ ...args, config, importMap })
}

export default async function PayloadLayout({ children }: { children: ReactNode }) {
  const { RootLayout } = await import('@payloadcms/next/layouts')
  const config = (await import('@payload-config')).default

  return (
    <RootLayout
      config={config}
      importMap={importMap}
      serverFunction={serverFunction}
      htmlProps={{ suppressHydrationWarning: true }}
    >
      {children}
    </RootLayout>
  )
}
