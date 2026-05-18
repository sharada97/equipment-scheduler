import { NextRequest, NextResponse } from 'next/server';
import { createSupportMessage } from '@/lib/db';
import { sendSupportEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { name, email, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Save to database
    const success = await createSupportMessage(name, email, message);
    if (!success) {
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
    }

    // Send email notification
    await sendSupportEmail(name, email, message);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
