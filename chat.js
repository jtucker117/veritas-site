/* ============================================================
   Veritas AI intake chat widget (front-end)
   Talks to /api/chat (Claude) and /api/lead (email summary).
   Supports inline photo uploads (up to 4 per conversation).
   ============================================================ */
(function () {
  // API base: same origin in production (Railway). For the Perplexity
  // preview, __PORT_3000__ is swapped in; locally falls back to localhost.
  var API = (function () {
    var p = '__PORT_3000__';
    if (p.indexOf('__') === 0) return ''; // same-origin (Railway/local server.js on same port)
    return p;
  })();

  var launcher = document.getElementById('chatLauncher');
  var panel = document.getElementById('chatPanel');
  var thread = document.getElementById('chatThread');
  var input = document.getElementById('chatInput');
  var sendBtn = document.getElementById('chatSend');
  var inputBar = sendBtn && sendBtn.parentNode;
  if (!launcher || !panel || !inputBar) return;

  var history = [];            // [{role, content}] for the API
  var allPhotos = [];          // every photo uploaded this conversation
  var pendingPhotos = [];      // photos staged for the next outgoing message
  var leadSummary = null;      // last structured summary from /api/chat
  var greeted = false;
  var leadSent = false;
  var busy = false;
  var MAX_PHOTOS = 4;          // session cap; sized for Claude vision budget

  var GREETING = "Hi! I'm the Veritas project assistant. Tell me a bit about what you're looking to build or renovate and I'll get the right details to our team. What kind of project do you have in mind? Feel free to attach photos too — the paperclip is below.";

  // ---------- Photo upload UI ----------
  // Injected via JS so we don't need to touch both HTML pages.
  var fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/jpeg,image/png,image/webp,image/heic';
  fileInput.multiple = true;
  fileInput.style.display = 'none';
  inputBar.parentNode.insertBefore(fileInput, inputBar.nextSibling);

  var attachBtn = document.createElement('button');
  attachBtn.type = 'button';
  attachBtn.setAttribute('aria-label', 'Attach photo');
  attachBtn.className = 'chat-attach';
  attachBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
  inputBar.insertBefore(attachBtn, sendBtn);

  // Thumbnail strip shown above the input bar when photos are staged.
  var preview = document.createElement('div');
  preview.className = 'chat-photo-preview';
  preview.style.display = 'none';
  inputBar.parentNode.insertBefore(preview, inputBar);

  attachBtn.addEventListener('click', function () {
    if (busy) return;
    var room = MAX_PHOTOS - allPhotos.length - pendingPhotos.length;
    if (room <= 0) {
      addBot("You've reached the 4-photo limit for this chat. The team will follow up if more are needed.");
      return;
    }
    fileInput.click();
  });
  fileInput.addEventListener('change', function () {
    var files = Array.from(fileInput.files || []);
    fileInput.value = ''; // reset so the same file can be picked again
    var room = MAX_PHOTOS - allPhotos.length - pendingPhotos.length;
    files.slice(0, room).forEach(function (f) {
      if (!/^image\//.test(f.type)) return;
      var reader = new FileReader();
      reader.onload = function () {
        // dataURL = "data:image/jpeg;base64,...." → split off the prefix.
        var dataUrl = reader.result || '';
        var commaAt = dataUrl.indexOf(',');
        if (commaAt < 0) return;
        var base64 = dataUrl.slice(commaAt + 1);
        var mediaType = (dataUrl.slice(5, commaAt).split(';')[0]) || 'image/jpeg';
        pendingPhotos.push({ base64: base64, mediaType: mediaType, dataUrl: dataUrl });
        renderPreview();
      };
      reader.readAsDataURL(f);
    });
  });

  function renderPreview() {
    preview.innerHTML = '';
    if (pendingPhotos.length === 0) {
      preview.style.display = 'none';
      return;
    }
    preview.style.display = '';
    pendingPhotos.forEach(function (p, idx) {
      var wrap = document.createElement('div');
      wrap.className = 'chat-photo-thumb';
      var img = document.createElement('img');
      img.src = p.dataUrl;
      img.alt = '';
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.setAttribute('aria-label', 'Remove photo');
      rm.textContent = '×';
      rm.addEventListener('click', function () {
        pendingPhotos.splice(idx, 1);
        renderPreview();
      });
      wrap.appendChild(img);
      wrap.appendChild(rm);
      preview.appendChild(wrap);
    });
  }

  // ---------- Chat panel open/close ----------
  function open() {
    panel.classList.add('open');
    launcher.classList.add('open');
    launcher.setAttribute('aria-expanded', 'true');
    if (!greeted) { greeted = true; addBot(GREETING); history.push({ role: 'assistant', content: GREETING }); }
    setTimeout(function () { input && input.focus(); }, 200);
  }
  function close() {
    panel.classList.remove('open');
    launcher.classList.remove('open');
    launcher.setAttribute('aria-expanded', 'false');
  }
  launcher.addEventListener('click', function () {
    panel.classList.contains('open') ? close() : open();
  });

  // ---------- DOM helpers ----------
  function el(cls, text) {
    var d = document.createElement('div');
    d.className = cls;
    if (text != null) d.textContent = text;
    thread.appendChild(d);
    thread.scrollTop = thread.scrollHeight;
    return d;
  }
  function addBot(t) { return el('chat-msg bot', t); }
  function addUser(t, photos) {
    var d = document.createElement('div');
    d.className = 'chat-msg user';
    if (t) {
      var p = document.createElement('div');
      p.textContent = t;
      d.appendChild(p);
    }
    if (photos && photos.length) {
      var strip = document.createElement('div');
      strip.className = 'chat-msg-photos';
      photos.forEach(function (ph) {
        var img = document.createElement('img');
        img.src = ph.dataUrl;
        img.alt = '';
        strip.appendChild(img);
      });
      d.appendChild(strip);
    }
    thread.appendChild(d);
    thread.scrollTop = thread.scrollHeight;
    return d;
  }
  function showTyping() {
    var d = document.createElement('div');
    d.className = 'chat-typing';
    d.innerHTML = '<span></span><span></span><span></span>';
    thread.appendChild(d);
    thread.scrollTop = thread.scrollHeight;
    return d;
  }

  // ---------- Send ----------
  async function send() {
    var text = (input.value || '').trim();
    if (busy) return;
    if (!text && pendingPhotos.length === 0) return;
    input.value = '';
    input.style.height = '44px';

    var outgoingPhotos = pendingPhotos.slice();
    pendingPhotos = [];
    renderPreview();
    if (outgoingPhotos.length) allPhotos = allPhotos.concat(outgoingPhotos);

    addUser(text, outgoingPhotos);
    // Note for the model when the customer attached photos with no caption.
    var historyText = text || (outgoingPhotos.length ? '(attached ' + outgoingPhotos.length + ' photo' + (outgoingPhotos.length > 1 ? 's' : '') + ')' : '');
    history.push({ role: 'user', content: historyText });

    busy = true; sendBtn.disabled = true; attachBtn.disabled = true;
    var typing = showTyping();

    try {
      var payload = { messages: history };
      if (outgoingPhotos.length) {
        payload.photos = outgoingPhotos.map(function (p) {
          return { base64: p.base64, mediaType: p.mediaType };
        });
      }
      var r = await fetch(API + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      var data = await r.json();
      typing.remove();
      var reply = data.reply || "Sorry, I didn't catch that — could you rephrase?";
      addBot(reply);
      history.push({ role: 'assistant', content: reply });

      if (data.leadSummary) leadSummary = data.leadSummary;

      if (data.leadReady && !leadSent) {
        leadSent = true;
        sendLead();
      }
    } catch (e) {
      typing.remove();
      addBot("I'm having trouble connecting. Please email info@veritasgrouptx.com and we'll help right away.");
    } finally {
      busy = false; sendBtn.disabled = false; attachBtn.disabled = false;
      input && input.focus();
    }
  }

  async function sendLead() {
    try {
      await fetch(API + '/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          leadSummary: leadSummary,
          photos: allPhotos.map(function (p) {
            return { base64: p.base64, mediaType: p.mediaType };
          }),
          // Fallbacks for the email subject if leadSummary is missing.
          customerEmail: (leadSummary && leadSummary.customer_email) || '',
          customerName: (leadSummary && leadSummary.customer_name) || '',
          projectType: (leadSummary && leadSummary.project_type) || '',
        }),
      });
    } catch (e) { /* non-blocking */ }
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  input.addEventListener('input', function () {
    input.style.height = '44px';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });
})();
