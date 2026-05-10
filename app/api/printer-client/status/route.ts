import { NextRequest, NextResponse } from 'next/server'
import { authenticatePrinterClient } from '@/lib/printer-auth'
import { getDb, COLLECTIONS } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export async function POST(request: NextRequest) {
  try {
    const printer = await authenticatePrinterClient(request)
    if (!printer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { paperStatus, inkStatus, errorMessage, version } = body

    const db = await getDb()
    await db.collection(COLLECTIONS.printers).updateOne(
      { _id: new ObjectId(printer._id!.toString()) },
      {
        $set: {
          lastSeen: new Date(),
          statusInfo: {
            online: true,
            ...(paperStatus && { paperStatus }),
            ...(inkStatus && { inkStatus }),
            ...(errorMessage && { errorMessage }),
            ...(version && { version }),
          },
        },
      }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Printer status update error:', error)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }
}
