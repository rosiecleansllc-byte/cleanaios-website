import Anthropic from '@anthropic-ai/sdk';
import nodemailer from 'nodemailer';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  requireTLS: true,
});

async function scoreApplication(data) {
  const prompt = `You are reviewing a Clean AIOS program application. Clean AIOS is an AI advisory program for residential cleaning business owners. Score this application as one of three outcomes:

YES — Strong fit. Ready to implement, has a real business, specific problem to solve, coachable mindset.
MAYBE — Could be a fit but needs Cecilia's review. Unclear readiness, or some signals are mixed.
NO — Not a fit right now. Pre-launch, research mode only, or clearly not ready to invest and build.

Revenue is NOT a disqualifier. Founders Track serves early-stage owners. Upper tiers serve $10K–$50K+ operators.

DISQUALIFIERS for YES/MAYBE:
- Has not launched yet (no clients, no revenue)
- Explicitly in research mode, not ready to act
- Reason is "still researching" AND no urgency signals elsewhere

APPLICATION DATA:
Name: ${data.name}
Business: ${data.business}
Revenue last month: ${data.revenue}
Years in business: ${data.years}
Current setup: ${data.setup}
Biggest problem: ${data.problem}
What they've tried: ${data.tried}
Reason for applying: ${data.reason}
12-month goal: ${data.goal}

Respond with ONLY the single word: YES, MAYBE, or NO.`;

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 10,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].text.trim().toUpperCase();
  if (raw.includes('YES')) return 'yes';
  if (raw.includes('NO')) return 'no';
  return 'maybe';
}

async function sendEmails(data, outcome) {
  const outcomeLabels = { yes: 'CONFIRMED', maybe: 'REVIEW NEEDED', no: 'NOT A FIT' };
  const label = outcomeLabels[outcome] || 'REVIEW NEEDED';

  // Notification to Cecilia
  await transporter.sendMail({
    from: `"Clean AIOS Applications" <${process.env.EMAIL_USER}>`,
    to: process.env.NOTIFY_EMAIL,
    subject: `[${label}] New application — ${data.name}, ${data.business}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; color: #111;">
        <h2 style="font-size: 20px; margin-bottom: 4px;">New Application — ${label}</h2>
        <p style="color: #888; font-size: 13px; margin-bottom: 24px;">Scored by Claude Haiku</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          ${[
            ['Name', data.name],
            ['Email', data.email],
            ['Business', data.business],
            ['Revenue', data.revenue],
            ['Years in business', data.years],
            ['Setup', data.setup],
            ['Reason for applying', data.reason],
          ].map(([k, v]) => `
            <tr>
              <td style="padding: 8px 12px; background: #f5f5f5; font-weight: 600; width: 40%; border: 1px solid #e0e0e0;">${k}</td>
              <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">${v || '—'}</td>
            </tr>`).join('')}
        </table>
        <div style="margin-top: 20px; padding: 16px; background: #f5f5f5; border-left: 3px solid #75D3DF;">
          <strong>Biggest problem:</strong><br>${data.problem || '—'}
        </div>
        <div style="margin-top: 12px; padding: 16px; background: #f5f5f5;">
          <strong>What they've tried:</strong><br>${data.tried || '—'}
        </div>
        <div style="margin-top: 12px; padding: 16px; background: #f5f5f5;">
          <strong>12-month goal:</strong><br>${data.goal || '—'}
        </div>
      </div>`,
  });

  // Applicant email
  if (outcome === 'yes') {
    await transporter.sendMail({
      from: `"Cecilia at Clean AIOS" <${process.env.EMAIL_USER}>`,
      to: data.email,
      subject: `You're confirmed — next step inside`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; color: #111; line-height: 1.7;">
          <p>Hi ${data.name.split(' ')[0]},</p>
          <p>Your application came through and you're a fit. I'm looking forward to the conversation.</p>
          <p>Book your discovery call using the link below — it's 20 minutes, no pitch, just a real conversation about where you are and where you want to go.</p>
          <p style="margin: 28px 0;">
            <a href="https://calendly.com/cleanaios" style="background: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 600;">Book your discovery call →</a>
          </p>
          <p>If you have any questions before then, reply to this email.</p>
          <p style="margin-top: 32px;">— Cecilia<br><span style="color: #888; font-size: 13px;">Clean AIOS · cleanaios.com</span></p>
        </div>`,
    });
  } else if (outcome === 'maybe') {
    await transporter.sendMail({
      from: `"Cecilia at Clean AIOS" <${process.env.EMAIL_USER}>`,
      to: data.email,
      subject: `Application received — ${data.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; color: #111; line-height: 1.7;">
          <p>Hi ${data.name.split(' ')[0]},</p>
          <p>Your application came through. I'll take a personal look and be in touch within 24 hours.</p>
          <p>No action needed on your end.</p>
          <p style="margin-top: 32px;">— Cecilia<br><span style="color: #888; font-size: 13px;">Clean AIOS · cleanaios.com</span></p>
        </div>`,
    });
  } else {
    await transporter.sendMail({
      from: `"Cecilia at Clean AIOS" <${process.env.EMAIL_USER}>`,
      to: data.email,
      subject: `Thanks for applying — a note from Cecilia`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; color: #111; line-height: 1.7;">
          <p>Hi ${data.name.split(' ')[0]},</p>
          <p>Thanks for taking the time to apply. Based on where you are right now, I don't think the live programs are the right fit yet — and I'd rather be straight with you than put you in something that doesn't serve you well.</p>
          <p>The DIY Toolkit has everything you need to start building on your own: the Margin Stabilization Plugin, three core SOP templates, the AI Hybrid Model Map, and a step-by-step implementation guide. It's designed for exactly the stage you're in.</p>
          <p style="margin: 28px 0;">
            <a href="https://gumroad.com/cleanaios" style="background: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 600;">Explore the DIY Toolkit →</a>
          </p>
          <p>When the timing is right, apply again — I'd genuinely love to work with you.</p>
          <p style="margin-top: 32px;">— Cecilia<br><span style="color: #888; font-size: 13px;">Clean AIOS · cleanaios.com</span></p>
        </div>`,
    });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const data = req.body;

  // Basic validation
  if (!data.name || !data.email || !data.business) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let outcome = 'maybe';

  try {
    outcome = await scoreApplication(data);
  } catch (err) {
    console.error('Scoring error:', err);
    outcome = 'maybe';
  }

  try {
    await sendEmails(data, outcome);
  } catch (err) {
    console.error('Email error:', err);
    // Don't fail the response if email fails — outcome still returned
  }

  return res.status(200).json({ outcome });
}
