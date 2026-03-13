import { ObjectId } from 'mongodb'
import { Event, PrintJob, Admin, ErrorLog, Sticker, SwitLayout, normalizeLayout, Printer } from './types'
import { getDb, ensureIndexes, COLLECTIONS } from './mongodb'

// Ensure indexes on first import
ensureIndexes().catch(() => {})

// ==================== Events ====================

export async function createEvent(event: Omit<Event, '_id' | 'createdAt'>): Promise<Event> {
  const db = await getDb()
  const doc = { ...event, createdAt: new Date() }
  const result = await db.collection(COLLECTIONS.events).insertOne(doc)
  return { _id: result.insertedId, ...doc } as Event
}

export async function findEventBySlug(slug: string): Promise<Event | null> {
  const db = await getDb()
  return db.collection<Event>(COLLECTIONS.events).findOne({ slug })
}

export async function findEventById(id: string): Promise<Event | null> {
  const db = await getDb()
  return db.collection<Event>(COLLECTIONS.events).findOne({ _id: new ObjectId(id) })
}

export async function getAllEvents(): Promise<Event[]> {
  const db = await getDb()
  return db.collection<Event>(COLLECTIONS.events).find().sort({ createdAt: -1 }).toArray()
}

export async function updateEvent(id: string, updates: Partial<Event>): Promise<boolean> {
  const db = await getDb()
  const { _id, ...safeUpdates } = updates as any
  const result = await db.collection(COLLECTIONS.events).updateOne(
    { _id: new ObjectId(id) },
    { $set: safeUpdates }
  )
  return result.matchedCount > 0
}

export async function deleteEvent(id: string): Promise<boolean> {
  const db = await getDb()
  const result = await db.collection(COLLECTIONS.events).deleteOne({ _id: new ObjectId(id) })
  if (result.deletedCount > 0) {
    // 연관된 printJobs, layouts도 삭제
    await Promise.all([
      db.collection(COLLECTIONS.printJobs).deleteMany({ eventId: id }),
      db.collection(COLLECTIONS.layouts).deleteMany({ eventId: id }),
    ])
    return true
  }
  return false
}

// ==================== Print Jobs ====================

export async function createPrintJob(job: Omit<PrintJob, '_id' | 'createdAt'>): Promise<PrintJob> {
  const db = await getDb()
  const doc = { ...job, createdAt: new Date() }
  const result = await db.collection(COLLECTIONS.printJobs).insertOne(doc)
  return { _id: result.insertedId, ...doc } as PrintJob
}

export async function getPrintJobsByEventId(
  eventId: string,
  options?: { page?: number; limit?: number }
): Promise<{ jobs: PrintJob[]; total: number }> {
  const db = await getDb()
  const col = db.collection<PrintJob>(COLLECTIONS.printJobs)
  const filter = { eventId }
  const page = options?.page ?? 1
  const limit = options?.limit ?? 50

  const [jobs, total] = await Promise.all([
    col.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    col.countDocuments(filter),
  ])

  return { jobs, total }
}

export async function getAllPrintJobs(
  options?: { page?: number; limit?: number }
): Promise<{ jobs: PrintJob[]; total: number }> {
  const db = await getDb()
  const col = db.collection<PrintJob>(COLLECTIONS.printJobs)
  const page = options?.page ?? 1
  const limit = options?.limit ?? 50

  const [jobs, total] = await Promise.all([
    col.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    col.countDocuments(),
  ])

  return { jobs, total }
}

export async function findPrintJobById(jobId: string): Promise<PrintJob | null> {
  const db = await getDb()
  return db.collection<PrintJob>(COLLECTIONS.printJobs).findOne({ _id: new ObjectId(jobId) })
}

export async function getPendingJobsByPrinterId(printerId: string): Promise<PrintJob[]> {
  const db = await getDb()
  return db.collection<PrintJob>(COLLECTIONS.printJobs)
    .find({ printerId, status: 'PENDING' })
    .sort({ createdAt: 1 })
    .allowDiskUse()
    .toArray()
}

export async function updatePrintJobStatus(
  jobId: string,
  status: 'PENDING' | 'DONE' | 'FAILED',
  errorMessage?: string
): Promise<boolean> {
  const db = await getDb()
  const update: any = { status }
  if (errorMessage) update.errorMessage = errorMessage
  const result = await db.collection(COLLECTIONS.printJobs).updateOne(
    { _id: new ObjectId(jobId) },
    { $set: update }
  )
  return result.matchedCount > 0
}

export async function findPrintJobsByIds(jobIds: string[]): Promise<PrintJob[]> {
  const db = await getDb()
  return db.collection<PrintJob>(COLLECTIONS.printJobs)
    .find({ _id: { $in: jobIds.map(id => new ObjectId(id)) } })
    .toArray()
}

export async function countPendingJobsBefore(printerId: string, createdAt: Date): Promise<number> {
  const db = await getDb()
  return db.collection(COLLECTIONS.printJobs).countDocuments({
    printerId,
    status: 'PENDING',
    createdAt: { $lt: createdAt },
  })
}

// ==================== Admins ====================

export async function findAdminByUsername(username: string): Promise<Admin | null> {
  const db = await getDb()
  return db.collection<Admin>(COLLECTIONS.admins).findOne({ username })
}

// ==================== Error Logs ====================

export async function createErrorLog(log: Omit<ErrorLog, '_id' | 'timestamp'>): Promise<ErrorLog> {
  const db = await getDb()
  const doc = { ...log, timestamp: new Date() }
  const result = await db.collection(COLLECTIONS.errorLogs).insertOne(doc)
  return { _id: result.insertedId, ...doc } as ErrorLog
}

export async function getAllErrorLogs(): Promise<ErrorLog[]> {
  const db = await getDb()
  return db.collection<ErrorLog>(COLLECTIONS.errorLogs)
    .find()
    .sort({ timestamp: -1 })
    .toArray()
}

export async function getErrorLogsByEventSlug(eventSlug: string): Promise<ErrorLog[]> {
  const db = await getDb()
  return db.collection<ErrorLog>(COLLECTIONS.errorLogs)
    .find({ eventSlug })
    .sort({ timestamp: -1 })
    .toArray()
}

// ==================== Stickers ====================

export async function createSticker(sticker: Omit<Sticker, '_id' | 'createdAt'>): Promise<Sticker> {
  const db = await getDb()
  const doc = { ...sticker, createdAt: new Date() }
  const result = await db.collection(COLLECTIONS.stickers).insertOne(doc)
  return { _id: result.insertedId, ...doc } as Sticker
}

export async function getAllStickers(): Promise<Sticker[]> {
  const db = await getDb()
  return db.collection<Sticker>(COLLECTIONS.stickers)
    .find()
    .sort({ createdAt: -1 })
    .toArray()
}

export async function deleteSticker(id: string): Promise<boolean> {
  const db = await getDb()
  const result = await db.collection(COLLECTIONS.stickers).deleteOne({ _id: new ObjectId(id) })
  return result.deletedCount > 0
}

// ==================== Layouts (SwitLayout) ====================

export async function createLayout(
  layout: Omit<SwitLayout, '_id' | 'createdAt' | 'updatedAt' | 'isPreset' | 'order' | 'backgroundColor' | 'backgroundColorCustomizable'> & {
    isPreset?: boolean
    order?: number
    backgroundColor?: string
    backgroundColorCustomizable?: boolean
  }
): Promise<SwitLayout> {
  const db = await getDb()
  const now = new Date().toISOString()

  let order = layout.order
  if (order === undefined) {
    if (layout.isPreset) {
      order = Date.now()
    } else {
      // Non-preset layouts go to the top: find min order and subtract 1
      const minDoc = await db.collection(COLLECTIONS.layouts)
        .find({ eventId: layout.eventId })
        .sort({ order: 1 })
        .limit(1)
        .project({ order: 1 })
        .toArray()
      const minOrder = minDoc.length > 0 ? (minDoc[0].order ?? 0) : 0
      order = minOrder - 1
    }
  }

  const doc = {
    ...layout,
    backgroundColor: layout.backgroundColor ?? '#FFFFFF',
    backgroundColorCustomizable: layout.backgroundColorCustomizable ?? true,
    visible: layout.visible ?? true,
    isPreset: layout.isPreset ?? false,
    order,
    createdAt: now,
    updatedAt: now,
  }
  const result = await db.collection(COLLECTIONS.layouts).insertOne(doc)
  return { _id: result.insertedId.toString(), ...doc } as SwitLayout
}

export async function getLayoutById(id: string): Promise<SwitLayout | null> {
  const db = await getDb()
  let doc: any
  try {
    doc = await db.collection(COLLECTIONS.layouts).findOne({ _id: new ObjectId(id) })
  } catch {
    doc = await db.collection(COLLECTIONS.layouts).findOne({ _id: id as any })
  }
  if (!doc) return null
  const layout: SwitLayout = { ...doc, _id: doc._id.toString() }
  return normalizeLayout(layout)
}

export async function getLayoutsByEventId(eventId: string): Promise<SwitLayout[]> {
  const db = await getDb()
  const docs = await db.collection(COLLECTIONS.layouts)
    .find({ eventId })
    .sort({ order: 1 })
    .toArray()
  return docs.map(doc => {
    const layout: SwitLayout = { ...doc, _id: doc._id.toString() } as any
    return normalizeLayout(layout)
  })
}

export async function updateLayout(id: string, updates: Partial<SwitLayout>): Promise<boolean> {
  const db = await getDb()
  const { _id, ...updateFields } = updates as any
  const result = await db.collection(COLLECTIONS.layouts).updateOne(
    { _id: new ObjectId(id) },
    { $set: { ...updateFields, updatedAt: new Date().toISOString() } }
  )
  return result.matchedCount > 0
}

export async function deleteLayout(id: string): Promise<boolean> {
  const db = await getDb()
  const result = await db.collection(COLLECTIONS.layouts).deleteOne({ _id: new ObjectId(id) })
  return result.deletedCount > 0
}

export async function duplicateLayout(id: string): Promise<SwitLayout | null> {
  const source = await getLayoutById(id)
  if (!source) return null
  const { _id, ...rest } = source
  // order is omitted so createLayout will place it at the top
  return createLayout({
    ...rest,
    name: `${source.name} 복사본`,
    isPreset: false,
  })
}

export async function reorderLayouts(orderedIds: string[]): Promise<void> {
  const db = await getDb()
  const now = new Date().toISOString()
  const ops = orderedIds.map((id, index) => ({
    updateOne: {
      filter: { _id: new ObjectId(id) },
      update: { $set: { order: index, updatedAt: now } },
    },
  }))
  if (ops.length > 0) {
    await db.collection(COLLECTIONS.layouts).bulkWrite(ops)
  }
}

// ==================== Printers ====================

export async function createPrinter(printer: Omit<Printer, '_id' | 'createdAt'>): Promise<Printer> {
  const db = await getDb()
  const doc = { ...printer, createdAt: new Date() }
  const result = await db.collection(COLLECTIONS.printers).insertOne(doc)
  return { _id: result.insertedId, ...doc } as Printer
}

export async function findPrinterById(id: string): Promise<Printer | null> {
  const db = await getDb()
  return db.collection<Printer>(COLLECTIONS.printers).findOne({ _id: new ObjectId(id) })
}

export async function findPrinterByApiKey(apiKey: string): Promise<Printer | null> {
  const db = await getDb()
  return db.collection<Printer>(COLLECTIONS.printers).findOne({ apiKey })
}

export async function getAllPrinters(): Promise<Printer[]> {
  const db = await getDb()
  return db.collection<Printer>(COLLECTIONS.printers).find().sort({ createdAt: -1 }).toArray()
}

export async function updatePrinter(id: string, updates: Partial<Printer>): Promise<boolean> {
  const db = await getDb()
  const { _id, ...safeUpdates } = updates as any
  const result = await db.collection(COLLECTIONS.printers).updateOne(
    { _id: new ObjectId(id) },
    { $set: safeUpdates }
  )
  return result.matchedCount > 0
}

export async function deletePrinter(id: string): Promise<boolean> {
  const db = await getDb()
  const result = await db.collection(COLLECTIONS.printers).deleteOne({ _id: new ObjectId(id) })
  return result.deletedCount > 0
}
