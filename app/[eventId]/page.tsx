'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import TimeGrid from '@/components/TimeGrid';
import AboutModal from '@/components/AboutModal';
import SupportModal from '@/components/SupportModal';
import { Event, Booking } from '@/lib/db';

interface EventData {
  event: Event;
  bookings: Booking[];
}

export default function EventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<EventData | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showSupport, setShowSupport] = useState(false);

  useEffect(() => {
    setAdminToken(searchParams.get('adminToken'));
  }, [searchParams]);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}`);
    if (!res.ok) {
      setError('Schedule not found.');
      return;
    }
    const json = await res.json();
    setData(json);
  }, [eventId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDelete() {
    if (!window.confirm('Are you sure you want to delete this event? All bookings will be removed.')) return;

    const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/');
    } else {
      setError('Failed to delete event');
    }
  }

  async function handleUpdate(formData: FormData) {
    setEditLoading(true);
    const startDate = formData.get('start_date') as string;
    const endDate = formData.get('end_date') as string;

    if (startDate > endDate) {
      setError('End date must be after start date.');
      setEditLoading(false);
      return;
    }

    const payload = {
      name: formData.get('name'),
      equipment_name: formData.get('equipment_name'),
      start_date: startDate,
      end_date: endDate,
      time_start: formData.get('time_start'),
      time_end: formData.get('time_end'),
    };

    const res = await fetch(`/api/events/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setShowEditModal(false);
      fetchData();
    } else {
      setError('Failed to update event');
    }
    setEditLoading(false);
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">{error}</p>
          <a href="/" className="mt-4 inline-block text-blue-600 hover:underline text-sm">← Back to home</a>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading schedule...</div>
      </div>
    );
  }

  const { event, bookings } = data;
  const totalSlots = event.dates.length * Math.floor(
    (parseInt(event.time_end) - parseInt(event.time_start)) * (60 / event.slot_duration)
  );
  const bookedCount = bookings.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-1">Equipment Schedule</p>
              <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
              <p className="text-gray-500 mt-0.5">{event.equipment_name}</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {adminToken && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="text-sm text-gray-700 hover:text-gray-900 font-medium px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  ✎ Edit Event
                </button>
              )}
              <button
                onClick={() => setShowAbout(true)}
                className="text-sm text-gray-700 hover:text-gray-900 font-medium px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                About
              </button>
              <button
                onClick={() => setShowSupport(true)}
                className="text-sm text-gray-700 hover:text-gray-900 font-medium px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Support
              </button>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-right text-xs text-gray-400">
                <div>{bookedCount} booked</div>
                <div>{event.slot_duration}-min slots</div>
              </div>
              {adminToken && (
                <>
                  <button
                    onClick={() => {
                      const publicUrl = window.location.href.split('?')[0];
                      navigator.clipboard.writeText(publicUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    {copied ? '✓ Copied!' : '🔗 Share (Public)'}
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    {copied ? '✓ Copied!' : '👤 Admin Link'}
                  </button>
                </>
              )}
              {!adminToken && (
                <button
                  onClick={copyLink}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {copied ? '✓ Copied!' : '🔗 Share Link'}
                </button>
              )}
              {adminToken && (
                <>
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    ✎ Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    🗑 Delete
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
            <strong>How to use:</strong> White cells are available. Click one to book your slot. Each slot can only be booked by one group — pick one that&apos;s free.
          </div>
        </div>

        {/* Grid */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <TimeGrid event={event} bookings={bookings} onRefresh={fetchData} adminToken={adminToken} />
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Grid refreshes automatically every 10 seconds
        </p>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-lg max-w-lg w-full p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Event</h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdate(new FormData(e.currentTarget));
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  name="name"
                  type="text"
                  defaultValue={data?.event.name}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Equipment</label>
                <input
                  name="equipment_name"
                  type="text"
                  defaultValue={data?.event.equipment_name}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    name="start_date"
                    type="date"
                    defaultValue={data?.event.dates[0]}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    name="end_date"
                    type="date"
                    defaultValue={data?.event.dates[data?.event.dates.length - 1]}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <input
                    name="time_start"
                    type="time"
                    defaultValue={data?.event.time_start}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Until</label>
                  <input
                    name="time_end"
                    type="time"
                    defaultValue={data?.event.time_end}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
      {showSupport && <SupportModal onClose={() => setShowSupport(false)} />}
    </div>
  );
}
