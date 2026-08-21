/* ============================================================
   NATIONAL FOOTPRINT MAP
   ============================================================
   👋 TO ADD A STATE once work is delivered there:
   add its two-letter code to the WORKED array below, e.g.

      var WORKED = ['TX', 'SC', 'VA', 'IL', 'OH', 'WI', 'OK'];

   The state fills itself in and the count under the map updates.
   Also update the headline in index.html ("Working in six states")
   and the FOOTPRINT figure so the words match the map.

   👋 TO ADD A PROJECT PIN:
   Scroll to the PROJECTS array and add one line, e.g.

      { name: "Kitchen Remodel", city: "Conroe, TX", lon: -95.456, lat: 30.311 },

   Find a project's lon/lat by searching the address on Google Maps,
   right-clicking the spot → the first number is LAT, the second is LON
   (enter them here as lon = second number, lat = first number).
   ============================================================ */

(function () {
  // ============================================================
  // STATES WE HAVE WORKED IN — EDIT THIS LIST
  // ============================================================
  var WORKED = ['TX', 'SC', 'VA', 'IL', 'OH', 'WI'];

  // --- Your HQ ---
  var HQ = { name: 'Veritas HQ', lon: -95.7505, lat: 30.2094 }; // Magnolia, TX

  // ============================================================
  // PROJECTS — ADD YOUR COMPLETED PROJECTS HERE (see note up top)
  // ============================================================
  var PROJECTS = [
    // { name: "Sample Project", city: "The Woodlands, TX", lon: -95.5010, lat: 30.1658 },
  ];

  var svg = document.getElementById('us-map');
  if (!svg) return;

  // Albers equal-area conic — the same projection and constants the state
  // outlines in index.html were generated with, so pins land on the right
  // spot. Changing any of these without regenerating the paths will drift.
  var RAD = Math.PI / 180;
  var P1 = 29.5 * RAD, P2 = 45.5 * RAD, LAT0 = 37.5 * RAD, LON0 = -96 * RAD;
  var N = (Math.sin(P1) + Math.sin(P2)) / 2;
  var C = Math.cos(P1) * Math.cos(P1) + 2 * N * Math.sin(P1);
  var RHO0 = Math.sqrt(C - 2 * N * Math.sin(LAT0)) / N;
  var SCALE = 1322.092127, OX = 510.372, OY = 337.5133;

  function project(lon, lat) {
    var th = N * (lon * RAD - LON0);
    var rho = Math.sqrt(C - 2 * N * Math.sin(lat * RAD)) / N;
    return {
      x: rho * Math.sin(th) * SCALE + OX,
      y: (rho * Math.cos(th) - RHO0) * SCALE + OY
    };
  }

  var SVGNS = 'http://www.w3.org/2000/svg';
  function el(name, attrs) {
    var e = document.createElementNS(SVGNS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // Fill the states we've worked in.
  WORKED.forEach(function (code) {
    var st = svg.querySelector('[data-st="' + code + '"]');
    if (st) st.classList.add('us-state--worked');
  });

  var layer = document.getElementById('us-pins');

  // HQ marker — dot, pulsing ring, and a label that flips to the left of
  // the pin if it would otherwise run off the right edge of the viewBox.
  var hq = project(HQ.lon, HQ.lat);
  layer.appendChild(el('circle', { cx: hq.x, cy: hq.y, r: 7, class: 'us-hq' }));
  layer.appendChild(el('circle', { cx: hq.x, cy: hq.y, r: 12, class: 'us-hq-ring' }));

  var goLeft = hq.x > 1000 - 130;
  var label = el('text', {
    x: goLeft ? hq.x - 14 : hq.x + 14,
    y: hq.y + 5,
    class: 'us-label' + (goLeft ? ' us-label--left' : '')
  });
  label.textContent = HQ.name;
  layer.appendChild(label);

  // Project pins
  PROJECTS.forEach(function (pr) {
    var p = project(pr.lon, pr.lat);
    var pin = el('circle', { cx: p.x, cy: p.y, r: 5, class: 'us-project' });
    var title = el('title', {});
    title.textContent = pr.name + (pr.city ? ' — ' + pr.city : '');
    pin.appendChild(title);
    layer.appendChild(pin);
  });

  // Caption under the map. Reads off WORKED so it can never disagree
  // with what is actually drawn.
  var counter = document.getElementById('us-map-count');
  if (counter) {
    counter.textContent = PROJECTS.length
      ? PROJECTS.length + (PROJECTS.length === 1 ? ' project' : ' projects') + ' across ' + WORKED.length + ' states'
      : 'Work delivered in ' + WORKED.length + ' states';
  }
})();
