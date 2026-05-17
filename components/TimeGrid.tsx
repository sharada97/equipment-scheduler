'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { generateTimeSlots, formatTime, formatDate, nameToColorHex, addMinutes } from '@/lib/utils';
import { Booking, Event } from '@/lib/db';
import BookingModal from './BookingModal';
import EditBookingModal from './EditBookingModal';

const SLOT_H = 40;   // px per 30-min row
const GRID_MINS = 30; // grid resolution

interface Props {
  event: Event;
  bookings: Booking[];
  onRefresh: () => void;
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

  // For dragging existing bookings
  const [draggedBooking, setDraggedBooking] = useState<Booking | null>(null);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const draggedBookingRef = useRef<Booking | null>(null);
  const dragStartYRef = useRef<number | null>(null);

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

  const slots = generateTimeSlots(event.time_start, event.time_end, GRID_MINS);
  const totalHeight = slots.length * SLOT_H;

  const visibleDates = view === 'daily' ? [event.dates[dayIdx]] : event.dates;

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

  // Handlers for dragging existing bookings
  const handleBookingMouseDown = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    draggedBookingRef.current = booking;
    dragStartYRef.current = e.clientY;
    setDraggedBooking(booking);
    setDragStartY(e.clientY);
  };

  const handleBookingMouseMove = (e: React.MouseEvent) => {
    if (!draggedBookingRef.current || dragStartYRef.current === null) return;
  };

  const handleBookingMouseUp = useCallback(async (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    if (!draggedBookingRef.current || dragStartYRef.current === null) {
      draggedBookingRef.current = null;
      dragStartYRef.current = null;
      setDraggedBooking(null);
      setDragStartY(null);
      return;
    }

    const deltaY = e.clientY - dragStartYRef.current;
    draggedBookingRef.current = null;
    dragStartYRef.current = null;
    setDraggedBooking(null);
    setDragStartY(null);

    // If drag is small, open edit modal instead
    if (Math.abs(deltaY) < 5) {
      setEditingBooking(booking);
      return;
    }

    // Calculate time change based on pixel offset
    const slotPixels = SLOT_H;
    const minutesPerSlot = GRID_MINS;
    const deltaMinutes = Math.round((deltaY / slotPixels) * minutesPerSlot);

    // Calculate new times
    const [startH, startM] = booking.time_start.split(':').map(Number);
    const [endH, endM] = booking.time_end.split(':').map(Number);
    const startTotalMin = startH * 60 + startM + deltaMinutes;
    const endTotalMin = endH * 60 + endM + deltaMinutes;

    // Validate times are within event bounds
    const [eventStartH, eventStartM] = event.time_start.split(':').map(Number);
    const [eventEndH, eventEndM] = event.time_end.split(':').map(Number);
    const eventStartMin = eventStartH * 60 + eventStartM;
    const eventEndMin = eventEndH * 60 + eventEndM;

    if (startTotalMin < eventStartMin || endTotalMin > eventEndMin) {
      return; // Out of bounds
    }

    const newTimeStart = `${String(Math.floor(startTotalMin / 60)).padStart(2, '0')}:${String(startTotalMin % 60).padStart(2, '0')}`;
    const newTimeEnd = `${String(Math.floor(endTotalMin / 60)).padStart(2, '0')}:${String(endTotalMin % 60).padStart(2, '0')}`;

    // Call update API
    const token = adminToken || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('bookingTokens') || '{}')[booking.id.toString()] : null);
    const res = await fetch(`/api/events/${event.id}/book`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        booking_id: booking.id,
        token,
        date: booking.date,
        time_start: newTimeStart,
        time_end: newTimeEnd,
      }),
    });

    if (res.ok) {
      onRefresh();
    }
  }, [event, adminToken, onRefresh]);

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

        {view === 'monthly' && (
          <div className="text-sm text-gray-600">
            All available slots for {event.dates.length} days
          </div>
        )}
      </div>

      {/* Scrollable grid with synced header */}
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
                {slot.endsWith(':00') ? formatTime(slot) : ''}
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
                const startIdx = slotIdxForTime(booking.time_start);
                const endIdx = slotIdxForTime(booking.time_end);
                const top = startIdx * SLOT_H;
                const height = Math.max((endIdx - startIdx) * SLOT_H, SLOT_H);
                const color = nameToColorHex(booking.participant_name);
                const isOwned = adminToken ? true : ownedBookingIds.has(booking.id);
                return (
                  <div
                    key={booking.id}
                    className={`absolute rounded z-10 overflow-hidden p-1.5 text-white text-xs transition-opacity ${
                      isOwned ? 'cursor-grab hover:opacity-80 active:cursor-grabbing' : 'cursor-default opacity-70'
                    } ${draggedBooking?.id === booking.id ? 'opacity-60' : ''}`}
                    style={{ top: top + 1, height: height - 2, left: 3, right: 3, backgroundColor: color }}
                    onMouseDown={(e) => isOwned && handleBookingMouseDown(e, booking)}
                    onMouseMove={(e) => isOwned && handleBookingMouseMove(e)}
                    onMouseUp={(e) => isOwned && handleBookingMouseUp(e, booking)}
                    title={isOwned ? 'Drag to move time, click to edit' : 'Not your booking'}
                  >
                    <div className="font-semibold leading-tight truncate">{booking.participant_name}</div>
                    {height > 30 && (
                      <div className="opacity-80 text-[10px] mt-0.5">
                        {formatTime(booking.time_start)} – {formatTime(booking.time_end)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-5 text-xs text-gray-500 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-blue-100 border border-blue-300" />
          <span>Click &amp; drag to select your time</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-blue-500" />
          <span>Booked</span>
        </div>
      </div>

      {pendingBooking && (
        <BookingModal
          eventId={event.id}
          date={pendingBooking.date}
          timeStart={pendingBooking.timeStart}
          timeEnd={pendingBooking.timeEnd}
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
