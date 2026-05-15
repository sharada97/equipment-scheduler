import { NextRequest, NextResponse } from 'next/server';
import { getEvent, getBookings, updateEvent, deleteEvent } from '@/lib/db';
import { generateDateRange } from '@/lib/utils';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const event = getEvent(id);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    const bookings = getBookings(id);
    return NextResponse.json({ event, bookings });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await req.json();
    const event = getEvent(id);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // If dates are provided as start/end, generate the date range
    let dates = data.dates;
    if (data.start_date && data.end_date) {
      dates = generateDateRange(data.start_date, data.end_date);
      if (dates.length > 365) {
        return NextResponse.json({ error: 'Please select a range of 365 days or fewer.' }, { status: 400 });
      }
    }

    const updated = updateEvent(id, {
      name: data.name ?? event.name,
      equipment_name: data.equipment_name ?? event.equipment_name,
      dates: dates ?? event.dates,
      time_start: data.time_start ?? event.time_start,
      time_end: data.time_end ?? event.time_end,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const success = deleteEvent(id);
    if (!success) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
