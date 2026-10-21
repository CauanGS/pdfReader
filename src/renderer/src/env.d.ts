/// <reference types="vite/client" />

import type { PdfReaderApi } from '@shared/types'

declare global {
  interface Window {
    pdfReader: PdfReaderApi
  }
}

export {}
