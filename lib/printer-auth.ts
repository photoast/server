import { NextRequest } from 'next/server'
import { findPrinterByApiKey } from './models'
import { Printer } from './types'

/**
 * Authenticate a printer client via Bearer API key.
 * Returns the Printer document if valid, null otherwise.
 */
export async function authenticatePrinterClient(
  request: NextRequest
): Promise<Printer | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const apiKey = authHeader.slice(7).trim()
  if (!apiKey) return null

  return findPrinterByApiKey(apiKey)
}
