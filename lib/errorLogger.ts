import { ErrorLevel } from './types'

interface LogErrorParams {
  level: ErrorLevel
  message: string
  error?: Error | unknown
  eventSlug?: string
  additionalData?: Record<string, any>
}

export async function logError({
  level,
  message,
  error,
  eventSlug,
  additionalData,
}: LogErrorParams): Promise<void> {
  // Get error stack if available
  let stack: string | undefined
  if (error instanceof Error) {
    stack = error.stack
  }

  // Get current URL
  const url = typeof window !== 'undefined' ? window.location.href : undefined

  try {
    await fetch('/api/error-logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        level,
        message,
        stack,
        url,
        eventSlug,
        additionalData,
      }),
    })
  } catch (err) {
    // If logging to server fails, at least log to console
    console.error('Failed to send error log to server:', err)
    console.error('Original error:', { level, message, stack, eventSlug, additionalData })
  }
}

// Convenience functions
export const logClientError = (
  message: string,
  error?: Error | unknown,
  eventSlug?: string,
  additionalData?: Record<string, any>
) => {
  console.error(message, error)
  return logError({ level: 'error', message, error, eventSlug, additionalData })
}

export const logClientWarning = (
  message: string,
  error?: Error | unknown,
  eventSlug?: string,
  additionalData?: Record<string, any>
) => {
  console.warn(message, error)
  return logError({ level: 'warning', message, error, eventSlug, additionalData })
}

export const logClientInfo = (
  message: string,
  eventSlug?: string,
  additionalData?: Record<string, any>
) => {
  console.info(message)
  return logError({ level: 'info', message, eventSlug, additionalData })
}
