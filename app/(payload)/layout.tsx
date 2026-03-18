import type { ReactNode } from 'react'
import config from '@payload-config'
import '@payloadcms/ui/scss/app.scss'
import './custom.scss'
import { RootLayout, handleServerFunctions } from '@payloadcms/next/layouts'
import { importMap } from './admin/importMap'

const serverFunction = async function (args: any) {
  'use server'
  return handleServerFunctions({ ...args, config, importMap })
}

export default async function PayloadLayout({ children }: { children: ReactNode }) {
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
