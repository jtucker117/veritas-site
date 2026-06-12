/* ============================================================
   Veritas site server — static hosting + AI intake chatbot
   ============================================================
   Environment variables (set these in Railway → Variables):
     ANTHROPIC_API_KEY     your Claude API key
     ANTHROPIC_MODEL       optional model override (default: claude-haiku-4-5)
     GMAIL_USER            the Gmail/Workspace address that sends mail (e.g. info@veritasgrouptx.com)
     GMAIL_APP_PASSWORD    a Google "App Password" (NOT your normal password)
     LEAD_TO               where lead summaries are emailed (default: info@veritasgrouptx.com)
     BUILDERS_APP_URL      base URL of the Veritas Builders ops app (e.g. https://app.veritasgrouptx.com)
     WEBSITE_INTAKE_TOKEN  shared secret matching the same env var on the app — leads are POSTed there for tracking
   If ANTHROPIC_API_KEY is missing, the chat falls back to a simple
   "email us" message so the site never breaks.
   If BUILDERS_APP_URL + WEBSITE_INTAKE_TOKEN are unset, leads still email
   but aren't forwarded to the ops app.
   ============================================================ */
const express = require('express');
const path = require('path');

const app = express();
// Bumped to 10mb so the chat can carry a few base64 photos in one request.
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;
const LEAD_TO = process.env.LEAD_TO || 'info@veritasgrouptx.com';
const HAS_AI = !!process.env.ANTHROPIC_API_KEY;
const HAS_EMAIL = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
// Haiku 4.5 is the right tier for intake chat: fast, cheap, supports vision
// and tool use. Override via ANTHROPIC_MODEL if a project ever needs more.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

// Lazy-load SDKs so the server still boots if a dep is missing.
let Anthropic, nodemailer;
try { Anthropic = require('@anthropic-ai/sdk'); } catch (e) { /* optional */ }
try { nodemailer = require('nodemailer'); } catch (e) { /* optional */ }

const anthropic = HAS_AI && Anthropic ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

// ---- System prompt: the Veritas intake assistant ----
const SYSTEM_PROMPT = `You are the virtual project assistant for Veritas Builders, a general contractor based in Magnolia, Texas. Veritas serves Greater Houston and Montgomery County as its core service area, will travel to the Dallas and Austin metros for the right project, and considers other Texas locations case-by-case. Veritas is part of Veritas Ventures Group.

YOUR JOB
Have a warm, professional, concise conversation with a prospective customer to fully scope their project, then hand a clean structured summary to the Veritas team via the submit_lead tool. You CANNOT give binding quotes or prices — if asked, say the team will follow up with an estimate after they've seen the details.

CONVERSATION STYLE
Friendly, grounded, plain-spoken — like a trustworthy Texas builder. Short messages. One topic at a time, 1-2 short questions per turn. Never interrogate. Never invent services, prices, awards, or company history. Veritas is a newer, growing company built on integrity and quality.

INFO TO COLLECT (one topic at a time, don't dump a list on them):
1. Project type & scope — kitchen remodel, addition, new build, repair, commercial build-out, etc., plus key specifics (rooms, square footage, materials, current condition).
2. Location — city/area in Texas.
3. Timeline — desired start date or rough window.
4. Budget — gently. If they're unsure, that's fine; note "not specified".
5. Contact info — name, email, phone.

IF THE CUSTOMER SHARES PHOTOS
Acknowledge what you see in plain terms ("Looks like an older galley kitchen with original cabinets — got it"). Use the photos to inform the questions you ask. Do NOT speculate on costs from photos. Do NOT pretend to see things that aren't there.

OFF-TOPIC QUESTIONS
- Careers / hiring: "We're not actively posting, but you can email info@veritasgrouptx.com with a resume."
- Office hours / phone: "The team checks messages each business day and we'll follow up within one business day."
- Hard pricing / "ballpark this": Politely decline — the team gives quotes after they understand scope.

WHEN TO HAND OFF
When you have at minimum: customer name, contact email, and project type. CALL THE submit_lead TOOL with structured fields. In the SAME response, also write a short, warm closing message confirming you've got what you need and that the Veritas team will reach out within one business day. Only call submit_lead once per conversation.

SERVICE AREA CLASSIFICATION (for the submit_lead service_area field):
- in_area: Greater Houston, Magnolia, The Woodlands, Conroe, Tomball, Cypress, Spring, Katy, Sugar Land, Pearland, anywhere in Montgomery County, or anywhere within ~60 miles of Magnolia, TX.
- travel_required: Dallas metro, Fort Worth metro, Austin metro, San Antonio metro, College Station / Bryan, Waco, other major Texas cities.
- out_of_area: Anywhere outside Texas, or somewhere you can't confidently classify as the first two. Also use this if the customer hasn't told you the location yet AND you're submitting the lead anyway (rare — usually you should ask first).`;

// Tool the model calls when it's ready to hand off the lead. Forces a
// clean, structured shape every time instead of trying to parse free text.
const SUBMIT_LEAD_TOOL = {
  name: 'submit_lead',
  description: "Submit the finished lead to the Veritas team. Call this once you have at minimum the customer's name, contact email, and project type. Include the most complete information you have for each field; use 'not specified' for any optional field the customer didn't share. After calling this tool, your final response message should be a short warm closing confirming the team will reach out within one business day.",
  input_schema: {
    type: 'object',
    properties: {
      customer_name: { type: 'string', description: 'Full name as given by the customer.' },
      customer_email: { type: 'string', description: 'Email address. Required.' },
      customer_phone: { type: 'string', description: "Phone number, or 'not specified'." },
      project_type: { type: 'string', description: "Short label: 'kitchen remodel', 'addition', 'new build', 'roof repair', 'commercial build-out', etc." },
      project_summary: { type: 'string', description: '1-3 sentences capturing the scope, condition, materials, and any specific details the customer shared.' },
      location: { type: 'string', description: "City/area in Texas, or 'not specified'." },
      timeline: { type: 'string', description: "Desired start date or window, or 'not specified'." },
      budget: { type: 'string', description: "Stated budget range, or 'not specified'." },
      service_area: {
        type: 'string',
        enum: ['in_area', 'travel_required', 'out_of_area'],
        description: 'Classify per the SERVICE AREA CLASSIFICATION rules in the system prompt.',
      },
      photo_count: { type: 'integer', description: 'How many photos the customer shared during the conversation.' },
    },
    required: ['customer_name', 'customer_email', 'project_type', 'project_summary', 'service_area'],
  },
};

// Map a thrown SDK error to a short, user-safe message + log detail.
function chatErrorPayload(err) {
  const detail = (err && err.message || '').slice(0, 300);
  if (Anthropic) {
    if (err instanceof Anthropic.RateLimitError) {
      return { reply: "Lots of folks are reaching out right now. Please email info@veritasgrouptx.com and we'll get right back to you.", detail };
    }
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      return { reply: "Our chat isn't reachable at the moment. Please email info@veritasgrouptx.com and we'll help right away.", detail };
    }
    if (err instanceof Anthropic.OverloadedError) {
      return { reply: "Briefly overloaded — try again in a moment, or email info@veritasgrouptx.com.", detail };
    }
  }
  return { reply: "Sorry — something went wrong on our end. Please email info@veritasgrouptx.com and we'll help right away.", detail };
}

// Build the user-turn content from a plain message plus any attached
// photos. Photos are sent as base64 image blocks; Claude Haiku 4.5
// supports vision natively.
function buildUserContent(text, photos) {
  const blocks = [];
  if (text && text.length > 0) {
    blocks.push({ type: 'text', text });
  }
  if (Array.isArray(photos)) {
    for (const p of photos.slice(0, 4)) {
      if (!p || !p.base64 || !p.mediaType) continue;
      blocks.push({
        type: 'image',
        source: { type: 'base64', media_type: p.mediaType, data: p.base64 },
      });
    }
  }
  return blocks.length === 1 && blocks[0].type === 'text' ? blocks[0].text : blocks;
}

// ---- POST /api/chat : proxy a turn to Claude ----
app.post('/api/chat', async (req, res) => {
  try {
    const incoming = Array.isArray(req.body.messages) ? req.body.messages : [];
    const newPhotos = Array.isArray(req.body.photos) ? req.body.photos : [];

    if (!anthropic) {
      // Graceful fallback when no API key is configured.
      return res.json({
        reply: "Thanks for reaching out! Our live assistant isn't connected just yet — please email us at info@veritasgrouptx.com with your project details and we'll get right back to you.",
        leadReady: false,
        fallback: true,
      });
    }

    // Normalize the history; photos on the most recent user turn are
    // attached as image blocks, prior turns stay as plain text. (The
    // client only sends photos on the turn they were uploaded.)
    const messages = incoming.map((m, i) => {
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      const text = String(m.content || '').slice(0, 4000);
      if (role === 'user' && i === incoming.length - 1 && newPhotos.length > 0) {
        return { role, content: buildUserContent(text, newPhotos) };
      }
      return { role, content: text };
    });

    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      tools: [SUBMIT_LEAD_TOOL],
      messages,
    });

    // The response can carry text blocks AND a tool_use block. Combine
    // any text into one reply, and surface tool input as leadSummary.
    let reply = '';
    let leadSummary = null;
    for (const block of (resp.content || [])) {
      if (block.type === 'text' && block.text) reply += block.text;
      if (block.type === 'tool_use' && block.name === 'submit_lead') {
        leadSummary = block.input;
      }
    }
    reply = reply.trim();
    if (!reply && leadSummary) {
      // Defensive: model called the tool without a closing message.
      reply = "Got it — I have what I need. The Veritas team will reach out within one business day. Thanks for sharing the details!";
    }

    return res.json({
      reply,
      leadReady: !!leadSummary,
      leadSummary,
    });
  } catch (err) {
    console.error('chat error:', err && err.status, err && err.message);
    const { reply, detail } = chatErrorPayload(err);
    return res.status(400).json({ reply, leadReady: false, error: true, detail });
  }
});

// ---- POST /api/lead : email the conversation + structured summary ----
app.post('/api/lead', async (req, res) => {
  try {
    const transcript = Array.isArray(req.body.messages) ? req.body.messages : [];
    const summary = req.body.leadSummary || null;
    const photos = Array.isArray(req.body.photos) ? req.body.photos : [];

    const lines = transcript
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role === 'user' ? 'Customer' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const summarySection = summary
      ? [
          `Name:     ${summary.customer_name || 'not specified'}`,
          `Email:    ${summary.customer_email || 'not specified'}`,
          `Phone:    ${summary.customer_phone || 'not specified'}`,
          `Project:  ${summary.project_type || 'not specified'}`,
          `Scope:    ${summary.project_summary || 'not specified'}`,
          `Location: ${summary.location || 'not specified'}`,
          `Timeline: ${summary.timeline || 'not specified'}`,
          `Budget:   ${summary.budget || 'not specified'}`,
          `Area:     ${summary.service_area || 'unknown'}`,
          `Photos:   ${summary.photo_count != null ? summary.photo_count : photos.length}`,
        ].join('\n')
      : '(no structured summary captured)';

    const body =
`New website lead — Veritas Builders intake chat
Received: ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} (CT)

================= SUMMARY =================
${summarySection}

================ FULL CHAT ================
${lines}

— Sent automatically by the veritasgrouptx.com assistant`;

    if (!HAS_EMAIL || !nodemailer) {
      console.log('LEAD (email not configured):\n', body);
      return res.json({ ok: true, emailed: false });
    }

    // Service-area prefix so the team can triage at a glance.
    const areaPrefix = summary && summary.service_area === 'out_of_area' ? '[OUT OF AREA] '
      : summary && summary.service_area === 'travel_required' ? '[TRAVEL] '
      : '';
    const namePart = (summary && summary.customer_name) || req.body.customerName || 'Website visitor';
    const projectPart = (summary && summary.project_type) || req.body.projectType;
    const subject = `${areaPrefix}New lead: ${namePart}${projectPart ? ' — ' + projectPart : ''}`;

    const customerEmail = (summary && summary.customer_email) || req.body.customerEmail || null;

    // Attach photos so the team sees what the customer shared.
    const attachments = [];
    photos.slice(0, 4).forEach((p, i) => {
      if (!p || !p.base64 || !p.mediaType) return;
      const ext = p.mediaType.split('/')[1] || 'jpg';
      attachments.push({
        filename: `project-photo-${i + 1}.${ext}`,
        content: Buffer.from(p.base64, 'base64'),
        contentType: p.mediaType,
      });
    });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

    // 1. Team notification.
    await transporter.sendMail({
      from: `"Veritas Website" <${process.env.GMAIL_USER}>`,
      to: LEAD_TO,
      replyTo: customerEmail || undefined,
      subject,
      text: body,
      attachments,
    });

    // 2. Customer confirmation (best-effort — never blocks the lead path).
    let customerEmailed = false;
    if (customerEmail) {
      try {
        const firstName = (namePart || '').split(/\s+/)[0] || 'there';
        await transporter.sendMail({
          from: `"Veritas Builders" <${process.env.GMAIL_USER}>`,
          to: customerEmail,
          replyTo: LEAD_TO,
          subject: 'Thanks for reaching out — Veritas Builders',
          text:
`Hi ${firstName},

Thanks for sharing your project details with us. Someone from the Veritas Builders team will reach out within one business day to talk through next steps.

If you have anything to add in the meantime, just reply to this email.

— Veritas Builders
Magnolia, TX | info@veritasgrouptx.com`,
        });
        customerEmailed = true;
      } catch (e) {
        console.warn('customer confirmation email failed:', e && e.message);
      }
    }

    // Forward to the Builders ops app for lead tracking. Best-effort and
    // fire-and-forget: a slow or down app must NEVER delay the response to
    // the customer, and any failure here is logged but doesn't surface as
    // an error on the lead email path.
    let forwardedToApp = false;
    if (summary && process.env.BUILDERS_APP_URL && process.env.WEBSITE_INTAKE_TOKEN) {
      forwardLeadToApp(summary, photos).then(ok => {
        if (ok) console.log('lead forwarded to app:', summary.customer_email);
      }).catch(e => console.warn('lead forward failed:', e && e.message));
      forwardedToApp = true;
    }

    return res.json({ ok: true, emailed: true, customerEmailed, forwardedToApp });
  } catch (err) {
    console.error('lead error:', err && err.message);
    return res.status(400).json({ ok: false, error: err && err.message });
  }
});

// Forward a finished lead to the Veritas Builders ops app so it lands in the
// Leads inbox alongside leads created in the app itself. Returns true when the
// app accepted the lead; logs and swallows any error so the website /api/lead
// response is never blocked or coloured by the forwarding step.
async function forwardLeadToApp(summary, photos) {
  const base = (process.env.BUILDERS_APP_URL || '').replace(/\/+$/, '');
  const token = process.env.WEBSITE_INTAKE_TOKEN;
  if (!base || !token) return false;
  try {
    const r = await fetch(base + '/api/intake/website-lead', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-intake-token': token,
      },
      body: JSON.stringify({ lead: summary, photos: Array.isArray(photos) ? photos : [] }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.warn('lead forward non-2xx:', r.status, detail.slice(0, 200));
      return false;
    }
    return true;
  } catch (e) {
    console.warn('lead forward error:', e && e.message);
    return false;
  }
}

// ---- Health / config check ----
app.get('/api/health', (req, res) => res.json({ ok: true, ai: HAS_AI, email: HAS_EMAIL, model: MODEL }));

// ---- Static site ----
app.use(express.static(__dirname, { extensions: ['html'] }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Veritas site on ${PORT} | AI: ${HAS_AI ? 'on' : 'off'} | Email: ${HAS_EMAIL ? 'on' : 'off'} | Model: ${MODEL}`);
});
