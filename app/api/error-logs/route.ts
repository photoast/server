import { NextRequest, NextResponse } from 'next/server'
import { createErrorLog, getAllErrorLogs } from '@/lib/models'
import { checkAuth } from '@/lib/middleware'

// POST - Create error log
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { level, message, stack, url, eventSlug, additionalData } = body

    if (!level || !message) {
      return NextResponse.json(
        { error: 'Level and message are required' },
        { status: 400 }
      )
    }

    const userAgent = request.headers.get('user-agent') || undefined

    const errorLog = await createErrorLog({
      level,
      message,
      stack,
      url,
      userAgent,
      eventSlug,
      additionalData,
    })

    console.error('Client error logged:', {
      level,
      message,
      stack,
      url,
      eventSlug,
    })

    return NextResponse.json({ success: true, id: errorLog._id }, { status: 201 })
  } catch (error) {
    console.error('Error creating error log:', error)
    return NextResponse.json(
      { error: 'Failed to create error log' },
      { status: 500 }
    )
  }
}

// GET - Retrieve all error logs (admin only)
export async function GET(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const errorLogs = await getAllErrorLogs()
    return NextResponse.json(errorLogs)
  } catch (error) {
    console.error('Error fetching error logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch error logs' },
      { status: 500 }
    )
  }
}
