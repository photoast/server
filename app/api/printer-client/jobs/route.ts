import { NextRequest, NextResponse } from 'next/server'
import { authenticatePrinterClient } from '@/lib/printer-auth'
import { getPendingJobsByPrinterId } from '@/lib/models'
import { getDb, COLLECTIONS } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export async function GET(request: NextRequest) {
  try {
    const printer = await authenticatePrinterClient(request)
    if (!printer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = await getDb()
    db.collection(COLLECTIONS.printers).updateOne(
      { _id: new ObjectId(printer._id!.toString()) },
      { $set: { lastSeen: new Date() } }
    ).catch(() => {})

    const jobs = await getPendingJobsByPrinterId(printer._id!.toString())

    const baseUrl = request.nextUrl.origin
    const response = jobs.map(job => {
      const imgUrl = job.printedImageUrl || job.imageUrl
      return {
        jobId: job._id!.toString(),
        imageUrl: imgUrl.startsWith('http') ? imgUrl : `${baseUrl}${imgUrl}`,
        createdAt: job.createdAt.toISOString(),
      }
    })

    return NextResponse.json({ jobs: response })
  } catch (error) {
    console.error('Error fetching pending jobs:', error)
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
  }
}
