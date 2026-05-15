import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.NODE_ENV === 'production'
  ? '/data/labslot.db'
  : path.join(process.cwd(), 'data', 'labslot.db');

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      equipment_name TEXT NOT NULL,
      dates TEXT NOT NULL,
      time_start TEXT NOT NULL,
      time_end TEXT NOT NULL,
      slot_duration INTEGER NOT NULL DEFAULT 30,
      admin_token TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
  `);

  // Migrate: add admin_token column if it doesn't exist
  const eventCols = db.prepare("PRAGMA table_info(events)").all() as Array<{ name: string }>;
  if (eventCols.length > 0 && !eventCols.some(c => c.name === 'admin_token')) {
    db.exec("ALTER TABLE events ADD COLUMN admin_token TEXT NOT NULL DEFAULT ''");
  }

  // Migrate bookings table if it has old schema (time_slot instead of time_start/time_end)
  const cols = db.prepare("PRAGMA table_info(bookings)").all() as Array<{ name: string }>;
  if (cols.length > 0 && cols.some(c => c.name === 'time_slot')) {
    db.exec('DROP TABLE bookings');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL,
      participant_name TEXT NOT NULL,
      date TEXT NOT NULL,
      time_start TEXT NOT NULL,
      time_end TEXT NOT NULL,
      token TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (event_id) REFERENCES events(id)
    );
    CREATE INDEX IF NOT EXISTS idx_bookings_event ON bookings(event_id, date);

    CREATE TABLE IF NOT EXISTS support_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  // Migrate: add token column if it doesn't exist yet
  const bookingCols = db.prepare("PRAGMA table_info(bookings)").all() as Array<{ name: string }>;
  if (bookingCols.length > 0 && !bookingCols.some(c => c.name === 'token')) {
    db.exec("ALTER TABLE bookings ADD COLUMN token TEXT NOT NULL DEFAULT ''");
  }
}

export interface Event {
  id: string;
  name: string;
  equipment_name: string;
  dates: string[];
  time_start: string;
  time_end: string;
  slot_duration: number;
  admin_token: string;
  created_at: number;
}

export interface Booking {
  id: number;
  event_id: string;
  participant_name: string;
  date: string;
  time_start: string;
  time_end: string;
  token: string;
  created_at: number;
}

export function createEvent(event: Omit<Event, 'created_at'>): Event {
  const db = getDb();
  const now = Date.now();
  db.prepare(`
    INSERT INTO events (id, name, equipment_name, dates, time_start, time_end, slot_duration, admin_token, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(event.id, event.name, event.equipment_name, JSON.stringify(event.dates), event.time_start, event.time_end, event.slot_duration, event.admin_token, now);
  return { ...event, created_at: now };
}

export function getEvent(id: string): Event | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return { ...row, dates: JSON.parse(row.dates as string) } as Event;
}

export function getBookings(eventId: string): Booking[] {
  const db = getDb();
  return db.prepare('SELECT * FROM bookings WHERE event_id = ? ORDER BY date, time_start').all(eventId) as Booking[];
}

export function hasConflict(eventId: string, date: string, timeStart: string, timeEnd: string): boolean {
  const db = getDb();
  const row = db.prepare(`
    SELECT COUNT(*) as count FROM bookings
    WHERE event_id = ? AND date = ? AND time_start < ? AND time_end > ?
  `).get(eventId, date, timeEnd, timeStart) as { count: number };
  return row.count > 0;
}

export function createBooking(booking: Omit<Booking, 'id' | 'created_at'>): Booking {
  const db = getDb();
  const now = Date.now();
  const result = db.prepare(`
    INSERT INTO bookings (event_id, participant_name, date, time_start, time_end, token, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(booking.event_id, booking.participant_name, booking.date, booking.time_start, booking.time_end, booking.token, now);
  return { ...booking, id: result.lastInsertRowid as number, created_at: now };
}

export function deleteBooking(eventId: string, date: string, timeStart: string, participantName: string): boolean {
  const db = getDb();
  const result = db.prepare(`
    DELETE FROM bookings WHERE event_id = ? AND date = ? AND time_start = ? AND participant_name = ?
  `).run(eventId, date, timeStart, participantName);
  return result.changes > 0;
}

export function deleteBookingById(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM bookings WHERE id = ?').run(id);
  return result.changes > 0;
}

export function updateEvent(id: string, updates: Partial<Omit<Event, 'id' | 'created_at'>>): Event | null {
  const db = getDb();
  const event = getEvent(id);
  if (!event) return null;

  const updatedEvent = { ...event, ...updates };
  db.prepare(`
    UPDATE events SET name = ?, equipment_name = ?, dates = ?, time_start = ?, time_end = ? WHERE id = ?
  `).run(updatedEvent.name, updatedEvent.equipment_name, JSON.stringify(updatedEvent.dates), updatedEvent.time_start, updatedEvent.time_end, id);

  return updatedEvent;
}

export function deleteEvent(id: string): boolean {
  const db = getDb();
  // Delete associated bookings first
  db.prepare('DELETE FROM bookings WHERE event_id = ?').run(id);
  // Then delete the event
  const result = db.prepare('DELETE FROM events WHERE id = ?').run(id);
  return result.changes > 0;
}

export function verifyBookingToken(id: number, token: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT token FROM bookings WHERE id = ?').get(id) as { token: string } | undefined;
  if (!row) return false;
  return row.token === token;
}

export function verifyAdminToken(eventId: string, token: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT admin_token FROM events WHERE id = ?').get(eventId) as { admin_token: string } | undefined;
  if (!row) return false;
  return row.admin_token === token;
}

export function createSupportMessage(name: string, email: string, message: string): boolean {
  const db = getDb();
  const now = Date.now();
  const result = db.prepare(`
    INSERT INTO support_messages (name, email, message, created_at)
    VALUES (?, ?, ?, ?)
  `).run(name, email, message, now);
  return result.changes > 0;
}

export function updateBooking(id: number, updates: { date?: string; time_start?: string; time_end?: string }): Booking | null {
  const db = getDb();
  const current = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!current) return null;

  const date = updates.date ?? (current.date as string);
  const time_start = updates.time_start ?? (current.time_start as string);
  const time_end = updates.time_end ?? (current.time_end as string);
  const event_id = current.event_id as string;

  // Check for conflicts with OTHER bookings (exclude this booking by id)
  const conflict = db.prepare(`
    SELECT COUNT(*) as count FROM bookings
    WHERE event_id = ? AND id != ? AND date = ? AND time_start < ? AND time_end > ?
  `).get(event_id, id, date, time_end, time_start) as { count: number };

  if (conflict.count > 0) return null; // Conflict detected

  db.prepare(`
    UPDATE bookings SET date = ?, time_start = ?, time_end = ? WHERE id = ?
  `).run(date, time_start, time_end, id);

  return { ...current, date, time_start, time_end } as Booking;
}
