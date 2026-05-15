import { ObjectId } from 'mongodb'
import { Event, PrintJob, Admin, ErrorLog, Sticker, FrameLayout, normalizeLayout, Printer, User, AuthCode } from './types'
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

async function getNextOrderNumber(): Promise<number> {
  const db = await getDb()
  const result = await db.collection(COLLECTIONS.counters).findOneAndUpdate(
    { _id: 'orderNumber' as any },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  )
  return result!.seq as number
}

export async function createPrintJob(job: Omit<PrintJob, '_id' | 'createdAt' | 'orderNumber'>): Promise<PrintJob> {
  const db = await getDb()
  const orderNumber = await getNextOrderNumber()
  const doc = { ...job, orderNumber, createdAt: new Date() }
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

// ==================== Layouts (FrameLayout) ====================

export async function createLayout(
  layout: Omit<FrameLayout, '_id' | 'createdAt' | 'updatedAt' | 'isPreset' | 'order' | 'backgroundColor' | 'backgroundColorCustomizable'> & {
    isPreset?: boolean
    order?: number
    backgroundColor?: string
    backgroundColorCustomizable?: boolean
  }
): Promise<FrameLayout> {
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
  return { _id: result.insertedId.toString(), ...doc } as FrameLayout
}

export async function getLayoutById(id: string): Promise<FrameLayout | null> {
  const db = await getDb()
  let doc: any
  try {
    doc = await db.collection(COLLECTIONS.layouts).findOne({ _id: new ObjectId(id) })
  } catch {
    doc = await db.collection(COLLECTIONS.layouts).findOne({ _id: id as any })
  }
  if (!doc) return null
  const layout: FrameLayout = { ...doc, _id: doc._id.toString() }
  return normalizeLayout(layout)
}

export async function getLayoutsByEventId(eventId: string): Promise<FrameLayout[]> {
  const db = await getDb()
  const docs = await db.collection(COLLECTIONS.layouts)
    .find({ eventId })
    .sort({ order: 1 })
    .toArray()
  return docs.map(doc => {
    const layout: FrameLayout = { ...doc, _id: doc._id.toString() } as any
    return normalizeLayout(layout)
  })
}

export async function updateLayout(id: string, updates: Partial<FrameLayout>): Promise<boolean> {
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

export async function duplicateLayout(id: string): Promise<FrameLayout | null> {
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

// ==================== Users ====================

export async function findOrCreateUser(data: {
  provider: 'google' | 'kakao'
  providerId: string
  email?: string
  name?: string
  profileImage?: string
}): Promise<User> {
  const db = await getDb()
  const col = db.collection<User>(COLLECTIONS.users)
  const now = new Date()

  const result = await col.findOneAndUpdate(
    { provider: data.provider, providerId: data.providerId },
    {
      $set: { email: data.email, name: data.name, profileImage: data.profileImage, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, returnDocument: 'after' }
  )
  return result! as User
}

export async function findUserById(id: string): Promise<User | null> {
  const db = await getDb()
  return db.collection<User>(COLLECTIONS.users).findOne({ _id: new ObjectId(id) })
}

export async function getAllUsers(): Promise<User[]> {
  const db = await getDb()
  return db.collection<User>(COLLECTIONS.users).find().sort({ createdAt: -1 }).toArray()
}

// ==================== Auth Codes ====================

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function createAuthCodes(eventId: string, count: number): Promise<AuthCode[]> {
  const db = await getDb()
  const col = db.collection(COLLECTIONS.authCodes)
  const codes: AuthCode[] = []
  const existingCodes = new Set(
    (await col.find({ eventId }).project({ code: 1 }).toArray()).map(d => d.code)
  )

  for (let i = 0; i < count; i++) {
    let code: string
    do {
      code = generateCode()
    } while (existingCodes.has(code))
    existingCodes.add(code)

    const doc = { eventId, code, used: false, createdAt: new Date() }
    const result = await col.insertOne(doc)
    codes.push({ _id: result.insertedId, ...doc } as AuthCode)
  }
  return codes
}

export async function getAuthCodesByEventId(eventId: string): Promise<AuthCode[]> {
  const db = await getDb()
  return db.collection<AuthCode>(COLLECTIONS.authCodes)
    .find({ eventId })
    .sort({ createdAt: -1 })
    .toArray()
}

export async function verifyAndUseAuthCode(eventId: string, code: string, printJobId?: string): Promise<{ valid: boolean; error?: string }> {
  const db = await getDb()
  const result = await db.collection(COLLECTIONS.authCodes).findOneAndUpdate(
    { eventId, code: code.toUpperCase(), used: false },
    { $set: { used: true, usedAt: new Date(), printJobId } }
  )
  if (!result) {
    const existing = await db.collection(COLLECTIONS.authCodes).findOne({ eventId, code: code.toUpperCase() })
    if (existing?.used) return { valid: false, error: '이미 사용된 인증코드입니다' }
    return { valid: false, error: '유효하지 않은 인증코드입니다' }
  }
  return { valid: true }
}

export async function linkAuthCodeToPrintJob(eventId: string, code: string, printJobId: string): Promise<void> {
  const db = await getDb()
  await db.collection(COLLECTIONS.authCodes).updateOne(
    { eventId, code: code.toUpperCase() },
    { $set: { printJobId } }
  )
}

export async function deleteAuthCode(id: string): Promise<boolean> {
  const db = await getDb()
  const result = await db.collection(COLLECTIONS.authCodes).deleteOne({ _id: new ObjectId(id) })
  return result.deletedCount > 0
}

export async function deleteAuthCodesByEventId(eventId: string): Promise<number> {
  const db = await getDb()
  const result = await db.collection(COLLECTIONS.authCodes).deleteMany({ eventId })
  return result.deletedCount
}

// ==================== Page Views ====================

export async function recordPageView(slug: string, meta?: { userAgent?: string; referrer?: string; deviceId?: string }) {
  const db = await getDb()
  await db.collection(COLLECTIONS.pageViews).insertOne({
    slug,
    viewedAt: new Date(),
    ...(meta?.deviceId && { deviceId: meta.deviceId }),
    ...(meta?.userAgent && { userAgent: meta.userAgent }),
    ...(meta?.referrer && { referrer: meta.referrer }),
  })
}

export async function getPageViewStats(slug: string): Promise<{ total: number; today: number; daily: { date: string; count: number }[] }> {
  const db = await getDb()
  const col = db.collection(COLLECTIONS.pageViews)

  const total = await col.countDocuments({ slug })

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const today = await col.countDocuments({ slug, viewedAt: { $gte: todayStart } })

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const daily = await col.aggregate<{ _id: string; count: number }>([
    { $match: { slug, viewedAt: { $gte: sevenDaysAgo } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$viewedAt', timezone: 'Asia/Seoul' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray()

  return { total, today, daily: daily.map(d => ({ date: d._id, count: d.count })) }
}

export async function getPageViewLogs(slug: string, page = 1, limit = 30) {
  const db = await getDb()
  const col = db.collection(COLLECTIONS.pageViews)
  const skip = (page - 1) * limit

  const [logs, total] = await Promise.all([
    col.find({ slug }).sort({ viewedAt: -1 }).skip(skip).limit(limit).toArray(),
    col.countDocuments({ slug }),
  ])

  return {
    logs: logs.map(l => ({
      _id: l._id.toString(),
      viewedAt: l.viewedAt,
      deviceId: l.deviceId || null,
      userAgent: l.userAgent || null,
      referrer: l.referrer || null,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
}
