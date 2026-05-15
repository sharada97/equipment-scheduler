import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
});

async function initSchema() {
  const client = await pool.connect();
  try {
    // Create tables if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        equipment_name TEXT NOT NULL,
        dates TEXT NOT NULL,
        time_start TEXT NOT NULL,
        time_end TEXT NOT NULL,
        slot_duration INTEGER NOT NULL DEFAULT 30,
        admin_token TEXT NOT NULL DEFAULT '',
        created_at BIGINT NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        event_id TEXT NOT NULL,
        participant_name TEXT NOT NULL,
        date TEXT NOT NULL,
        time_start TEXT NOT NULL,
        time_end TEXT NOT NULL,
        token TEXT NOT NULL DEFAULT '',
        created_at BIGINT NOT NULL,
        FOREIGN KEY (event_id) REFERENCES events(id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bookings_event ON bookings(event_id, date);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS support_messages (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at BIGINT NOT NULL
      );
    `);
  } finally {
    client.release();
  }
}

// Initialize schema on first import
initSchema().catch(console.error);

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

export async function createEvent(event: Omit<Event, 'created_at'>): Promise<Event> {
  const now = Date.now();
  const result = await pool.query(
    `INSERT INTO events (id, name, equipment_name, dates, time_start, time_end, slot_duration, admin_token, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [event.id, event.name, event.equipment_name, JSON.stringify(event.dates), event.time_start, event.time_end, event.slot_duration, event.admin_token, now]
  );
  return { ...event, created_at: now };
}

export async function getEvent(id: string): Promise<Event | null> {
  const result = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { ...row, dates: JSON.parse(row.dates) } as Event;
}

export async function getBookings(eventId: string): Promise<Booking[]> {
  const result = await pool.query(
    'SELECT * FROM bookings WHERE event_id = $1 ORDER BY date, time_start',
    [eventId]
  );
  return result.rows as Booking[];
}

export async function hasConflict(eventId: string, date: string, timeStart: string, timeEnd: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM bookings
     WHERE event_id = $1 AND date = $2 AND time_start < $3 AND time_end > $4`,
    [eventId, date, timeEnd, timeStart]
  );
  return parseInt(result.rows[0].count) > 0;
}

export async function createBooking(booking: Omit<Booking, 'id' | 'created_at'>): Promise<Booking> {
  const now = Date.now();
  const result = await pool.query(
    `INSERT INTO bookings (event_id, participant_name, date, time_start, time_end, token, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [booking.event_id, booking.participant_name, booking.date, booking.time_start, booking.time_end, booking.token, now]
  );
  return { ...booking, id: result.rows[0].id, created_at: now };
}

export async function deleteBooking(eventId: string, date: string, timeStart: string, participantName: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM bookings WHERE event_id = $1 AND date = $2 AND time_start = $3 AND participant_name = $4`,
    [eventId, date, timeStart, participantName]
  );
  return result.rowCount! > 0;
}

export async function deleteBookingById(id: number): Promise<boolean> {
  const result = await pool.query('DELETE FROM bookings WHERE id = $1', [id]);
  return result.rowCount! > 0;
}

export async function updateEvent(id: string, updates: Partial<Omit<Event, 'id' | 'created_at'>>): Promise<Event | null> {
  const event = await getEvent(id);
  if (!event) return null;

  const updatedEvent = { ...event, ...updates };
  await pool.query(
    `UPDATE events SET name = $1, equipment_name = $2, dates = $3, time_start = $4, time_end = $5 WHERE id = $6`,
    [updatedEvent.name, updatedEvent.equipment_name, JSON.stringify(updatedEvent.dates), updatedEvent.time_start, updatedEvent.time_end, id]
  );

  return updatedEvent;
}

export async function deleteEvent(id: string): Promise<boolean> {
  // Delete associated bookings first
  await pool.query('DELETE FROM bookings WHERE event_id = $1', [id]);
  // Then delete the event
  const result = await pool.query('DELETE FROM events WHERE id = $1', [id]);
  return result.rowCount! > 0;
}

export async function verifyBookingToken(id: number, token: string): Promise<boolean> {
  const result = await pool.query('SELECT token FROM bookings WHERE id = $1', [id]);
  if (result.rows.length === 0) return false;
  return result.rows[0].token === token;
}

export async function verifyAdminToken(eventId: string, token: string): Promise<boolean> {
  const result = await pool.query('SELECT admin_token FROM events WHERE id = $1', [eventId]);
  if (result.rows.length === 0) return false;
  return result.rows[0].admin_token === token;
}

export async function createSupportMessage(name: string, email: string, message: string): Promise<boolean> {
  const now = Date.now();
  const result = await pool.query(
    `INSERT INTO support_messages (name, email, message, created_at)
     VALUES ($1, $2, $3, $4)`,
    [name, email, message, now]
  );
  return result.rowCount! > 0;
}

export async function updateBooking(id: number, updates: { date?: string; time_start?: string; time_end?: string }): Promise<Booking | null> {
  const result = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;

  const current = result.rows[0];
  const date = updates.date ?? current.date;
  const time_start = updates.time_start ?? current.time_start;
  const time_end = updates.time_end ?? current.time_end;
  const event_id = current.event_id;

  // Check for conflicts with OTHER bookings (exclude this booking by id)
  const conflictResult = await pool.query(
    `SELECT COUNT(*) as count FROM bookings
     WHERE event_id = $1 AND id != $2 AND date = $3 AND time_start < $4 AND time_end > $5`,
    [event_id, id, date, time_end, time_start]
  );

  if (parseInt(conflictResult.rows[0].count) > 0) return null; // Conflict detected

  await pool.query(
    `UPDATE bookings SET date = $1, time_start = $2, time_end = $3 WHERE id = $4`,
    [date, time_start, time_end, id]
  );

  return { ...current, date, time_start, time_end } as Booking;
}
