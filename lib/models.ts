import { Event, PrintJob, Admin, ErrorLog } from './types'
import memoryDB from './memorydb'

// Using in-memory database for development without MongoDB
// To switch to MongoDB, uncomment the MongoDB implementation

export async function findEventBySlug(slug: string): Promise<Event | null> {
  return memoryDB.findEventBySlug(slug)
}

export async function findEventById(id: string): Promise<Event | null> {
  return memoryDB.findEventById(id)
}

export async function createEvent(event: Omit<Event, '_id' | 'createdAt'>): Promise<Event> {
  return memoryDB.createEvent(event)
}

export async function updateEvent(id: string, updates: Partial<Event>): Promise<boolean> {
  return memoryDB.updateEvent(id, updates)
}

export async function createPrintJob(job: Omit<PrintJob, '_id' | 'createdAt'>): Promise<PrintJob> {
  return memoryDB.createPrintJob(job)
}

export async function findAdminByUsername(username: string): Promise<Admin | null> {
  return memoryDB.findAdminByUsername(username)
}

export async function getAllEvents(): Promise<Event[]> {
  return memoryDB.getAllEvents()
}

export async function getPrintJobsByEventId(eventId: string): Promise<PrintJob[]> {
  return memoryDB.getPrintJobsByEventId(eventId)
}

export async function getAllPrintJobs(): Promise<PrintJob[]> {
  return memoryDB.getAllPrintJobs()
}

export async function createErrorLog(log: Omit<ErrorLog, '_id' | 'timestamp'>): Promise<ErrorLog> {
  return memoryDB.createErrorLog(log)
}

export async function getAllErrorLogs(): Promise<ErrorLog[]> {
  return memoryDB.getAllErrorLogs()
}

export async function getErrorLogsByEventSlug(eventSlug: string): Promise<ErrorLog[]> {
  return memoryDB.getErrorLogsByEventSlug(eventSlug)
}
