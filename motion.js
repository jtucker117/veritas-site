/* ============================================================
   motion.js — 2026 redesign interaction layer
   ============================================================
   Zero dependencies. Everything here is progressive enhancement:
   if this file fails to load the page is still complete and usable.

   Contents
     1. Reduced-motion / touch guard
     2. Sliding pill nav + magnetic buttons
     3. Scroll reveals (incl. staggered groups)
     4. Animated stat counters
     5. Hero cursor parallax
     6. Custom cursor
     7. Project rail arrows
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 1. Guards ------------------------------------ */
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;

  function onFrame(fn) {
    var queued = false, lastArgs;
    return function () {
      lastArgs = arguments;
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        fn.apply(null, lastArgs);
      });
    };
  }

  /* ---------- 2. Sliding pill nav -------------------------- */
  /* One absolutely-positioned pill slides behind whichever nav link is
     hovered, falling back to the link matching the current section. */
  (function () {
    var rail = document.querySelector('[data-pill]');
    if (!rail) return;

    var pill = document.createElement('span');
    pill.className = 'nav-pill';
    rail.appendChild(pill);

    var links = Array.prototype.slice.call(rail.querySelectorAll('a'));
    var active = null;

    function moveTo(el, show) {
      if (!el) { pill.classList.remove('show'); return; }
      // offsetLeft is relative to .nav-links because it is position:relative.
      pill.style.width = el.offsetWidth + 'px';
      pill.style.transform = 'translateX(' + el.offsetLeft + 'px)';
      if (show !== false) pill.classList.add('show');
    }

    links.forEach(function (a) {
      a.addEventListener('mouseenter', function () { moveTo(a); });
    });
    rail.addEventListener('mouseleave', function () { moveTo(active); });

    /* Which in-page section are we looking at? That link becomes the
       resting position for the pill.

       The nav is identical on every page, so anchors are written
       root-relative ("/#work") rather than bare ("#work") — that way one
       markup works from the home page, a service page, and /blog/ alike.
       A link counts as same-document when it has no path, or its path is
       the page we are already on. */
    function sameDocHash(a) {
      var href = a.getAttribute('href') || '';
      var i = href.indexOf('#');
      if (i < 0) return null;
      var path = href.slice(0, i);
      var here = location.pathname;
      var atRoot = here === '/' || here === '/index.html';
      if (path === '' || path === here || (path === '/' && atRoot)) {
        return href.slice(i);            // "#work"
      }
      return null;
    }

    /* Pair each link with its section. Building pairs (rather than two
       lists filtered separately) matters: a link whose target is missing
       used to shorten the section list while leaving the link list intact,
       so every later index pointed at the wrong link. */
    var pairs = [];
    links.forEach(function (a) {
      var hash = sameDocHash(a);
      if (!hash || hash.length < 2) return;
      var sec = document.querySelector(hash);
      if (sec) pairs.push({ link: a, section: sec });
    });

    function syncActive() {
      var best = null, bestTop = -Infinity;
      var probe = window.innerHeight * 0.35;
      pairs.forEach(function (p) {
        var top = p.section.getBoundingClientRect().top;
        if (top <= probe && top > bestTop) { bestTop = top; best = p.link; }
      });
      if (best !== active) {
        links.forEach(function (a) { a.classList.remove('is-active'); });
        if (best) best.classList.add('is-active');
        active = best;
        moveTo(active);
      }
    }

    if (pairs.length) {
      window.addEventListener('scroll', onFrame(syncActive), { passive: true });
      syncActive();
    }
    window.addEventListener('resize', onFrame(function () { moveTo(active); }));
  })();

  /* ---------- 2b. Magnetic buttons -------------------------- */
  /* Elements marked [data-magnetic] lean a few pixels toward the cursor.
     Desktop only — on touch this would just cause jitter. */
  if (finePointer && !reduced) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-magnetic]'), function (el) {
      var strength = 0.28, max = 10;

      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) * strength;
        var dy = (e.clientY - (r.top + r.height / 2)) * strength;
        dx = Math.max(-max, Math.min(max, dx));
        dy = Math.max(-max, Math.min(max, dy));
        el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      });

      el.addEventListener('mouseleave', function () {
        el.style.transition = 'transform 0.4s cubic-bezier(0.16,1,0.3,1)';
        el.style.transform = '';
        setTimeout(function () { el.style.transition = ''; }, 400);
      });
    });
  }

  /* ---------- 3. Scroll reveals ----------------------------- */
  /* .reveal / .reveal-up fade+rise once. .reveal-group staggers its
     children using the --i index set in the markup.
     main.js already handles plain .reveal; this adds the group variant
     and the no-IntersectionObserver fallback for both. */
  (function () {
    var groups = document.querySelectorAll('.reveal-group, .reveal-up');
    if (!groups.length) return;

    if (!('IntersectionObserver' in window) || reduced) {
      Array.prototype.forEach.call(groups, function (el) { el.classList.add('in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });

    Array.prototype.forEach.call(groups, function (el) { io.observe(el); });
  })();

  /* ---------- 4. Stat counters ------------------------------ */
  /* [data-count-to] animates 0 → target once, when scrolled into view. */
  (function () {
    var nums = document.querySelectorAll('[data-count-to]');
    if (!nums.length) return;

    function paint(el, value) {
      el.textContent = value + (el.getAttribute('data-count-suffix') || '');
    }

    function run(el) {
      var target = parseFloat(el.getAttribute('data-count-to')) || 0;
      if (reduced) { paint(el, target); return; }

      var duration = 1400, start = null;
      function step(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        // easeOutExpo — fast out of the gate, settles on the number
        var eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        paint(el, Math.round(target * eased));
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(nums, function (el) {
        paint(el, parseFloat(el.getAttribute('data-count-to')) || 0);
      });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        run(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.5 });

    Array.prototype.forEach.call(nums, function (el) { io.observe(el); });
  })();

  /* ---------- 5. Hero cursor parallax ----------------------- */
  /* The hero photo drifts a little against the pointer. The image is
     pre-scaled 1.06 in CSS so the drift never exposes an edge. */
  if (finePointer && !reduced) {
    (function () {
      var frames = document.querySelectorAll('[data-parallax]');
      if (!frames.length) return;

      var targetX = 0, targetY = 0, curX = 0, curY = 0, running = false;
      var MAX = 10; // px of travel — must stay within the CSS overscan

      /* The overscan lives in CSS as --parallax-scale so the stylesheet stays
         the single source of truth. Hard-coding it here once made the image
         visibly pop on first mouse move when the two values drifted apart. */
      function scaleOf(img) {
        var v = getComputedStyle(img).getPropertyValue('--parallax-scale').trim();
        return v || '1.04';
      }

      function loop() {
        // Ease toward the target so the motion has weight rather than
        // snapping 1:1 with the mouse.
        curX += (targetX - curX) * 0.08;
        curY += (targetY - curY) * 0.08;

        Array.prototype.forEach.call(frames, function (f) {
          var img = f.querySelector('img');
          if (img) {
            img.style.transform =
              'scale(' + scaleOf(img) + ') translate(' + curX + 'px,' + curY + 'px)';
          }
        });

        if (Math.abs(targetX - curX) > 0.1 || Math.abs(targetY - curY) > 0.1) {
          requestAnimationFrame(loop);
        } else {
          running = false;
        }
      }

      window.addEventListener('mousemove', function (e) {
        var nx = (e.clientX / window.innerWidth) - 0.5;
        var ny = (e.clientY / window.innerHeight) - 0.5;
        // Negative so the photo moves *against* the cursor.
        targetX = -nx * MAX * 2;
        targetY = -ny * MAX;
        if (!running) { running = true; requestAnimationFrame(loop); }
      }, { passive: true });
    })();
  }

  /* ---------- 6. Custom cursor ------------------------------ */
  /* A dot that tracks exactly plus a ring that lags behind and swells
     over anything clickable. Mouse-only, and never for reduced-motion. */
  if (finePointer && !reduced) {
    (function () {
      var dot = document.createElement('div');
      var ring = document.createElement('div');
      dot.className = 'cursor-dot';
      ring.className = 'cursor-ring';
      dot.setAttribute('aria-hidden', 'true');
      ring.setAttribute('aria-hidden', 'true');
      document.body.appendChild(dot);
      document.body.appendChild(ring);
      document.documentElement.classList.add('has-cursor');

      var mx = -100, my = -100, rx = -100, ry = -100;

      window.addEventListener('mousemove', function (e) {
        mx = e.clientX; my = e.clientY;
      }, { passive: true });

      (function loop() {
        // Dot is 1:1; the ring trails at 18% per frame for the lag.
        dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0) translate(-50%,-50%)';
        rx += (mx - rx) * 0.18;
        ry += (my - ry) * 0.18;
        ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0) translate(-50%,-50%)';
        requestAnimationFrame(loop);
      })();

      // Swell over interactive targets.
      var hoverSel = 'a, button, summary, [role="button"], input, textarea, .rail-item';
      document.addEventListener('mouseover', function (e) {
        if (e.target.closest && e.target.closest(hoverSel)) ring.classList.add('is-hover');
      });
      document.addEventListener('mouseout', function (e) {
        if (e.target.closest && e.target.closest(hoverSel)) ring.classList.remove('is-hover');
      });
      document.addEventListener('mousedown', function () { ring.classList.add('is-down'); });
      document.addEventListener('mouseup', function () { ring.classList.remove('is-down'); });

      // Hide when the pointer leaves the window entirely.
      document.addEventListener('mouseleave', function () {
        dot.style.opacity = '0'; ring.style.opacity = '0';
      });
      document.addEventListener('mouseenter', function () {
        dot.style.opacity = ''; ring.style.opacity = '';
      });
    })();
  }

  /* ---------- 7. Wordmark on the roofline -------------------- */
  /* Rests the hero wordmark just above the building's roofline so it
     reads as sitting ON the roof.

     object-fit:cover crops differently at every viewport aspect ratio,
     so the roofline is NOT at a fixed percentage of the hero — a hard
     coded offset only lines up at one window size. This resolves where
     the roofline actually falls for the current box and lifts the
     wordmark to meet it. CSS carries a static fallback for no-JS.

     (An earlier version masked the text at the roofline to fake the
     wordmark passing behind the building. Dropped: the parallax moves
     the image while a CSS mask stays put, so the cut slid off the roof
     edge as the cursor moved. Resting above it is stable — a gap that
     varies by a few pixels reads as nothing at all.) */
  (function () {
    var main  = document.querySelector('.cine-title-main');
    var title = document.querySelector('.cine-title');
    var img   = document.querySelector('.hero-cine-media img[data-occlude-at]');
    if (!main || !title || !img) return;

    var fraction = parseFloat(img.getAttribute('data-occlude-at'));
    if (!(fraction > 0 && fraction < 1)) return;

    /* Gap in px between the bottom of the wordmark and the roofline. Big
       enough that the parallax drift never closes it, small enough that the
       wordmark still reads as sitting on the roof. */
    var GAP = 10;

    function place() {
      // Below the mobile breakpoint the photo crops to a narrow vertical
      // slice and the layout changes; leave the CSS lift alone there.
      if (window.matchMedia('(max-width: 860px)').matches) {
        title.style.removeProperty('--title-lift');
        return;
      }

      var nw = img.naturalWidth, nh = img.naturalHeight;
      if (!nw || !nh) return;

      var boxW = img.offsetWidth, boxH = img.offsetHeight;
      var tb = img.getBoundingClientRect();
      var scale = tb.height / boxH;              // the parallax overscan
      var centreY = tb.top + tb.height / 2;

      // object-fit: cover, object-position 50% 50%
      var cover = Math.max(boxW / nw, boxH / nh);
      var offsetY = (boxH - nh * cover) / 2;

      var layoutY = offsetY + (fraction * nh) * cover;
      var viewportY = centreY + (layoutY - boxH / 2) * scale;

      var m = main.getBoundingClientRect();
      if (!m.height) return;

      /* Measure the WHOLE lockup, not just the VERITAS line — there is a
         thin VENTURES line beneath it, and anchoring on the bold word alone
         left that second line hanging over the roof. Harmless against this
         dark roof, illegible over a brighter photograph. */
      var t = title.getBoundingClientRect();
      if (!t.height) return;

      /* Solve for the lift that puts the lockup's base GAP px above the
         roofline. The stack is bottom-anchored, so increasing the title's
         bottom margin by d raises the lockup by exactly d:
             newBottom = bottom - (L' - L)   and we want
             newBottom = roofY - GAP
         =>  L' = bottom + L - roofY + GAP                                */
      var L = parseFloat(getComputedStyle(title).marginBottom) || 0;
      var wanted = t.bottom + L - viewportY + GAP;

      // Never let it collide with the header or dive under the card.
      var hero = document.querySelector('.hero-cine');
      var maxLift = hero ? hero.getBoundingClientRect().height * 0.42 : 300;
      wanted = Math.max(0, Math.min(maxLift, wanted));

      title.style.setProperty('--title-lift', Math.round(wanted) + 'px');
    }

    /* Applying the lift reflows the wordmark, which moves the very
       measurement it was derived from. A second pass settles it. */
    function settle() { place(); place(); }

    if (img.complete) settle(); else img.addEventListener('load', settle);
    window.addEventListener('resize', onFrame(settle));
    // Fonts change the wordmark's height, which moves the cut.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
  })();

  /* ---------- 8. Hero scroll expand -------------------------- */
  /* The hero plate starts inset with rounded corners and grows to full
     bleed as you scroll through the first part of the hero — the
     ScrollExpand pattern, done natively.

     CSS owns all the geometry; this only publishes a 0→1 progress value
     as --expand. The stylesheet defaults it to 1, so with no JS (or with
     reduced motion) the plate simply renders full-bleed and nothing is
     missing. */
  (function () {
    var hero = document.querySelector('.hero-cine');
    var media = hero && hero.querySelector('.hero-cine-media');
    if (!media) return;

    if (reduced) { media.style.setProperty('--expand', '1'); return; }

    function update() {
      var h = hero.getBoundingClientRect().height || 1;
      // Fully expanded a little over half way down the hero, so the plate
      // has settled before the wordmark reaches the roofline.
      var p = window.scrollY / (h * 0.55);
      p = Math.max(0, Math.min(1, p));
      media.style.setProperty('--expand', p.toFixed(3));
    }

    window.addEventListener('scroll', onFrame(update), { passive: true });
    window.addEventListener('resize', onFrame(update));
    update();
  })();

  /* ---------- 9. Project rail arrows ------------------------ */
  (function () {
    function scrollRail(id, dir) {
      var rail = document.getElementById(id);
      if (!rail) return;
      var first = rail.querySelector('.rail-item');
      var step = first ? first.getBoundingClientRect().width + 16 : rail.clientWidth * 0.8;
      rail.scrollBy({ left: step * dir, behavior: reduced ? 'auto' : 'smooth' });
    }

    Array.prototype.forEach.call(document.querySelectorAll('[data-rail-prev]'), function (b) {
      b.addEventListener('click', function () { scrollRail(b.getAttribute('data-rail-prev'), -1); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-rail-next]'), function (b) {
      b.addEventListener('click', function () { scrollRail(b.getAttribute('data-rail-next'), 1); });
    });
  })();

})();
