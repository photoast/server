import { MongoClient, Db } from 'mongodb'

// MongoDB connection - optional for development
// Currently using in-memory DB, but you can switch to MongoDB by setting MONGODB_URI in .env

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

export async function getDb(): Promise<Db> {
  if (!clientPromise) {
    throw new Error('MongoDB not configured. Using in-memory database instead.')
  }
  const client = await clientPromise
  return client.db('photoast')
}

export default clientPromise
