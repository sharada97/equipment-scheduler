import { NextRequest, NextResponse } from 'next/server';
import { createBooking, deleteBooking, deleteBookingById, updateBooking, verifyBookingToken, verifyAdminToken, hasConflict } from '@/lib/db';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { participant_name, date, time_start, time_end } = await req.json();

    if (!participant_name || !date || !time_start || !time_end) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (hasConflict(id, date, time_start, time_end)) {
      return NextResponse.json({ error: 'This time overlaps with an existing booking' }, { status: 409 });
    }

    const token = randomBytes(16).toString('hex');
    const booking = createBooking({ event_id: id, participant_name, date, time_start, time_end, token });
    return NextResponse.json({ booking, token });
  } catch {
    return NextResponse.json({ error: 'Failed to book slot' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { booking_id, token, date, time_start, time_end } = await req.json();

    if (!booking_id || !token || !date || !time_start || !time_end) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!verifyBookingToken(booking_id, token)) {
      return NextResponse.json({ error: 'Unauthorized: invalid token' }, { status: 403 });
    }

    const updated = updateBooking(booking_id, { date, time_start, time_end });
    if (!updated) {
      return NextResponse.json({ error: 'Booking not found or time conflicts with existing booking' }, { status: 409 });
    }
    return NextResponse.json({ booking: updated });
  } catch {
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { booking_id, token } = await req.json();

    if (!booking_id || !token) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const isBookingOwner = verifyBookingToken(booking_id, token);
    const isAdmin = verifyAdminToken(id, token);
    if (!isBookingOwner && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: invalid token' }, { status: 403 });
    }

    const deleted = deleteBookingById(booking_id);
    if (!deleted) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 });
  }
}
