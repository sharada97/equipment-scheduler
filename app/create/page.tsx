'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateDateRange } from '@/lib/utils';

export default function CreatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const form = e.currentTarget;
    const data = new FormData(form);

    const startDate = data.get('start_date') as string;
    const endDate = data.get('end_date') as string;

    if (startDate > endDate) {
      setError('End date must be after start date.');
      setLoading(false);
      return;
    }

    const dates = generateDateRange(startDate, endDate);
    if (dates.length > 365) {
      setError('Please select a range of 365 days or fewer.');
      setLoading(false);
      return;
    }

    const payload = {
      name: data.get('name'),
      equipment_name: data.get('equipment_name'),
      dates,
      time_start: data.get('time_start'),
      time_end: data.get('time_end'),
      slot_duration: 30,
    };

    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      setError('Failed to create schedule. Please try again.');
      setLoading(false);
      return;
    }

    const { id, adminToken } = await res.json();
    router.push(`/${id}?adminToken=${adminToken}`);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Create Equipment Schedule</h1>
        <p className="text-sm text-gray-500 mb-6">Share the link so others can book their time slots.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project / Schedule Name</label>
            <input
              name="name"
              type="text"
              required
              placeholder="e.g. Q2 Microscope Access"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipment Name</label>
            <input
              name="equipment_name"
              type="text"
              required
              placeholder="e.g. FTIR Spectrometer #2"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                name="start_date"
                type="date"
                required
                defaultValue={today}
                min={today}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                name="end_date"
                type="date"
                required
                defaultValue={today}
                min={today}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Available From</label>
              <input
                name="time_start"
                type="time"
                required
                defaultValue="09:00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Available Until</label>
              <input
                name="time_end"
                type="time"
                required
                defaultValue="17:00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Creating...' : 'Create Schedule & Get Link'}
          </button>
        </form>
      </div>
    </div>
  );
}
