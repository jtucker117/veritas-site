/* ============================================================
   main.js — small interactions (shared by both pages)
   ============================================================ */

// Mark that JS is active so reveal animations can engage.
// (If JS never runs, content stays fully visible — see styles.css.)
document.documentElement.classList.add('js');

// Current year in footer
(function () {
  document.querySelectorAll('#year').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();

// Mobile nav toggle
(function () {
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  if (!toggle || !links) return;
  toggle.addEventListener('click', function () {
    var open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  // Close menu when a link is tapped
  links.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
})();

// Sticky header shadow on scroll
(function () {
  var header = document.getElementById('header');
  if (!header) return;
  var onScroll = function () {
    header.classList.toggle('scrolled', window.scrollY > 8);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

// Reveal-on-scroll
(function () {
  var items = document.querySelectorAll('.reveal');
  if (!items.length || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
  items.forEach(function (el) { io.observe(el); });

  // Safety net: reveal anything still hidden a moment after full load,
  // so no section can ever stay blank if the observer is bypassed.
  window.addEventListener('load', function () {
    setTimeout(function () {
      items.forEach(function (el) { el.classList.add('in'); });
    }, 1200);
  });
})();
