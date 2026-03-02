import { Event, PrintJob, Admin, ErrorLog, Sticker, SwitLayout, normalizeLayout } from './types'
import { ObjectId } from 'mongodb'
import { DEFAULT_LAYOUT_TEMPLATES } from './defaultLayoutTemplates'

// In-memory database for development without MongoDB
class MemoryDB {
  private events: Map<string, Event> = new Map()
  private printJobs: Map<string, PrintJob> = new Map()
  private admins: Map<string, Admin> = new Map()
  private errorLogs: Map<string, ErrorLog> = new Map()
  private stickers: Map<string, Sticker> = new Map()
  private layouts: Map<string, SwitLayout> = new Map()
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
      name: 'Photo Toast',
      slug: 'phost-default',
      createdAt: new Date(),
    }
    const eventId = defaultEventId.toString()
    this.events.set(eventId, defaultEvent)

    // 기본 레이아웃 프리셋 자동 생성
    for (let idx = 0; idx < DEFAULT_LAYOUT_TEMPLATES.length; idx++) {
      const template = DEFAULT_LAYOUT_TEMPLATES[idx]
      this.createLayout({
        eventId,
        name: template.name,
        printSize: template.printSize,
        canvasWidth: template.canvasWidth,
        canvasHeight: template.canvasHeight,
        slots: template.slots.map((s, i) => ({ ...s, id: `slot-${i}`, order: i, zIndex: 10 + i, rotation: 0 })),
        frameLayers: template.frameLayers || [],
        frameUrl: null,
        backgroundColor: template.backgroundColor,
        backgroundColorCustomizable: template.backgroundColorCustomizable,
        isPreset: true,
        order: idx,
      })
    }

    // Create second default event (polling method)
    const pollingEventId = new ObjectId()
    const pollingEvent: Event = {
      _id: pollingEventId,
      name: 'Photo Toast Polling',
      slug: 'phost-polling',
      createdAt: new Date(),
    }
    const pollingEvId = pollingEventId.toString()
    this.events.set(pollingEvId, pollingEvent)

    for (let idx = 0; idx < DEFAULT_LAYOUT_TEMPLATES.length; idx++) {
      const template = DEFAULT_LAYOUT_TEMPLATES[idx]
      this.createLayout({
        eventId: pollingEvId,
        name: template.name,
        printSize: template.printSize,
        canvasWidth: template.canvasWidth,
        canvasHeight: template.canvasHeight,
        slots: template.slots.map((s, i) => ({ ...s, id: `slot-${i}`, order: i, zIndex: 10 + i, rotation: 0 })),
        frameLayers: template.frameLayers || [],
        frameUrl: null,
        backgroundColor: template.backgroundColor,
        backgroundColorCustomizable: template.backgroundColorCustomizable,
        isPreset: true,
        order: idx,
      })
    }
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

  // Stickers
  async createSticker(sticker: Omit<Sticker, '_id' | 'createdAt'>): Promise<Sticker> {
    const id = new ObjectId()
    const newSticker: Sticker = { _id: id, ...sticker, createdAt: new Date() }
    this.stickers.set(id.toString(), newSticker)
    return newSticker
  }

  async getAllStickers(): Promise<Sticker[]> {
    return Array.from(this.stickers.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )
  }

  async deleteSticker(id: string): Promise<boolean> {
    return this.stickers.delete(id)
  }

  // SwitLayouts
  async createLayout(layout: Omit<SwitLayout, '_id' | 'createdAt' | 'updatedAt' | 'isPreset' | 'order' | 'backgroundColor' | 'backgroundColorCustomizable'> & { isPreset?: boolean; order?: number; backgroundColor?: string; backgroundColorCustomizable?: boolean }): Promise<SwitLayout> {
    const id = new ObjectId()
    const now = new Date().toISOString()
    const newLayout: SwitLayout = {
      _id: id.toString(),
      ...layout,
      backgroundColor: layout.backgroundColor ?? '#FFFFFF',
      backgroundColorCustomizable: layout.backgroundColorCustomizable ?? true,
      isPreset: layout.isPreset ?? false,
      order: layout.order ?? Date.now(),
      createdAt: now,
      updatedAt: now,
    }
    this.layouts.set(id.toString(), newLayout)
    return newLayout
  }

  async duplicateLayout(id: string): Promise<SwitLayout | null> {
    const source = this.layouts.get(id)
    if (!source) return null
    const newId = new ObjectId()
    const now = new Date().toISOString()
    const duplicated: SwitLayout = {
      ...source,
      _id: newId.toString(),
      name: `${source.name} 복사본`,
      isPreset: false,
      order: Date.now(),
      slots: source.slots.map(s => ({ ...s })),
      frameLayers: (source.frameLayers || []).map(l => ({ ...l })),
      createdAt: now,
      updatedAt: now,
    }
    this.layouts.set(newId.toString(), duplicated)
    return duplicated
  }

  async getLayoutById(id: string): Promise<SwitLayout | null> {
    const layout = this.layouts.get(id)
    return layout ? normalizeLayout(layout) : null
  }

  async getLayoutsByEventId(eventId: string): Promise<SwitLayout[]> {
    return Array.from(this.layouts.values())
      .filter(l => l.eventId === eventId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(normalizeLayout)
  }

  async updateLayout(id: string, updates: Partial<SwitLayout>): Promise<boolean> {
    const layout = this.layouts.get(id)
    if (!layout) return false
    this.layouts.set(id, { ...layout, ...updates, updatedAt: new Date().toISOString() })
    return true
  }

  async deleteLayout(id: string): Promise<boolean> {
    return this.layouts.delete(id)
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

const memoryDB = (global._memoryDB && typeof global._memoryDB.createSticker === 'function' && typeof global._memoryDB.createLayout === 'function')
  ? global._memoryDB
  : new MemoryDB()

if (process.env.NODE_ENV === 'development') {
  global._memoryDB = memoryDB
}

export default memoryDB
