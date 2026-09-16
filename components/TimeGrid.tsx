'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { generateTimeSlots, formatTime, formatDate, nameToColorHex, addMinutes, convertZone, todayInZone, viewerTimezone, shortZoneName, DEFAULT_TIMEZONE } from '@/lib/utils';
import { Booking, Event } from '@/lib/db';
import BookingModal from './BookingModal';
import EditBookingModal from './EditBookingModal';

const SLOT_H = 40;   // px per 30-min row
const GRID_MINS = 30; // grid resolution

// Monday → Sunday of the week containing `today` (YYYY-MM-DD)
function weekDates(today: string): string[] {
  const monday = new Date(today + 'T00:00:00Z');
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

// Calendar cells (Mon-first) for the month containing `today`; null = padding
function monthCells(today: string): (string | null)[] {
  const first = new Date(today.slice(0, 8) + '01T00:00:00Z');
  const cells: (string | null)[] = Array((first.getUTCDay() + 6) % 7).fill(null);
  for (const d = new Date(first); d.getUTCMonth() === first.getUTCMonth(); d.setUTCDate(d.getUTCDate() + 1)) {
    cells.push(d.toISOString().slice(0, 10));
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Props {
  event: Event;
  bookings: Booking[];
  onRefresh: () => void | Promise<void>;
  adminToken?: string | null;
}

export default function TimeGrid({ event, bookings, onRefresh, adminToken }: Props) {
  const [view, setView] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [dayIdx, setDayIdx] = useState(0);

  const [isDragging, setIsDragging] = useState(false);
  const [dragDate, setDragDate] = useState<string | null>(null);
  const [dragStartIdx, setDragStartIdx] = useState<number | null>(null);
  const [dragEndIdx, setDragEndIdx] = useState<number | null>(null);
  const [pendingBooking, setPendingBooking] = useState<{ date: string; timeStart: string; timeEnd: string } | null>(null);

  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [ownedBookingIds, setOwnedBookingIds] = useState<Set<number>>(new Set());

  // Dragging existing bookings: move the whole block, or resize from its top/bottom edge
  type BookingDrag = { booking: Booking; mode: 'move' | 'start' | 'end'; startY: number; deltaSlots: number };
  const [bookingDrag, setBookingDrag] = useState<BookingDrag | null>(null);
  const bookingDragRef = useRef<BookingDrag | null>(null);
  // Keeps the dropped position on screen until the refreshed bookings arrive
  const [savedPreview, setSavedPreview] = useState<{ id: number; start: string; end: string } | null>(null);
  const [dragError, setDragError] = useState('');

  // Load owned booking tokens on mount and whenever bookings change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const tokens = JSON.parse(localStorage.getItem('bookingTokens') || '{}');
      setOwnedBookingIds(new Set(Object.keys(tokens).map(Number)));
    }
  }, [bookings]);

  const isDraggingRef = useRef(false);
  const dragDateRef = useRef<string | null>(null);
  const dragStartRef = useRef<number | null>(null);
  const dragEndRef = useRef<number | null>(null);

  // Stored dates/times are in the event's zone; labels are shown in the viewer's zone
  const eventTz = event.timezone || DEFAULT_TIMEZONE;
  const viewerTz = viewerTimezone();
  const sameZone = eventTz === viewerTz;
  const toViewerTime = (date: string, time: string) => formatTime(convertZone(date, time, eventTz, viewerTz).time);

  const slots = generateTimeSlots(event.time_start, event.time_end, GRID_MINS);
  const totalHeight = slots.length * SLOT_H;

  const visibleDates =
    view === 'daily' ? [event.dates[dayIdx]] :
    view === 'weekly' ? weekDates(todayInZone(eventTz)) :
    event.dates;

  // Map: date → bookings[]
  const bookingsByDate = new Map<string, Booking[]>();
  for (const b of bookings) {
    if (!bookingsByDate.has(b.date)) bookingsByDate.set(b.date, []);
    bookingsByDate.get(b.date)!.push(b);
  }

  function slotIdxForTime(time: string): number {
    const idx = slots.indexOf(time);
    if (idx !== -1) return idx;
    // Calculate position for times not on exact grid boundary
    const [sh, sm] = slots[0].split(':').map(Number);
    const [h, m] = time.split(':').map(Number);
    return Math.round(((h * 60 + m) - (sh * 60 + sm)) / GRID_MINS);
  }

  function isSlotCovered(date: string, slotIdx: number): boolean {
    const slotTime = slots[slotIdx];
    const slotEnd = addMinutes(slotTime, GRID_MINS);
    return (bookingsByDate.get(date) || []).some(
      b => b.time_start <= slotTime && b.time_end >= slotEnd
    );
  }

  function isSlotSelected(date: string, slotIdx: number): boolean {
    if (!isDragging || dragDate !== date) return false;
    if (dragStartIdx === null || dragEndIdx === null) return false;
    const lo = Math.min(dragStartIdx, dragEndIdx);
    const hi = Math.max(dragStartIdx, dragEndIdx);
    return slotIdx >= lo && slotIdx <= hi;
  }

  function handleMouseDown(date: string, slotIdx: number) {
    if (isSlotCovered(date, slotIdx)) return;
    isDraggingRef.current = true;
    dragDateRef.current = date;
    dragStartRef.current = slotIdx;
    dragEndRef.current = slotIdx;
    setIsDragging(true);
    setDragDate(date);
    setDragStartIdx(slotIdx);
    setDragEndIdx(slotIdx);
  }

  function handleMouseEnter(date: string, slotIdx: number) {
    if (!isDraggingRef.current || dragDateRef.current !== date) return;
    dragEndRef.current = slotIdx;
    setDragEndIdx(slotIdx);
  }

  const finalizeSelection = useCallback(() => {
    if (dragDateRef.current && dragStartRef.current !== null && dragEndRef.current !== null) {
      const lo = Math.min(dragStartRef.current, dragEndRef.current);
      const hi = Math.max(dragStartRef.current, dragEndRef.current);
      const timeStart = slots[lo];
      const timeEnd = addMinutes(slots[hi], GRID_MINS);
      setPendingBooking({ date: dragDateRef.current, timeStart, timeEnd });
    }
    isDraggingRef.current = false;
    dragDateRef.current = null;
    dragStartRef.current = null;
    dragEndRef.current = null;
    setIsDragging(false);
    setDragDate(null);
    setDragStartIdx(null);
    setDragEndIdx(null);
  }, [slots]);

  useEffect(() => {
    const onUp = () => { if (isDraggingRef.current) finalizeSelection(); };
    document.addEventListener('mouseup', onUp);
    return () => document.removeEventListener('mouseup', onUp);
  }, [finalizeSelection]);

  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

  // New start/end for a booking after dragging by `deltaSlots`, kept inside the event hours
  function draggedTimes(booking: Booking, mode: BookingDrag['mode'], deltaSlots: number) {
    const evStart = toMin(event.time_start), evEnd = toMin(event.time_end);
    let start = toMin(booking.time_start), end = toMin(booking.time_end);
    const d = deltaSlots * GRID_MINS;
    if (mode === 'move') {
      const shift = Math.min(Math.max(d, evStart - start), evEnd - end);
      start += shift; end += shift;
    } else if (mode === 'start') {
      start = Math.min(Math.max(start + d, evStart), end - GRID_MINS);
    } else {
      end = Math.max(Math.min(end + d, evEnd), start + GRID_MINS);
    }
    return { start: fromMin(start), end: fromMin(end) };
  }

  function handleBookingMouseDown(e: React.MouseEvent, booking: Booking, mode: BookingDrag['mode']) {
    e.stopPropagation();
    e.preventDefault();
    setDragError('');
    const drag = { booking, mode, startY: e.clientY, deltaSlots: 0 };
    bookingDragRef.current = drag;
    setBookingDrag(drag);
  }

  const saveBookingTimes = useCallback(async (booking: Booking, start: string, end: string) => {
    setSavedPreview({ id: booking.id, start, end });
    const token = adminToken || JSON.parse(localStorage.getItem('bookingTokens') || '{}')[booking.id.toString()];
    const res = await fetch(`/api/events/${event.id}/book`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: booking.id, token, date: booking.date, time_start: start, time_end: end }),
    });
    if (!res.ok) {
      setDragError(res.status === 409 ? 'That time overlaps another booking.' : 'Could not update booking.');
    }
    await onRefresh();
    setSavedPreview(null);
  }, [event.id, adminToken, onRefresh]);

  const dragActive = bookingDrag !== null;
  useEffect(() => {
    if (!dragActive) return;
    const onMove = (e: MouseEvent) => {
      const drag = bookingDragRef.current;
      if (!drag) return;
      const deltaSlots = Math.round((e.clientY - drag.startY) / SLOT_H);
      if (deltaSlots !== drag.deltaSlots) {
        bookingDragRef.current = { ...drag, deltaSlots };
        setBookingDrag(bookingDragRef.current);
      }
    };
    const onUp = (e: MouseEvent) => {
      const drag = bookingDragRef.current;
      bookingDragRef.current = null;
      setBookingDrag(null);
      if (!drag) return;
      // A click (no real movement) on the block opens the edit modal
      if (Math.abs(e.clientY - drag.startY) < 5) {
        if (drag.mode === 'move') setEditingBooking(drag.booking);
        return;
      }
      const { start, end } = draggedTimes(drag.booking, drag.mode, drag.deltaSlots);
      if (start !== drag.booking.time_start || end !== drag.booking.time_end) {
        saveBookingTimes(drag.booking, start, end);
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragActive, saveBookingTimes]);

  return (
    <div className="select-none">
      {/* Controls */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          <button
            onClick={() => setView('daily')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${view === 'daily' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            Day
          </button>
          <button
            onClick={() => setView('weekly')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors border-l border-gray-200 ${view === 'weekly' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            Week
          </button>
          <button
            onClick={() => setView('monthly')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors border-l border-gray-200 ${view === 'monthly' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            Month
          </button>
        </div>

        {view === 'daily' && (
          <div className="flex items-center gap-2">
            <button
              disabled={dayIdx === 0}
              onClick={() => setDayIdx(i => i - 1)}
              className="w-8 h-8 rounded-full border border-gray-200 hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center text-gray-600 text-lg leading-none"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-gray-700 min-w-[120px] text-center">
              {formatDate(event.dates[dayIdx])}
            </span>
            <button
              disabled={dayIdx === event.dates.length - 1}
              onClick={() => setDayIdx(i => i + 1)}
              className="w-8 h-8 rounded-full border border-gray-200 hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center text-gray-600 text-lg leading-none"
            >
              ›
            </button>
          </div>
        )}

        {view === 'weekly' && (
          <div className="text-sm font-semibold text-gray-700">
            {formatDate(visibleDates[0])} – {formatDate(visibleDates[6])}
          </div>
        )}

        {view === 'monthly' && (
          <div className="text-sm font-semibold text-gray-700">
            {new Date(todayInZone(eventTz) + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-2">
        Times shown in your time zone ({shortZoneName(viewerTz)})
        {!sameZone && <> · columns are dates at the equipment ({eventTz.replace(/_/g, ' ')}, {shortZoneName(eventTz)})</>}
      </p>

      {view === 'monthly' ? (
        <div className="grid grid-cols-7 border-t border-l border-gray-200">
          {WEEKDAYS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-gray-600 border-r border-b border-gray-200 bg-gray-50">
              {d}
            </div>
          ))}
          {monthCells(todayInZone(eventTz)).map((date, i) => {
            if (!date) return <div key={i} className="min-h-24 border-r border-b border-gray-200 bg-gray-50/50" />;
            const idx = event.dates.indexOf(date);
            const dayBookings = bookingsByDate.get(date) || [];
            const isToday = date === todayInZone(eventTz);
            return (
              <div
                key={date}
                onClick={() => { if (idx !== -1) { setDayIdx(idx); setView('daily'); } }}
                className={`min-h-24 p-1.5 border-r border-b border-gray-200 text-xs overflow-hidden
                  ${idx !== -1 ? 'cursor-pointer hover:bg-blue-50' : 'bg-gray-50 text-gray-400'}`}
                title={idx !== -1 ? 'Open day view' : 'Not bookable'}
              >
                <div className={`mb-1 w-6 h-6 flex items-center justify-center rounded-full font-semibold
                  ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700'}`}>
                  {Number(date.slice(8))}
                </div>
                {dayBookings.slice(0, 4).map(b => (
                  <div
                    key={b.id}
                    className="flex items-center gap-1 text-[11px] text-gray-600 truncate"
                    title={`${b.participant_name}: ${toViewerTime(b.date, b.time_start)} – ${toViewerTime(b.date, b.time_end)}`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: nameToColorHex(b.participant_name) }} />
                    {toViewerTime(b.date, b.time_start)} – {toViewerTime(b.date, b.time_end)}
                  </div>
                ))}
                {dayBookings.length > 4 && <div className="text-[11px] text-gray-500">+{dayBookings.length - 4} more</div>}
              </div>
            );
          })}
        </div>
      ) : (
      /* Scrollable grid with synced header */
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 560 }}>
        {/* Date header row (inside scroll container for horizontal sync) */}
        <div className="flex border-b border-gray-200 sticky top-0 bg-white z-5">
          <div className="w-14 shrink-0" />
          {visibleDates.map(date => (
            <div key={date} className="flex-1 text-center py-2 text-sm font-semibold text-gray-700 border-l border-gray-100" style={{ minWidth: view === 'daily' ? 180 : 100 }}>
              {formatDate(date)}
            </div>
          ))}
        </div>

        <div className="flex" style={{ height: totalHeight + 40, marginTop: '20px', marginBottom: '20px' }}>

          {/* Time labels */}
          <div className="w-14 shrink-0 relative" style={{ height: totalHeight }}>
            {slots.map((slot, i) => (
              <div
                key={slot}
                className="absolute right-2 text-xs text-gray-900 -translate-y-[9px] pointer-events-none"
                style={{ top: i * SLOT_H }}
              >
                {slot.endsWith(':00') ? toViewerTime(visibleDates[0], slot) : ''}
              </div>
            ))}
          </div>

          {/* Date columns */}
          {visibleDates.map(date => (
            <div
              key={date}
              className="flex-1 relative border-l border-gray-200"
              style={{ height: totalHeight, minWidth: view === 'daily' ? 180 : 100 }}
            >
              {/* Slot cells — click/drag target */}
              {slots.map((slot, i) => {
                const covered = isSlotCovered(date, i);
                const selected = isSlotSelected(date, i);
                return (
                  <div
                    key={slot}
                    className={`absolute w-full transition-colors
                      ${slot.endsWith(':00') ? 'border-b border-gray-200' : 'border-b border-dashed border-gray-100'}
                      ${covered
                        ? 'cursor-not-allowed'
                        : selected
                          ? 'bg-blue-100 cursor-ns-resize'
                          : 'hover:bg-blue-50 cursor-ns-resize'}
                    `}
                    style={{ top: i * SLOT_H, height: SLOT_H }}
                    onMouseDown={() => handleMouseDown(date, i)}
                    onMouseEnter={() => handleMouseEnter(date, i)}
                  />
                );
              })}

              {/* Booking blocks */}
              {(bookingsByDate.get(date) || []).map(booking => {
                const isDragged = bookingDrag?.booking.id === booking.id;
                const { start: timeStart, end: timeEnd } =
                  isDragged ? draggedTimes(booking, bookingDrag.mode, bookingDrag.deltaSlots) :
                  savedPreview?.id === booking.id ? savedPreview :
                  { start: booking.time_start, end: booking.time_end };
                const startIdx = slotIdxForTime(timeStart);
                const endIdx = slotIdxForTime(timeEnd);
                const top = startIdx * SLOT_H;
                const height = Math.max((endIdx - startIdx) * SLOT_H, SLOT_H);
                const color = nameToColorHex(booking.participant_name);
                const isOwned = adminToken ? true : ownedBookingIds.has(booking.id);
                return (
                  <div
                    key={booking.id}
                    className={`group absolute rounded overflow-hidden p-1.5 text-white text-xs ${
                      isOwned ? 'cursor-grab hover:opacity-90' : 'cursor-default opacity-70'
                    } ${isDragged ? 'z-20 opacity-80 shadow-lg ring-2 ring-white cursor-grabbing' : 'z-10'}`}
                    style={{ top: top + 1, height: height - 2, left: 3, right: 3, backgroundColor: color }}
                    onMouseDown={(e) => isOwned ? handleBookingMouseDown(e, booking, 'move') : e.stopPropagation()}
                    title={isOwned ? 'Drag to move, drag top/bottom edge to change duration, click to edit' : 'Not your booking'}
                  >
                    {isOwned && (
                      <>
                        <div
                          className="absolute inset-x-0 top-0 h-2 cursor-ns-resize"
                          onMouseDown={(e) => handleBookingMouseDown(e, booking, 'start')}
                        />
                        <div
                          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize flex justify-center items-end pb-0.5"
                          onMouseDown={(e) => handleBookingMouseDown(e, booking, 'end')}
                        >
                          <div className="w-6 h-0.5 rounded bg-white/70 opacity-0 group-hover:opacity-100" />
                        </div>
                      </>
                    )}
                    <div className="font-semibold leading-tight truncate">{booking.participant_name}</div>
                    {height > 30 && (
                      <div className="opacity-80 text-[10px] mt-0.5">
                        {toViewerTime(booking.date, timeStart)} – {toViewerTime(booking.date, timeEnd)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex items-center gap-5 text-xs text-gray-500 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-blue-100 border border-blue-300" />
          <span>Click &amp; drag to select your time</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-blue-500" />
          <span>Booked — drag to move, drag bottom edge to resize</span>
        </div>
        {dragError && <span className="text-red-600">{dragError}</span>}
      </div>

      {pendingBooking && (
        <BookingModal
          eventId={event.id}
          date={pendingBooking.date}
          timeStart={pendingBooking.timeStart}
          timeEnd={pendingBooking.timeEnd}
          eventTz={eventTz}
          onClose={() => setPendingBooking(null)}
          onBooked={() => {
            setPendingBooking(null);
            onRefresh();
          }}
        />
      )}

      {editingBooking && (
        <EditBookingModal
          booking={editingBooking}
          eventId={event.id}
          eventTz={eventTz}
          onClose={() => setEditingBooking(null)}
          onUpdated={() => {
            setEditingBooking(null);
            onRefresh();
          }}
          adminToken={adminToken}
        />
      )}
    </div>
  );
}
