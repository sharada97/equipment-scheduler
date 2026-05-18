import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export async function sendSupportEmail(name: string, email: string, message: string): Promise<boolean> {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('Email credentials not configured');
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'sharada1997prasad@gmail.com',
      subject: `New Support Message from ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New Support Message</h2>

          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>From:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-wrap; color: #555;">${message}</p>
          </div>

          <p style="color: #999; font-size: 12px;">
            This message was sent from your Lab Equipment Scheduler support form.
          </p>
        </div>
      `,
      replyTo: email,
    });

    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}
