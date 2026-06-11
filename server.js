/* ============================================================
   Veritas site server — static hosting + AI intake chatbot
   ============================================================
   Environment variables (set these in Railway → Variables):
     ANTHROPIC_API_KEY   your Claude API key
     GMAIL_USER          the Gmail/Workspace address that sends mail (e.g. info@veritasgrouptx.com)
     GMAIL_APP_PASSWORD  a Google "App Password" (NOT your normal password)
     LEAD_TO             where lead summaries are emailed (default: info@veritasgrouptx.com)
   If ANTHROPIC_API_KEY is missing, the chat falls back to a simple
   "email us" message so the site never breaks.
   ============================================================ */
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3000;
const LEAD_TO = process.env.LEAD_TO || 'info@veritasgrouptx.com';
const HAS_AI = !!process.env.ANTHROPIC_API_KEY;
const HAS_EMAIL = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

// Lazy-load SDKs so the server still boots if a dep is missing.
let Anthropic, nodemailer;
try { Anthropic = require('@anthropic-ai/sdk'); } catch (e) { /* optional */ }
try { nodemailer = require('nodemailer'); } catch (e) { /* optional */ }

const anthropic = HAS_AI && Anthropic ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

// ---- System prompt: the Veritas intake assistant ----
const SYSTEM_PROMPT = `You are the virtual project assistant for Veritas Builders, a general contractor based in Magnolia, Texas, serving Greater Houston, Montgomery County, and out to the Dallas and Austin metros (willing to travel for the right project). Veritas is part of Veritas Ventures.

Your job: have a warm, professional, concise conversation with a prospective customer to fully scope their project, then hand a clean summary to the Veritas team. You are NOT able to give binding quotes or prices — make that clear if asked, and say the team will follow up with an estimate.

Collect these, ONE topic at a time (don't interrogate — keep it conversational, 1-2 short questions per message):
1. Project type & scope (e.g. kitchen remodel, new home, commercial build-out, addition, repair) and key details (size, rooms, materials, current condition).
2. Location (city/area in Texas) and desired timeline / start date.
3. Rough budget range (ask gently; if they're unsure, that's fine — note "not specified").
4. Contact info: name, email, and phone so the team can follow up.

Style: friendly, grounded, plain-spoken, like a trustworthy Texas builder. Short messages. One step at a time. Never invent services, prices, awards, or company history. Veritas is a newer, growing company built on integrity and quality.

When you have gathered enough (especially name + email + project type), tell the customer you've got what you need, that the Veritas team will reach out soon, and that you're sending the details over now. Then on its OWN line as the very last line of that final message, output exactly:
[LEAD_READY]
Do not output [LEAD_READY] until you have at least the customer's name, a contact email, and the project type.`;

// ---- POST /api/chat : proxy a turn to Claude ----
app.post('/api/chat', async (req, res) => {
  try {
    const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
    if (!anthropic) {
      // Graceful fallback when no API key is configured.
      return res.json({
        reply: "Thanks for reaching out! Our live assistant isn't connected just yet — please email us at info@veritasgrouptx.com with your project details and we'll get right back to you.",
        leadReady: false,
        fallback: true
      });
    }
    // Try the configured model first, then fall back through known-good IDs.
    var candidates = [
      process.env.ANTHROPIC_MODEL,
      'claude-3-5-sonnet-latest',
      'claude-3-5-sonnet-20241022',
      'claude-3-haiku-20240307'
    ].filter(Boolean);

    var resp, lastErr;
    for (var i = 0; i < candidates.length; i++) {
      try {
        resp = await anthropic.messages.create({
          model: candidates[i],
          max_tokens: 600,
          system: SYSTEM_PROMPT,
          messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 4000) }))
        });
        break; // success
      } catch (e) {
        lastErr = e;
        // Only try the next model on a model-availability error; otherwise stop.
        var msg = (e && e.message) || '';
        if (!/model/i.test(msg) && !/not_found/i.test(msg) && !/404/.test(msg)) throw e;
      }
    }
    if (!resp) throw (lastErr || new Error('no model available'));

    let reply = (resp.content || []).map(c => c.text || '').join('').trim();
    const leadReady = reply.includes('[LEAD_READY]');
    reply = reply.replace('[LEAD_READY]', '').trim();
    res.json({ reply, leadReady });
  } catch (err) {
    console.error('chat error:', err.status, err.message);
    res.status(400).json({
      reply: "Sorry — something went wrong on our end. Please email info@veritasgrouptx.com and we'll help right away.",
      leadReady: false,
      error: true,
      detail: (err && err.message || '').slice(0, 300)
    });
  }
});

// ---- Diagnostic: surfaces the real Anthropic error (safe — no secrets) ----
app.get('/api/diag', async (req, res) => {
  if (!anthropic) return res.json({ ai: false, note: 'ANTHROPIC_API_KEY not set' });
  try {
    var r = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
      max_tokens: 20,
      messages: [{ role: 'user', content: 'Say OK' }]
    });
    res.json({ ok: true, model_used: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest', reply: (r.content || []).map(c => c.text).join('') });
  } catch (e) {
    res.json({ ok: false, status: e.status, error: (e.message || '').slice(0, 400) });
  }
});

// ---- POST /api/lead : email the conversation summary to Veritas ----
app.post('/api/lead', async (req, res) => {
  try {
    const transcript = Array.isArray(req.body.messages) ? req.body.messages : [];
    const summary = req.body.summary || '';

    const lines = transcript
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role === 'user' ? 'Customer' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const body =
`New website lead — Veritas Builders intake chat
Received: ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} (CT)

================= SUMMARY =================
${summary || '(no structured summary captured)'}

================ FULL CHAT ================
${lines}

— Sent automatically by the veritasgrouptx.com assistant`;

    if (!HAS_EMAIL || !nodemailer) {
      console.log('LEAD (email not configured):\n', body);
      return res.json({ ok: true, emailed: false });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    });
    await transporter.sendMail({
      from: `"Veritas Website" <${process.env.GMAIL_USER}>`,
      to: LEAD_TO,
      replyTo: req.body.customerEmail || undefined,
      subject: `New lead: ${req.body.customerName || 'Website visitor'}${req.body.projectType ? ' — ' + req.body.projectType : ''}`,
      text: body
    });
    res.json({ ok: true, emailed: true });
  } catch (err) {
    console.error('lead error:', err.message);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ---- Health / config check ----
app.get('/api/health', (req, res) => res.json({ ok: true, ai: HAS_AI, email: HAS_EMAIL }));

// ---- Static site ----
app.use(express.static(__dirname, { extensions: ['html'] }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Veritas site on ${PORT} | AI: ${HAS_AI ? 'on' : 'off'} | Email: ${HAS_EMAIL ? 'on' : 'off'}`);
});
