'use client';

import { useState } from 'react';
import { Booking } from '@/lib/db';
import { formatTime } from '@/lib/utils';

interface Props {
  booking: Booking;
  eventId: string;
  onClose: () => void;
  onUpdated: () => void;
  adminToken?: string | null;
}

export default function EditBookingModal({ booking, eventId, onClose, onUpdated, adminToken }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeStart, setTimeStart] = useState(booking.time_start);
  const [timeEnd, setTimeEnd] = useState(booking.time_end);

  async function handleSave() {
    if (timeStart >= timeEnd) {
      setError('End time must be after start time.');
      return;
    }

    setLoading(true);
    const token = adminToken || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('bookingTokens') || '{}')[booking.id.toString()] : null);

    const res = await fetch(`/api/events/${eventId}/book`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        booking_id: booking.id,
        token,
        date: booking.date,
        time_start: timeStart,
        time_end: timeEnd,
      }),
    });

    if (res.ok) {
      onUpdated();
      onClose();
    } else if (res.status === 403) {
      setError('You do not have permission to edit this booking.');
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to update booking');
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!window.confirm('Delete this booking?')) return;

    setLoading(true);
    const token = adminToken || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('bookingTokens') || '{}')[booking.id.toString()] : null);

    const res = await fetch(`/api/events/${eventId}/book`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        booking_id: booking.id,
        token,
      }),
    });

    if (res.ok) {
      onUpdated();
      onClose();
    } else if (res.status === 403) {
      setError('You do not have permission to delete this booking.');
    } else {
      setError('Failed to delete booking');
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{booking.participant_name}</h2>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <div className="text-sm text-gray-600">{booking.date}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
            <input
              type="time"
              value={timeStart}
              onChange={(e) => setTimeStart(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
            <input
              type="time"
              value={timeEnd}
              onChange={(e) => setTimeEnd(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium text-sm transition-colors"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-medium text-sm transition-colors"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
