export function generateTimeSlots(timeStart: string, timeEnd: string, slotDuration: number): string[] {
  const slots: string[] = [];
  const [startH, startM] = timeStart.split(':').map(Number);
  const [endH, endM] = timeEnd.split(':').map(Number);
  let current = startH * 60 + startM;
  const end = endH * 60 + endM;
  while (current < end) {
    const h = Math.floor(current / 60).toString().padStart(2, '0');
    const m = (current % 60).toString().padStart(2, '0');
    slots.push(`${h}:${m}`);
    current += slotDuration;
  }
  return slots;
}

export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}`;
}

export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const HEX_COLORS = [
  '#3b82f6', '#22c55e', '#a855f7', '#f97316',
  '#ec4899', '#14b8a6', '#ef4444', '#6366f1',
  '#eab308', '#06b6d4',
];

export function nameToColorHex(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return HEX_COLORS[Math.abs(hash) % HEX_COLORS.length];
}

export function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export const DEFAULT_TIMEZONE = 'America/Los_Angeles';

export function viewerTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Wall-clock parts of an instant in a given zone
function partsInZone(instant: Date, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(instant);
  const get = (t: string) => parts.find(p => p.type === t)!.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

// Instant for a wall-clock date + time in `tz`
function zonedInstant(date: string, time: string, tz: string): Date {
  const guess = new Date(`${date}T${time}:00Z`);
  for (let i = 0; i < 2; i++) {
    const p = partsInZone(guess, tz);
    const diff = new Date(`${p.date}T${p.time}:00Z`).getTime() - new Date(`${date}T${time}:00Z`).getTime();
    guess.setTime(guess.getTime() - diff);
  }
  return guess;
}

// Convert a wall-clock date + time from one zone to another
export function convertZone(date: string, time: string, fromTz: string, toTz: string): { date: string; time: string } {
  if (fromTz === toTz) return { date, time };
  return partsInZone(zonedInstant(date, time, fromTz), toTz);
}

export function todayInZone(tz: string): string {
  return partsInZone(new Date(), tz).date;
}

export function shortZoneName(tz: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date());
  return parts.find(p => p.type === 'timeZoneName')?.value ?? tz;
}
