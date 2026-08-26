import { Resend } from 'resend';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email address is required' });
  }

  // Load Resend API key from environment variables
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.error("Missing Resend API key in environment variables.");
    return res.status(500).json({ 
      success: false, 
      message: 'Server configuration error. Missing email gateway credentials.' 
    });
  }

  // Generate 6-digit OTP Code securely on the server
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    const resend = new Resend(resendApiKey);
    
    // Send the Email
    // Note: When testing on free tier, Resend might only allow sending from 'onboarding@resend.dev' 
    // to the email address you registered with, or you must verify a domain to send from it.
    const data = await resend.emails.send({
      from: 'Banerjee Sweets <onboarding@resend.dev>',
      to: [email],
      subject: 'Your Verification OTP - Banerjee Sweets',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #4CAF50; text-align: center;">Banerjee Sweets</h2>
          <p>Hello!</p>
          <p>Your one-time password (OTP) for completing your order is:</p>
          <h1 style="text-align: center; font-size: 32px; letter-spacing: 5px; color: #333;">${otpCode}</h1>
          <p>This code is valid for 5 minutes. Do not share this code with anyone.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999; text-align: center;">Handcrafted with pure ghee & love in Arambagh.</p>
        </div>
      `
    });

    if (data.error) {
      console.error("[Resend] API Error:", data.error);
      return res.status(500).json({ success: false, message: 'Failed to send OTP email.' });
    }

    console.log(`[Resend] Sent Email to ${email}. ID: ${data.data?.id}`);
    
    // Return success and the OTP code back to the frontend
    return res.status(200).json({ success: true, otpCode });

  } catch (error) {
    console.error("[Resend] Error sending Email:", error);
    return res.status(500).json({ success: false, message: 'Failed to send Email OTP.' });
  }
}
