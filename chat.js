/* ============================================================
   Veritas AI intake chat widget (front-end)
   Talks to /api/chat (Claude) and /api/lead (email summary).
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
  if (!launcher || !panel) return;

  var history = [];        // {role, content} for the API
  var greeted = false;
  var leadSent = false;
  var busy = false;

  var GREETING = "Hi! I'm the Veritas project assistant. Tell me a bit about what you're looking to build or renovate and I'll get the right details to our team. What kind of project do you have in mind?";

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

  function el(cls, text) {
    var d = document.createElement('div');
    d.className = cls;
    if (text != null) d.textContent = text;
    thread.appendChild(d);
    thread.scrollTop = thread.scrollHeight;
    return d;
  }
  function addBot(t) { return el('chat-msg bot', t); }
  function addUser(t) { return el('chat-msg user', t); }
  function showTyping() {
    var d = document.createElement('div');
    d.className = 'chat-typing';
    d.innerHTML = '<span></span><span></span><span></span>';
    thread.appendChild(d);
    thread.scrollTop = thread.scrollHeight;
    return d;
  }

  async function send() {
    var text = (input.value || '').trim();
    if (!text || busy) return;
    input.value = '';
    input.style.height = '44px';
    addUser(text);
    history.push({ role: 'user', content: text });
    busy = true; sendBtn.disabled = true;
    var typing = showTyping();

    try {
      var r = await fetch(API + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history })
      });
      var data = await r.json();
      typing.remove();
      var reply = data.reply || "Sorry, I didn't catch that — could you rephrase?";
      addBot(reply);
      history.push({ role: 'assistant', content: reply });

      if (data.leadReady && !leadSent) {
        leadSent = true;
        sendLead();
      }
    } catch (e) {
      typing.remove();
      addBot("I'm having trouble connecting. Please email info@veritasgrouptx.com and we'll help right away.");
    } finally {
      busy = false; sendBtn.disabled = false;
      input && input.focus();
    }
  }

  async function sendLead() {
    // Pull a quick contact guess from the transcript for the email subject.
    var joined = history.map(function (m) { return m.content; }).join(' ');
    var email = (joined.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0] || '';
    try {
      await fetch(API + '/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          customerEmail: email,
          summary: 'See full chat below.'
        })
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
