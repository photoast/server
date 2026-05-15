import { MongoClient, Db } from 'mongodb'

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

let clientPromise: Promise<MongoClient> | null = null

if (process.env.MONGODB_URI) {
  const uri: string = process.env.MONGODB_URI
  const options = {}

  let client: MongoClient

  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri, options)
      global._mongoClientPromise = client.connect()
    }
    clientPromise = global._mongoClientPromise
  } else {
    client = new MongoClient(uri, options)
    clientPromise = client.connect()
  }
}

// Collection name constants
export const COLLECTIONS = {
  events: 'events',
  printJobs: 'printJobs',
  admins: 'admins',
  errorLogs: 'errorLogs',
  stickers: 'stickers',
  layouts: 'layouts',
  printers: 'printers',
  users: 'users',
  counters: 'counters',
  authCodes: 'authCodes',
  pageViews: 'pageViews',
} as const

export async function getDb(): Promise<Db> {
  if (!clientPromise) {
    throw new Error('MongoDB not configured. Set MONGODB_URI in .env')
  }
  const client = await clientPromise
  return client.db('photoast')
}

// One-time index setup
let indexesCreated = false
export async function ensureIndexes(): Promise<void> {
  if (indexesCreated) return
  try {
    const db = await getDb()
    await Promise.all([
      db.collection(COLLECTIONS.events).createIndex({ slug: 1 }, { unique: true }),
      db.collection(COLLECTIONS.layouts).createIndex({ eventId: 1 }),
      db.collection(COLLECTIONS.printJobs).createIndex({ eventId: 1, createdAt: -1 }),
      db.collection(COLLECTIONS.printJobs).createIndex({ createdAt: -1 }),
      db.collection(COLLECTIONS.errorLogs).createIndex({ eventSlug: 1 }),
      db.collection(COLLECTIONS.admins).createIndex({ username: 1 }, { unique: true }),
      db.collection(COLLECTIONS.printers).createIndex({ name: 1 }, { unique: true }),
      db.collection(COLLECTIONS.printers).createIndex({ apiKey: 1 }, { unique: true, sparse: true }),
      db.collection(COLLECTIONS.printJobs).createIndex({ printerId: 1, status: 1, createdAt: 1 }),
      db.collection(COLLECTIONS.printJobs).createIndex({ userId: 1, createdAt: -1 }),
      db.collection(COLLECTIONS.users).createIndex({ provider: 1, providerId: 1 }, { unique: true }),
      db.collection(COLLECTIONS.users).createIndex({ email: 1 }, { sparse: true }),
      db.collection(COLLECTIONS.authCodes).createIndex({ eventId: 1 }),
      db.collection(COLLECTIONS.authCodes).createIndex({ code: 1, eventId: 1 }, { unique: true }),
      db.collection(COLLECTIONS.pageViews).createIndex({ slug: 1, viewedAt: -1 }),
    ])
    indexesCreated = true
    console.log('[MongoDB] Indexes ensured')
  } catch (err) {
    console.error('[MongoDB] Failed to create indexes:', err)
  }
}

export default clientPromise
