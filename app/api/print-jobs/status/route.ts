import { NextRequest, NextResponse } from 'next/server'
import { findPrintJobsByIds, countPendingJobsBefore } from '@/lib/models'

// Public endpoint — no auth required (client polls this for print status)
export async function GET(request: NextRequest) {
  try {
    const jobIdsParam = request.nextUrl.searchParams.get('jobIds')
    if (!jobIdsParam) {
      return NextResponse.json({ error: 'jobIds parameter is required' }, { status: 400 })
    }

    const jobIds = jobIdsParam.split(',').filter(Boolean).slice(0, 20)
    if (jobIds.length === 0) {
      return NextResponse.json({ jobs: [] })
    }

    const jobs = await findPrintJobsByIds(jobIds)

    const result = await Promise.all(
      jobs.map(async (job) => {
        const base: any = {
          jobId: job._id!.toString(),
          status: job.status,
          createdAt: job.createdAt,
        }

        if (job.status === 'FAILED' && job.errorMessage) {
          base.errorMessage = job.errorMessage
        }

        // For PENDING jobs with a printerId, calculate queue position
        if (job.status === 'PENDING' && job.printerId) {
          const ahead = await countPendingJobsBefore(job.printerId, job.createdAt)
          base.queuePosition = ahead + 1
        }

        return base
      })
    )

    return NextResponse.json({ jobs: result })
  } catch (error) {
    console.error('Error fetching job status:', error)
    return NextResponse.json({ error: 'Failed to fetch job status' }, { status: 500 })
  }
}
