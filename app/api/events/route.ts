import { NextRequest, NextResponse } from 'next/server';
import { createEvent } from '@/lib/db';
import { nanoid } from 'nanoid';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, equipment_name, dates, time_start, time_end, slot_duration } = body;

    if (!name || !equipment_name || !dates?.length || !time_start || !time_end) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const adminToken = randomBytes(16).toString('hex');
    const event = await createEvent({
      id: nanoid(10),
      name,
      equipment_name,
      dates,
      time_start,
      time_end,
      slot_duration: slot_duration ?? 60,
      admin_token: adminToken,
    });

    return NextResponse.json({ id: event.id, adminToken });
  } catch {
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
