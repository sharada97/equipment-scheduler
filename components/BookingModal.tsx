'use client';

import { useState } from 'react';
import { formatDate, formatTime } from '@/lib/utils';

interface Props {
  eventId: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  onClose: () => void;
  onBooked: () => void;
}

export default function BookingModal({ eventId, date, timeStart, timeEnd, onClose, onBooked }: Props) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleBook() {
    if (!name.trim()) {
      setError('Please enter your name or group name.');
      return;
    }
    setLoading(true);
    setError('');

    const res = await fetch(`/api/events/${eventId}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_name: name.trim(), date, time_start: timeStart, time_end: timeEnd }),
    });

    if (res.status === 409) {
      setError('This time overlaps with an existing booking. Please pick a different slot.');
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
      return;
    }

    const data = await res.json();
    const { booking, token } = data;

    // Store token in localStorage for future edits
    if (typeof window !== 'undefined' && token && booking?.id) {
      const tokens = JSON.parse(localStorage.getItem('bookingTokens') || '{}');
      tokens[booking.id.toString()] = token;
      localStorage.setItem('bookingTokens', JSON.stringify(tokens));
    }

    onBooked();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Confirm booking</h2>
        <div className="bg-blue-50 rounded-lg px-3 py-2 mb-4">
          <p className="text-sm font-medium text-blue-800">{formatDate(date)}</p>
          <p className="text-sm text-blue-600">{formatTime(timeStart)} – {formatTime(timeEnd)}</p>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-1">Your name or group name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleBook()}
          autoFocus
          placeholder="e.g. Lab Group A"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
        />

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleBook}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? 'Booking...' : 'Confirm Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}
