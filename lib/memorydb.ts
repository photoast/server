import { Event, PrintJob, Admin, ErrorLog } from './types'
import { ObjectId } from 'mongodb'

// In-memory database for development without MongoDB
class MemoryDB {
  private events: Map<string, Event> = new Map()
  private printJobs: Map<string, PrintJob> = new Map()
  private admins: Map<string, Admin> = new Map()
  private errorLogs: Map<string, ErrorLog> = new Map()
  private initialized: boolean = false

  constructor() {
    this.initializeDefaultData()
  }

  private async initializeDefaultData() {
    if (this.initialized) return
    this.initialized = true

    // Create default event
    const defaultEventId = new ObjectId()
    const defaultEvent: Event = {
      _id: defaultEventId,
      name: 'Phost',
      slug: 'phost-default',
      printerUrl: 'https://192.168.219.105/ipp/print',
      photoAreaRatio: 85,
      logoSettings: {
        position: 'bottom-center',
        size: 80
      },
      createdAt: new Date(),
    }
    this.events.set(defaultEventId.toString(), defaultEvent)
  }

  // Events
  async createEvent(event: Omit<Event, '_id' | 'createdAt'>): Promise<Event> {
    const id = new ObjectId()
    const newEvent: Event = {
      _id: id,
      ...event,
      createdAt: new Date(),
    }
    this.events.set(id.toString(), newEvent)
    return newEvent
  }

  async findEventBySlug(slug: string): Promise<Event | null> {
    for (const event of Array.from(this.events.values())) {
      if (event.slug === slug) {
        return event
      }
    }
    return null
  }

  async findEventById(id: string): Promise<Event | null> {
    return this.events.get(id) || null
  }

  async getAllEvents(): Promise<Event[]> {
    return Array.from(this.events.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )
  }

  async updateEvent(id: string, updates: Partial<Event>): Promise<boolean> {
    const event = this.events.get(id)
    if (!event) return false

    const updated = { ...event, ...updates }
    this.events.set(id, updated)
    return true
  }

  // Print Jobs
  async createPrintJob(job: Omit<PrintJob, '_id' | 'createdAt'>): Promise<PrintJob> {
    const id = new ObjectId()
    const newJob: PrintJob = {
      _id: id,
      ...job,
      createdAt: new Date(),
    }
    this.printJobs.set(id.toString(), newJob)
    return newJob
  }

  async getPrintJobsByEventId(eventId: string): Promise<PrintJob[]> {
    const jobs: PrintJob[] = []
    for (const job of Array.from(this.printJobs.values())) {
      if (job.eventId === eventId) {
        jobs.push(job)
      }
    }
    return jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async getAllPrintJobs(): Promise<PrintJob[]> {
    return Array.from(this.printJobs.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )
  }

  // Admins
  async findAdminByUsername(username: string): Promise<Admin | null> {
    for (const admin of Array.from(this.admins.values())) {
      if (admin.username === username) {
        return admin
      }
    }
    return null
  }

  // Error Logs
  async createErrorLog(log: Omit<ErrorLog, '_id' | 'timestamp'>): Promise<ErrorLog> {
    const id = new ObjectId()
    const newLog: ErrorLog = {
      _id: id,
      ...log,
      timestamp: new Date(),
    }
    this.errorLogs.set(id.toString(), newLog)
    return newLog
  }

  async getAllErrorLogs(): Promise<ErrorLog[]> {
    return Array.from(this.errorLogs.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    )
  }

  async getErrorLogsByEventSlug(eventSlug: string): Promise<ErrorLog[]> {
    const logs: ErrorLog[] = []
    for (const log of Array.from(this.errorLogs.values())) {
      if (log.eventSlug === eventSlug) {
        logs.push(log)
      }
    }
    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  // Debug
  clear() {
    this.events.clear()
    this.printJobs.clear()
    this.admins.clear()
    this.errorLogs.clear()
  }
}

// Singleton instance with global persistence to survive HMR in dev mode
declare global {
  var _memoryDB: MemoryDB | undefined
}

const memoryDB = global._memoryDB || new MemoryDB()

if (process.env.NODE_ENV === 'development') {
  global._memoryDB = memoryDB
}

export default memoryDB
