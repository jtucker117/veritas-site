/* ============================================================
   TEXAS SERVICE-AREA MAP
   ============================================================
   👋 TO ADD A PROJECT PIN LATER:
   Scroll to the PROJECTS array below and add one line, e.g.

      { name: "Kitchen Remodel", city: "Conroe, TX", lon: -95.456, lat: 30.311 },

   Find a project's lon/lat by searching the address on Google Maps,
   right-clicking the spot → the first numbers are LAT, LON
   (note: enter them here as lon = second number, lat = first number).
   That's it — the pin places itself automatically. Then push to GitHub.
   ============================================================ */

(function () {
  // Geographic bounds + viewBox used to project lon/lat -> SVG x/y.
  // (Generated from the real Texas state boundary — do not change.)
  var B = { lonMin: -106.643603, lonMax: -93.526331, latMin: 25.887551, latMax: 36.501861, vw: 1000, vh: 985, pad: 40 };

  function project(lon, lat) {
    var x = (lon - B.lonMin) / (B.lonMax - B.lonMin);
    var y = (B.latMax - lat) / (B.latMax - B.latMin);
    return {
      x: B.pad + x * (B.vw - 2 * B.pad),
      y: B.pad + y * (B.vh - 2 * B.pad)
    };
  }

  // --- Anchor cities (the "Texas Triangle" + reference points) ---
  var CITIES = [
    { name: "Dallas", lon: -96.7970, lat: 32.7767 },
    { name: "Austin", lon: -97.7431, lat: 30.2672 },
    { name: "Houston", lon: -95.3698, lat: 29.7604 },
    { name: "San Antonio", lon: -98.4936, lat: 29.4241, faint: true }
  ];

  // --- Your HQ ---
  var HQ = { name: "Veritas HQ — Magnolia", lon: -95.7505, lat: 30.2094 };

  // ============================================================
  // PROJECTS — ADD YOUR COMPLETED PROJECTS HERE (see note up top)
  // ============================================================
  var PROJECTS = [
    // { name: "Sample Project", city: "The Woodlands, TX", lon: -95.5010, lat: 30.1658 },
  ];

  var svg = document.getElementById('tx-map');
  if (!svg) return;

  // Triangle highlight connecting Dallas–Austin–Houston
  var d = project(-96.7970, 32.7767), a = project(-97.7431, 30.2672), h = project(-95.3698, 29.7604);
  var tri = document.getElementById('tx-triangle');
  if (tri) tri.setAttribute('points', d.x + ',' + d.y + ' ' + a.x + ',' + a.y + ' ' + h.x + ',' + h.y);

  var SVGNS = 'http://www.w3.org/2000/svg';
  function el(name, attrs) {
    var e = document.createElementNS(SVGNS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  var layer = document.getElementById('tx-pins');

  // Place a label left or right of a point so it stays inside the viewBox.
  // viewBox right edge is ~980; if the label would run past it, anchor it to the left.
  var RIGHT_EDGE = 940;
  function addLabel(p, textStr, extraClass) {
    var goLeft = p.x > RIGHT_EDGE - textStr.length * 13;
    var label = el('text', {
      x: goLeft ? p.x - 14 : p.x + 14,
      y: p.y + 5,
      class: 'tx-label' + (extraClass || '') + (goLeft ? ' tx-label--left' : '')
    });
    label.textContent = textStr;
    layer.appendChild(label);
  }

  // City dots + labels
  CITIES.forEach(function (c) {
    var p = project(c.lon, c.lat);
    var dot = el('circle', { cx: p.x, cy: p.y, r: c.faint ? 6 : 8, class: 'tx-city' + (c.faint ? ' tx-city--faint' : '') });
    layer.appendChild(dot);
    addLabel(p, c.name, c.faint ? ' tx-label--faint' : '');
  });

  // HQ marker (star-ish)
  var hq = project(HQ.lon, HQ.lat);
  var hqMark = el('circle', { cx: hq.x, cy: hq.y, r: 10, class: 'tx-hq' });
  layer.appendChild(hqMark);
  var hqRing = el('circle', { cx: hq.x, cy: hq.y, r: 18, class: 'tx-hq-ring' });
  layer.appendChild(hqRing);
  var hqGoLeft = hq.x > RIGHT_EDGE - 10 * 13;
  var hqLabel = el('text', { x: hqGoLeft ? hq.x - 22 : hq.x + 22, y: hq.y - 10, class: 'tx-label tx-label--hq' + (hqGoLeft ? ' tx-label--left' : '') });
  hqLabel.textContent = 'Veritas HQ';
  layer.appendChild(hqLabel);

  // Project pins
  PROJECTS.forEach(function (pr) {
    var p = project(pr.lon, pr.lat);
    var pin = el('circle', { cx: p.x, cy: p.y, r: 7, class: 'tx-project' });
    var title = el('title', {});
    title.textContent = pr.name + (pr.city ? ' — ' + pr.city : '');
    pin.appendChild(title);
    layer.appendChild(pin);
  });

  // Show a small count if there are projects
  var counter = document.getElementById('tx-project-count');
  if (counter) {
    counter.textContent = PROJECTS.length
      ? PROJECTS.length + (PROJECTS.length === 1 ? ' project' : ' projects') + ' and growing'
      : '';
  }
})();
