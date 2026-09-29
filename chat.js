/* MedRelief assistant — a guided chat that books home collections and centre visits,
 * tracks reports, answers price questions and signs up partners.
 *
 * Every step offers predefined options; free text is routed by keyword. Nothing leaves
 * the browser until the booking API is configured (MR_CONFIG.api.baseUrl):
 *   - hand-off mode (baseUrl ''): the chat builds the booking summary and the patient
 *     confirms it by phone (or copies it / sends it on WhatsApp if a human-read number is set).
 *   - API mode: OTP-verified mobile, then POST /public/* (home-collection workflow spec §7).
 *
 * Public surface: window.MRChat.open(intent) — intents: menu | home | visit | track | offers
 * | faq | app | call | campaign:<code> | centre:<id> | partner | partner:<topic>.
 */
(function () {
  'use strict';
  var C = window.MR_CONFIG || {};
  var API = (C.api && C.api.baseUrl) ? C.api.baseUrl.replace(/\/$/, '') : '';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── tiny DOM helpers ───────────────────────────────────────────────────────
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inr(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
  var ICON = {
    home: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21v-6h6v6"/>',
    visit: '<path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M10 11h4M12 9v4"/>',
    track: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    app: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
    phone: '<path d="M4 5c0-1 1-2 2-2h2l2 4-2 1a12 12 0 0 0 6 6l1-2 4 2v2c0 1-1 2-2 2A16 16 0 0 1 4 5z"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    back: '<path d="M19 12H5m6-6-6 6 6 6"/>',
    link: '<path d="M14 3h7v7M21 3l-9 9"/><path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
    rx: '<path d="M7 3h7l5 5v13H7zM14 3v5h5"/><path d="M10 13h6M10 17h4"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    lab: '<path d="M9 2v6l-5 9a3 3 0 0 0 2.6 4.5h10.8A3 3 0 0 0 20 17l-5-9V2"/><path d="M8 2h8M7 14h10"/>',
    bike: '<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h2l3 11.5M5.5 17.5 9 10h6l-3 7.5"/>',
    plug: '<path d="M9 2v6M15 2v6M7 8h10v4a5 5 0 0 1-10 0zM12 17v5"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9.2-9.2M17 6l3 3"/>'
  };
  function ico(name, size) {
    return '<svg width="' + (size || 16) + '" height="' + (size || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[name] || '') + '</svg>';
  }

  // ── elements ───────────────────────────────────────────────────────────────
  var root = document.getElementById('mr-chat');
  if (!root) return;
  var log = root.querySelector('.mc-log');
  var form = root.querySelector('.mc-form');
  var input = root.querySelector('.mc-input');
  var chatPane = root.querySelector('.mc-chatpane');
  var callPane = root.querySelector('.mc-callpane');

  var aud = 'patients';        // mirrors the page's audience switch
  var expect = null;           // { placeholder, type, validate(v) -> error|null, then(v) }
  var B = {};                  // current booking / lead draft
  var queue = Promise.resolve();
  var gen = 0;                 // bumped on reset so a flow still 'typing' can't leak into the next one
  function later(fn) { var g = gen; queue = queue.then(function () { if (g === gen) return fn(); }); return queue; }

  // ── message primitives (queued so bot lines appear in order, with a typing beat) ─
  function scroll() { log.scrollTop = log.scrollHeight; }
  function bot(content) {
    return later(function () {
      var g = gen;
      return new Promise(function (res) {
        var dots = h('div', { class: 'mc-msg mc-bot mc-typing', 'aria-hidden': 'true' }, [h('span'), h('span'), h('span')]);
        log.appendChild(dots); scroll();
        setTimeout(function () {
          dots.remove();
          if (g !== gen) return res();
          var b = h('div', { class: 'mc-msg mc-bot' });
          if (typeof content === 'string') b.innerHTML = content; else b.appendChild(content);
          log.appendChild(b); scroll(); res();
        }, reduce ? 0 : typeof content === 'string' ? 400 : 180);
      });
    });
  }
  function me(text) {
    log.appendChild(h('div', { class: 'mc-msg mc-me', text: text })); scroll();
  }
  // Predefined options. Each: { l: label, go: fn, i: icon, p: primary, href }
  function choose(list) {
    later(function () {
      var row = h('div', { class: 'mc-chips', role: 'group', 'aria-label': 'Options' });
      list.forEach(function (o) {
        var attrs = { class: 'mc-chip' + (o.p ? ' mc-chip-pri' : ''), type: 'button' };
        var el;
        if (o.href) {
          el = h('a', { class: attrs.class, href: o.href, target: o.href.indexOf('http') === 0 ? '_blank' : null, rel: 'noopener' });
        } else {
          el = h('button', attrs);
          el.addEventListener('click', function () {
            row.remove(); expect = null; setPlaceholder();
            me(o.l); o.go();
          });
        }
        el.innerHTML = (o.i ? ico(o.i, 15) : '') + '<span></span>';
        el.querySelector('span').textContent = o.l;
        row.appendChild(el);
      });
      log.appendChild(row); scroll();
    });
    return queue;
  }
  function clearChips() { [].slice.call(log.querySelectorAll('.mc-chips')).forEach(function (r) { r.remove(); }); }
  function ask(opt) {
    later(function () {
      expect = opt; setPlaceholder(opt.placeholder, opt.type);
      if (window.matchMedia('(min-width:1080px)').matches || root.classList.contains('open')) input.focus({ preventScroll: true });
    });
    return queue;
  }
  function setPlaceholder(p, type) {
    input.placeholder = p || 'Type a message, or pick an option';
    input.setAttribute('inputmode', type === 'tel' || type === 'number' ? 'numeric' : 'text');
    input.setAttribute('autocomplete', type === 'tel' ? 'tel' : type === 'name' ? 'name' : 'off');
  }
  function btn(label, icon, onClick, cls) {
    var b = h('button', { type: 'button', class: 'mc-btn' + (cls ? ' ' + cls : ''), onclick: onClick });
    b.innerHTML = (icon ? ico(icon, 15) : '') + '<span></span>';
    b.querySelector('span').textContent = label;
    return b;
  }
  function linkBtn(label, icon, href, cls) {
    var a = h('a', { class: 'mc-btn' + (cls ? ' ' + cls : ''), href: href, target: href.indexOf('http') === 0 ? '_blank' : null, rel: 'noopener' });
    a.innerHTML = (icon ? ico(icon, 15) : '') + '<span></span>';
    a.querySelector('span').textContent = label;
    return a;
  }
  function tel() { return 'tel:' + C.phone; }

  // ── validators ─────────────────────────────────────────────────────────────
  function vName(v) { return v.trim().length >= 2 ? null : 'Please type the full name.'; }
  function normMobile(v) { var d = v.replace(/\D/g, ''); if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2); if (d.length === 11 && d[0] === '0') d = d.slice(1); return d; }
  function vMobile(v) { return /^[6-9]\d{9}$/.test(normMobile(v)) ? null : 'That doesn’t look like a 10-digit mobile number. Please try again.'; }
  function vAge(v) { var n = parseInt(v, 10); return (/^\d{1,3}$/.test(v.trim()) && n >= 0 && n <= 120) ? null : 'Please type the age in years, e.g. 42.'; }
  function vPin(v) { return /^\d{6}$/.test(v.replace(/\s/g, '')) ? null : 'A pincode has 6 digits, e.g. 803101.'; }
  function vText(min) { return function (v) { return v.trim().length >= min ? null : 'Please add a little more detail.'; }; }

  // ── dates & slots ──────────────────────────────────────────────────────────
  function isoDay(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dayLabel(d, i) {
    var s = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    return i === 0 ? 'Today, ' + s : i === 1 ? 'Tomorrow, ' + s : s;
  }
  function slotsFor(kind, date) {
    var all = ((C.slots || {})[kind]) || [];
    var now = new Date();
    if (isoDay(date) !== isoDay(now)) return all;
    return all.filter(function (s) { return s.start > now.getHours() + 1; });
  }
  function pickDay(kind, then) {
    var days = [], n = (C.slots && C.slots.daysAhead) || 3;
    for (var i = 0; i <= n; i++) {
      var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i);
      if (slotsFor(kind, d).length) days.push({ d: d, i: i });
    }
    bot('Which day suits you?');
    choose(days.slice(0, n).map(function (x) {
      return { l: dayLabel(x.d, x.i), go: function () { B.date = isoDay(x.d); B.dateLabel = dayLabel(x.d, x.i); pickSlot(kind, x.d, then); } };
    }));
  }
  function pickSlot(kind, d, then) {
    bot('And a time window?');
    choose(slotsFor(kind, d).map(function (s) {
      return { l: s.label, go: function () { B.slot = s; then(); } };
    }));
  }

  // ── catalogue helpers ──────────────────────────────────────────────────────
  function campaigns() { return (C.campaigns || []).filter(function (c) { return c.active !== false; }); }
  function camp(code) { return campaigns().filter(function (c) { return c.code === code; })[0]; }
  function mrpOf(c) { return c.tests.reduce(function (s, t) { return s + t[1]; }, 0); }
  function estimate() {
    return (B.items || []).reduce(function (s, it) { return s + it.price; }, 0);
  }
  function itemsText() {
    if (!B.items || !B.items.length) return B.notSure ? 'Not sure yet — please advise' : B.rx ? 'As per prescription' : 'To decide at the centre';
    return B.items.map(function (it) { return it.name; }).join(', ') + (B.rx ? ' (+ prescription)' : '');
  }

  function offerCard(c, opts) {
    var mrp = mrpOf(c), save = mrp - c.price;
    var list = h('ul', { class: 'mc-inc' });
    c.tests.forEach(function (t) { list.appendChild(h('li', {}, [h('span', { text: t[0] }), h('span', { class: 'mc-inc-p', text: inr(t[1]) })])); });
    var card = h('div', { class: 'mc-card mc-offer' }, [
      h('div', { class: 'mc-offer-top' }, [h('span', { class: 'mc-tag', text: c.tag || 'Offer' }), h('span', { class: 'mc-offer-n', text: c.tests.length + ' tests' })]),
      h('div', { class: 'mc-offer-name', text: c.name }),
      h('p', { class: 'mc-offer-blurb', text: c.blurb || '' }),
      h('div', { class: 'mc-price' }, [
        h('b', { text: inr(c.price) }), h('s', { text: inr(mrp) }),
        save > 0 ? h('span', { class: 'mc-save', text: 'Save ' + inr(save) + ' (' + Math.round(save * 100 / mrp) + '%)' }) : null
      ]),
      h('details', { class: 'mc-details', open: opts && opts.open ? true : null }, [h('summary', { text: 'What’s included' }), list,
        h('div', { class: 'mc-inc-total' }, [h('span', { text: 'Standard price' }), h('span', { text: inr(mrp) })])]),
      c.fasting ? h('div', { class: 'mc-note', text: 'Overnight fasting (10–12 hours) needed — water is fine.' }) : null,
      h('div', { class: 'mc-actions' }, [
        btn('Home collection', 'home', function () { clearChips(); me('Home collection — ' + c.name); homeStart(c); }, 'mc-btn-pri'),
        btn('Visit a centre', 'visit', function () { clearChips(); me('Visit a centre — ' + c.name); visitStart(null, c); })
      ])
    ]);
    return card;
  }

  // ── PATIENT: main menu ─────────────────────────────────────────────────────
  function menu(greet) {
    B = {};
    bot(greet || 'Namaste! I’m the MedRelief assistant. I can book your test, collect a sample from home, or find your report. What would you like to do?');
    choose([
      { l: 'Home sample collection', i: 'home', go: function () { homeStart(); }, p: true },
      { l: 'Visit a centre', i: 'visit', go: function () { visitStart(); } },
      { l: 'Track my report', i: 'track', go: track },
      { l: 'Offers & packages', i: 'tag', go: offers },
      { l: 'Prices & questions', i: 'help', go: faq },
      { l: 'Get the patient app', i: 'app', go: app },
      { l: 'Call us', i: 'phone', go: call }
    ]);
  }
  function andThen() {
    choose([
      { l: 'Book home collection', i: 'home', go: function () { homeStart(); } },
      { l: 'Main menu', i: 'back', go: function () { menu('Anything else I can help with?'); } }
    ]);
  }

  // ── HOME COLLECTION ────────────────────────────────────────────────────────
  function homeStart(c) {
    B = { kind: 'home', items: [], key: String(Date.now()) + Math.random().toString(36).slice(2, 8) };
    if (c) { B.items = [{ type: 'PACKAGE', code: c.code, name: c.name, price: c.price, mrp: mrpOf(c) }]; bot('Great choice — <b>' + c.name + '</b> at your door. A few quick details and you’re booked.'); return homeName(); }
    bot('Let’s book a home collection — a trained collection agent comes to you. What do you need tested?');
    choose([
      { l: 'An offer or package', i: 'tag', go: function () { pickPackage(homeName); } },
      { l: 'Choose tests', i: 'list', go: function () { pickTests(homeName); } },
      { l: 'I have a prescription', i: 'rx', go: function () { rxNote(homeName); } },
      { l: 'Not sure — help me', i: 'help', go: function () { B.notSure = true; bot('No problem. Our team will call you before the visit to advise on the right tests.'); homeName(); } }
    ]);
  }
  function rxNote(next) {
    B.rx = true;
    bot('Please keep the prescription ready. Our collection agent checks it at your door and confirms the final tests and amount with you before anything is charged.');
    next();
  }
  function pickPackage(next) {
    bot('Here are our current offers. Tap <b>Choose</b> on the one you want.');
    later(function () {
      var wrap = h('div', { class: 'mc-pick' });
      campaigns().forEach(function (c) {
        var mrp = mrpOf(c);
        wrap.appendChild(h('div', { class: 'mc-pick-row' }, [
          h('div', {}, [h('b', { text: c.name }), h('small', { text: c.tests.length + ' tests · ' + inr(c.price) + ' (standard ' + inr(mrp) + ')' })]),
          btn('Choose', null, function () {
            wrap.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
            me(c.name); B.items = [{ type: 'PACKAGE', code: c.code, name: c.name, price: c.price, mrp: mrp }]; next();
          }, 'mc-btn-sm')
        ]));
      });
      var b = h('div', { class: 'mc-msg mc-bot mc-wide' }, [wrap]); log.appendChild(b); scroll();
    });
  }
  function pickTests(next) {
    bot('Tick the tests you need. Prices are our standard rates.');
    later(function () {
      var chosen = {};
      var total = h('b', { text: inr(0) });
      var done = btn('Done', 'check', function () {
        var codes = Object.keys(chosen); if (!codes.length) return;
        box.querySelectorAll('input,button').forEach(function (x) { x.disabled = true; });
        B.items = codes.map(function (k) { return chosen[k]; });
        me(B.items.map(function (i) { return i.name; }).join(', '));
        if (B.items.some(function (i) { return i.fasting; })) bot('Heads-up: fasting sugar and lipid profile need 10–12 hours of overnight fasting (water is fine).');
        next();
      }, 'mc-btn-pri');
      done.disabled = true;
      var list = h('div', { class: 'mc-checks' });
      (C.tests || []).forEach(function (t) {
        var cb = h('input', { type: 'checkbox', value: t.code });
        cb.addEventListener('change', function () {
          if (cb.checked) chosen[t.code] = { type: 'TEST', code: t.code, name: t.name, price: t.mrp, mrp: t.mrp, fasting: !!t.fasting };
          else delete chosen[t.code];
          var sum = Object.keys(chosen).reduce(function (s, k) { return s + chosen[k].price; }, 0);
          total.textContent = inr(sum); done.disabled = !Object.keys(chosen).length;
        });
        list.appendChild(h('label', { class: 'mc-check' }, [cb, h('span', { text: t.name }), h('span', { class: 'mc-inc-p', text: inr(t.mrp) })]));
      });
      var box = h('div', { class: 'mc-card' }, [list, h('div', { class: 'mc-checks-foot' }, [h('span', {}, ['Estimate ', total]), done])]);
      log.appendChild(h('div', { class: 'mc-msg mc-bot mc-wide' }, [box])); scroll();
    });
  }
  function homeName() {
    bot('Who is the test for? Please type the patient’s <b>full name</b>.');
    ask({ placeholder: 'Patient’s full name', type: 'name', validate: vName, then: function (v) { B.name = v.trim(); homeGender(); } });
  }
  function homeGender() {
    bot('Thanks. Gender?');
    choose(['Male', 'Female', 'Other'].map(function (g) { return { l: g, go: function () { B.gender = g.toUpperCase(); homeAge(); } }; }));
  }
  function homeAge() {
    bot('Age in years?');
    ask({ placeholder: 'Age, e.g. 42', type: 'number', validate: vAge, then: function (v) { B.age = parseInt(v, 10); mobile(homeAddress); } });
  }
  function mobile(next) {
    bot(API ? 'Your <b>mobile number</b>? We’ll send the booking confirmation and the report here.' : 'Your <b>mobile number</b>? Our desk confirms the booking on it, and your report comes here on WhatsApp.');
    ask({ placeholder: '10-digit mobile number', type: 'tel', validate: vMobile, then: function (v) { B.mobile = normMobile(v); API ? otp(next) : next(); } });
  }
  function homeAddress() {
    bot('Where should we collect the sample? Type the <b>house / street and area</b>, with a landmark if you like.');
    ask({ placeholder: 'House, street, area, landmark', validate: vText(8), then: function (v) { B.address = v.trim(); homePin(); } });
  }
  function homePin() {
    bot('And the <b>pincode</b>?');
    ask({ placeholder: '6-digit pincode', type: 'number', validate: vPin, then: function (v) {
      B.pincode = v.replace(/\s/g, '');
      var pins = (C.homeCollection && C.homeCollection.pincodes) || [];
      if (pins.length && pins.indexOf(B.pincode) < 0) bot('We may not cover ' + B.pincode + ' yet — our team will confirm when they call.');
      pickDay('home', summary);
    } });
  }

  // ── CENTRE VISIT ───────────────────────────────────────────────────────────
  function visitStart(centreId, c) {
    B = { kind: 'visit', items: [], key: String(Date.now()) + Math.random().toString(36).slice(2, 8) };
    if (c) B.items = [{ type: 'PACKAGE', code: c.code, name: c.name, price: c.price, mrp: mrpOf(c) }];
    var centre = (C.centres || []).filter(function (x) { return x.id === centreId; })[0];
    if (centre) { B.centre = centre; bot('Booking a visit at <b>' + centre.name + '</b>. Pick a time and you’ll skip the queue.'); return pickDay('centre', visitTests); }
    bot('Which centre would you like to visit?');
    choose((C.centres || []).map(function (x) { return { l: x.name, go: function () { B.centre = x; pickDay('centre', visitTests); } }; }));
  }
  function visitTests() {
    if (B.items.length) return visitName();
    bot('Do you know which tests you need?');
    choose([
      { l: 'An offer or package', i: 'tag', go: function () { pickPackage(visitName); } },
      { l: 'Choose tests', i: 'list', go: function () { pickTests(visitName); } },
      { l: 'I have a prescription', i: 'rx', go: function () { B.rx = true; bot('Bring the prescription — the counter reads it and bills exactly what’s prescribed.'); visitName(); } },
      { l: 'Decide at the centre', i: 'help', go: visitName }
    ]);
  }
  function visitName() {
    bot('Your <b>name</b>, please?');
    ask({ placeholder: 'Full name', type: 'name', validate: vName, then: function (v) { B.name = v.trim(); mobile(summary); } });
  }

  // ── SUMMARY + CONFIRM (both flows) ─────────────────────────────────────────
  function row(k, v) { return h('div', { class: 'mc-row' }, [h('span', { text: k }), h('b', { text: v })]); }
  function summary() {
    var home = B.kind === 'home';
    bot(home ? 'Here’s your booking. Please check it.' : 'Here’s your visit. Please check it.');
    later(function () {
      var est = estimate(), mrp = (B.items || []).reduce(function (s, i) { return s + i.mrp; }, 0);
      var lines = h('div', { class: 'mc-lines' });
      (B.items || []).forEach(function (it) {
        lines.appendChild(h('div', { class: 'mc-line' }, [h('span', { text: it.name }), h('span', {}, [it.mrp > it.price ? h('s', { text: inr(it.mrp) }) : null, ' ', h('b', { text: inr(it.price) })])]));
      });
      if (B.rx) lines.appendChild(h('div', { class: 'mc-line' }, [h('span', { text: 'Tests on your prescription' }), h('span', { class: 'mc-muted', text: home ? 'priced at the door' : 'priced at the counter' })]));
      if (B.notSure) lines.appendChild(h('div', { class: 'mc-line' }, [h('span', { text: 'Tests to be advised by our team' }), h('span', { class: 'mc-muted', text: 'on the call' })]));
      var cb = h('input', { type: 'checkbox' });
      var go = btn(home ? 'Confirm booking' : 'Confirm visit', 'check', function () {
        if (!cb.checked) return; go.disabled = true; edit.disabled = true; cb.disabled = true;
        me(home ? 'Confirm booking' : 'Confirm visit'); submit();
      }, 'mc-btn-pri');
      go.disabled = true;
      cb.addEventListener('change', function () { go.disabled = !cb.checked; });
      var edit = btn('Start again', 'back', function () { go.disabled = true; edit.disabled = true; me('Start again'); home ? homeStart() : visitStart(); });
      var card = h('div', { class: 'mc-card mc-summary' }, [
        h('div', { class: 'mc-sum-h', text: home ? 'Home collection' : 'Centre visit — ' + B.centre.name }),
        row('Patient', B.name + (home ? ' · ' + B.age + ' · ' + B.gender.charAt(0) + B.gender.slice(1).toLowerCase() : '')),
        row('Mobile', B.mobile.replace(/(\d{5})(\d{5})/, '$1 $2')),
        home ? row('Address', B.address + ', ' + B.pincode) : row('Centre', B.centre.address),
        row('When', B.dateLabel + ' · ' + B.slot.label),
        lines,
        (B.items && B.items.length) ? h('div', { class: 'mc-total' }, [h('span', { text: B.rx || B.notSure ? 'Estimate so far' : 'Estimated total' }), h('span', {}, [mrp > est ? h('s', { text: inr(mrp) }) : null, ' ', h('b', { text: inr(est) })])]) : null,
        h('p', { class: 'mc-note', text: home
          ? 'Nothing to pay now. Our collection agent confirms the final tests against your prescription at your door, then you pay there by UPI QR or cash.' + (C.homeCollection && C.homeCollection.fee ? ' Home collection charge: ' + inr(C.homeCollection.fee) + '.' : ' Any home-collection charge is confirmed by our team.')
          : 'Nothing to pay now — pay at the counter by UPI, card or cash.' }),
        h('label', { class: 'mc-consent' }, [cb, h('span', { html: 'I agree that MedRelief may use these details to arrange my test, as described in the <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.' })]),
        h('div', { class: 'mc-actions' }, [go, edit])
      ]);
      log.appendChild(h('div', { class: 'mc-msg mc-bot mc-wide' }, [card])); scroll();
    });
  }
  function summaryText() {
    var home = B.kind === 'home';
    return [
      home ? 'HOME COLLECTION REQUEST' : 'CENTRE VISIT REQUEST — ' + B.centre.name,
      'Patient: ' + B.name + (home ? ' (' + B.age + ', ' + B.gender.charAt(0) + B.gender.slice(1).toLowerCase() + ')' : ''),
      'Mobile: ' + B.mobile,
      home ? 'Address: ' + B.address + ', ' + B.pincode : null,
      'When: ' + B.dateLabel + ', ' + B.slot.label,
      'Tests: ' + itemsText(),
      (B.items && B.items.length) ? 'Estimate: ' + inr(estimate()) : null
    ].filter(Boolean).join('\n');
  }
  function payload() {
    return {
      source: 'WEBSITE_CHAT',
      kind: B.kind === 'home' ? 'HOME_COLLECTION' : 'CENTRE_VISIT',
      patient: { name: B.name, mobile: B.mobile, age: B.age == null ? null : B.age, gender: B.gender || null },
      items: (B.items || []).map(function (i) { return { type: i.type, code: i.code }; }),
      has_prescription: !!B.rx, needs_advice: !!B.notSure,
      address: B.kind === 'home' ? { line: B.address, pincode: B.pincode } : null,
      centre_code: B.centre ? B.centre.id : null,
      slot: { date: B.date, start_hour: B.slot.start, label: B.slot.label },
      estimate_inr: estimate(),
      consent: { policy: 'privacy.html', accepted_at: new Date().toISOString() }
    };
  }
  function submit() {
    if (!API) return handoff();
    bot('Booking it for you…');
    post(B.kind === 'home' ? '/public/home-collection-orders' : '/public/centre-bookings', payload())
      .then(function (r) {
        var ref = r && (r.order_ref || r.booking_ref);
        bot('Booked! Your reference is <b class="mc-mono">' + esc(ref || '—') + '</b>. We’ve sent the details to your WhatsApp' +
          (B.kind === 'home' ? '; you’ll get your collection agent’s name before the visit.' : '.'));
        andThen();
      })
      .catch(function () {
        bot('I couldn’t reach our booking system just now — sorry. You can still confirm this booking by phone in under a minute.');
        handoff(true);
      });
  }
  function handoff(afterError) {
    if (!afterError) bot('Thanks, ' + esc(B.name.split(' ')[0]) + '. One last step: <b>call our desk to confirm your slot</b> — it takes under a minute. Keep this summary handy for the call.');
    later(function () {
      var txt = summaryText();
      var copyBtn = btn('Copy summary', 'copy', function () {
        var done = function () { copyBtn.querySelector('span').textContent = 'Copied'; };
        if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, function () {}); else done();
      });
      var acts = [linkBtn('Call ' + C.phoneDisplay, 'phone', tel(), 'mc-btn-pri'), copyBtn];
      if (C.whatsapp) acts.push(linkBtn('Send on WhatsApp', 'msg', 'https://wa.me/' + C.whatsapp.replace(/\D/g, '') + '?text=' + encodeURIComponent(txt)));
      var card = h('div', { class: 'mc-card' }, [h('pre', { class: 'mc-pre', text: txt }), h('div', { class: 'mc-actions' }, acts)]);
      log.appendChild(h('div', { class: 'mc-msg mc-bot mc-wide' }, [card])); scroll();
    });
    andThen();
  }

  // ── OTP (API mode only) ────────────────────────────────────────────────────
  function post(path, body) {
    return fetch(API + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': B.key || '', Authorization: B.token ? 'Bearer ' + B.token : '' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw j; return j; }); });
  }
  function otp(next) {
    post('/public/otp/request', { mobile: B.mobile }).then(function () {
      bot('I’ve sent a 6-digit code to ' + B.mobile.replace(/(\d{2})\d{6}(\d{2})/, '$1••••••$2') + '. Type it here.');
      ask({ placeholder: '6-digit code', type: 'number', validate: function (v) { return /^\d{6}$/.test(v.trim()) ? null : 'The code has 6 digits.'; }, then: function (v) {
        post('/public/otp/verify', { mobile: B.mobile, code: v.trim() }).then(function (r) { B.token = r.token; next(); })
          .catch(function () { bot('That code didn’t match. Let’s try the number again.'); mobile(next); });
      } });
    }).catch(function () { bot('I couldn’t send a code right now. You can finish on the phone instead.'); next(); });
  }

  // ── TRACK ──────────────────────────────────────────────────────────────────
  function track() {
    if (API) {
      B = { kind: 'track' };
      return mobile(function () {
        fetch(API + '/public/track', { headers: { Authorization: 'Bearer ' + B.token } }).then(function (r) { return r.json(); }).then(function (r) {
          var v = (r && r.visits) || [];
          if (!v.length) { bot('I can’t find a recent visit on this number. If you registered with a different mobile, try that one.'); return andThen(); }
          v.slice(0, 3).forEach(function (x) { bot('<b>' + esc(x.date) + '</b> · ' + esc(x.tests) + '<br>Stage: <b>' + esc(x.stage) + '</b>'); });
          andThen();
        }).catch(function () { trackHandoff(); });
      });
    }
    trackHandoff();
  }
  function trackHandoff() {
    bot('Your report comes to your WhatsApp the moment our pathologist signs it. To see where it is right now:');
    later(function () {
      var card = h('div', { class: 'mc-card' }, [
        h('div', { class: 'mc-step' }, [h('span', { class: 'mc-num', text: '1' }), h('span', { html: '<b>Scan the QR on your receipt.</b> It opens a live status page for your bill and report.' })]),
        h('div', { class: 'mc-step' }, [h('span', { class: 'mc-num', text: '2' }), h('span', { html: '<b>Or open the patient app</b> and sign in with your mobile number — every report you’ve done is there.' })]),
        h('div', { class: 'mc-actions' }, [linkBtn('Open patient portal', 'link', C.apps.patientWeb, 'mc-btn-pri'), linkBtn('Call ' + C.phoneDisplay, 'phone', tel())])
      ]);
      log.appendChild(h('div', { class: 'mc-msg mc-bot mc-wide' }, [card])); scroll();
    });
    choose([{ l: 'Get the patient app', i: 'app', go: app }, { l: 'Main menu', i: 'back', go: function () { menu('Anything else I can help with?'); } }]);
  }

  // ── OFFERS ─────────────────────────────────────────────────────────────────
  function offers() {
    bot('Our current offers — each bundles tests for less than their standard price. Book any of them for home collection or a centre visit.');
    campaigns().forEach(function (c) { bot(offerCard(c)); });
    choose([{ l: 'Choose single tests', i: 'list', go: function () { homeStart(); } }, { l: 'Main menu', i: 'back', go: function () { menu('Anything else I can help with?'); } }]);
  }
  function showCampaign(code) {
    var c = camp(code);
    if (!c) return offers();
    bot(offerCard(c, { open: true }));
    choose([{ l: 'See all offers', i: 'tag', go: offers }, { l: 'Main menu', i: 'back', go: function () { menu('Anything else I can help with?'); } }]);
  }

  // ── FAQ ────────────────────────────────────────────────────────────────────
  var FAQ = [
    { q: 'How much does a test cost?', a: function () {
      bot('Our standard prices for common tests:');
      later(function () {
        var list = h('ul', { class: 'mc-inc' });
        (C.tests || []).forEach(function (t) { list.appendChild(h('li', {}, [h('span', { text: t.name }), h('span', { class: 'mc-inc-p', text: inr(t.mrp) })])); });
        log.appendChild(h('div', { class: 'mc-msg mc-bot mc-wide' }, [h('div', { class: 'mc-card' }, [list])])); scroll();
      });
      bot('Packages bundle tests for less — tap <b>Offers &amp; packages</b> to compare.');
    } },
    { q: 'Do I need to fast?', a: function () { bot('Fasting blood sugar and lipid profile need <b>10–12 hours</b> of overnight fasting — water is fine. Most other tests don’t need fasting. We flag it when you book.'); } },
    { q: 'When will I get my report?', a: function () { bot('Most routine blood tests are reported <b>the same day</b>. Some specialised tests take longer — we tell you when you book. The report reaches your WhatsApp as soon as a pathologist signs it.'); } },
    { q: 'How do I pay?', a: function () { bot('<b>Home collection:</b> nothing up front — our agent confirms the final tests at your door and you pay there by UPI QR or cash.<br><b>At a centre:</b> pay at the counter by UPI, card or cash.'); } },
    { q: 'Do you come to my area?', a: function () { bot('Tell us your pincode while booking and our team confirms coverage when they call.'); } },
    { q: 'How will I receive my report?', a: function () { bot('On <b>WhatsApp</b>, as a PDF, once a pathologist verifies and signs it. It’s also in the MedRelief patient app, and printed copies are available at the centre.'); } }
  ];
  function faq() {
    bot('What would you like to know?');
    choose(FAQ.map(function (f) { return { l: f.q, go: function () { f.a(); andThen(); } }; }).concat([{ l: 'Main menu', i: 'back', go: function () { menu('Anything else I can help with?'); } }]));
  }

  // ── APP ────────────────────────────────────────────────────────────────────
  function app() {
    bot('The MedRelief patient app keeps every report in one place — read it, download the PDF or share it with your doctor.');
    later(function () {
      var kids = [
        h('div', { class: 'mc-qr' }, [h('img', { src: 'assets/qr-patient-app.svg', alt: 'QR code to install the MedRelief patient app', width: '148', height: '148' }),
          h('span', { text: 'Scan with your phone camera to install (Android)' })]),
        h('div', { class: 'mc-actions' }, [
          linkBtn('Install on Android', 'app', C.apps.patientAndroid, 'mc-btn-pri'),
          C.apps.patientIos ? linkBtn('App Store', 'link', C.apps.patientIos) : h('span', { class: 'mc-muted mc-soon', text: 'iPhone app coming soon' })
        ])
      ];
      log.appendChild(h('div', { class: 'mc-msg mc-bot mc-wide' }, [h('div', { class: 'mc-card' }, kids)])); scroll();
    });
    andThen();
  }

  // ── CALL ───────────────────────────────────────────────────────────────────
  function call() { showCall(); bot('Our team is a call away — tap the number to call now. You can switch back to chat any time.'); andThen(); }
  function showCall() { root.classList.add('calling'); callPane.hidden = false; chatPane.hidden = true; tab('call'); }
  function showChat() { root.classList.remove('calling'); callPane.hidden = true; chatPane.hidden = false; tab('chat'); }
  function tab(which) {
    root.querySelectorAll('.mc-tab').forEach(function (t) { var on = t.getAttribute('data-tab') === which; t.classList.toggle('on', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); });
  }

  // ── PARTNERS (labs, doctors, collection agents) ────────────────────────────
  var PARTNER = {
    refer: { l: 'Refer patients (doctors & clinics)', i: 'user', a: 'Refer your patients to MedRelief for a centre visit or home collection. Their verified reports reach you in the MedRelief doctor app, with a statement of every referral.' },
    samples: { l: 'Send samples to MedRelief (labs)', i: 'lab', a: 'Send us the samples you don’t run in-house. We process them on connected analysers, a pathologist verifies every result, and the report comes back to you and your patient.' },
    agents: { l: 'Use MedRelief collection agents', i: 'bike', a: 'Our trained collection agents can pick up samples from your clinic or from your patients’ homes and bring them to our lab — barcoded and tracked.' },
    collect: { l: 'Become a collection agent', i: 'bike', a: 'Collection agents collect samples on MedRelief’s behalf — you don’t run the tests. You get assignments and addresses in our app, and hand samples over to our lab.' },
    api: { l: 'API or website integration', i: 'plug', a: 'Integrations (API access, results into your system, a booking link on your website) are set up by our team for approved partners — they aren’t self-service. Tell us what you need and we’ll plan it with you.' }
  };
  function partnerMenu(greet) {
    B = {};
    bot(greet || 'Hello! I help labs, doctors and collection agents partner with MedRelief. How would you like to work with us?');
    choose(Object.keys(PARTNER).map(function (k) { return { l: PARTNER[k].l, i: PARTNER[k].i, go: function () { partnerTopic(k); } }; }).concat([
      { l: 'Partner login', i: 'key', href: C.apps.partnerPortal },
      { l: 'Call us', i: 'phone', go: call }
    ]));
  }
  function partnerTopic(k) {
    var t = PARTNER[k]; if (!t) return partnerMenu();
    bot(t.a);
    choose([
      { l: 'Leave my details', i: 'check', p: true, go: function () { partnerLead(k); } },
      { l: 'Call us', i: 'phone', go: call },
      { l: 'Other options', i: 'back', go: function () { partnerMenu('How else can we work together?'); } }
    ]);
  }
  function partnerLead(k) {
    B = { kind: 'partner', topic: k, key: String(Date.now()) };
    bot('Your <b>name</b>?');
    ask({ placeholder: 'Your name', type: 'name', validate: vName, then: function (v) {
      B.name = v.trim();
      bot('Clinic, lab or organisation name? (Type <b>individual</b> if none.)');
      ask({ placeholder: 'Organisation', validate: vText(2), then: function (o) {
        B.org = o.trim();
        bot('Which town or city?');
        ask({ placeholder: 'Town / city', validate: vText(2), then: function (c) {
          B.city = c.trim();
          bot('And a mobile number we can reach you on?');
          ask({ placeholder: '10-digit mobile number', type: 'tel', validate: vMobile, then: function (m) { B.mobile = normMobile(m); partnerDone(); } });
        } });
      } });
    } });
  }
  function partnerDone() {
    var txt = 'PARTNER ENQUIRY — ' + PARTNER[B.topic].l + '\nName: ' + B.name + '\nOrganisation: ' + B.org + '\nCity: ' + B.city + '\nMobile: ' + B.mobile;
    var finish = function () {
      later(function () {
        var card = h('div', { class: 'mc-card' }, [h('pre', { class: 'mc-pre', text: txt }), h('div', { class: 'mc-actions' }, [
          linkBtn('Email this to us', 'mail', 'mailto:' + C.email + '?subject=' + encodeURIComponent('Partner enquiry — ' + B.org) + '&body=' + encodeURIComponent(txt), 'mc-btn-pri'),
          linkBtn('Call ' + C.phoneDisplay, 'phone', tel())
        ])]);
        log.appendChild(h('div', { class: 'mc-msg mc-bot mc-wide' }, [card])); scroll();
      });
      choose([{ l: 'Other options', i: 'back', go: function () { partnerMenu('Anything else?'); } }]);
    };
    if (API) {
      post('/public/partner-leads', { topic: B.topic, name: B.name, organisation: B.org, city: B.city, mobile: B.mobile })
        .then(function () { bot('Thank you, ' + esc(B.name.split(' ')[0]) + ' — our partnerships team will call you within one working day.'); choose([{ l: 'Other options', i: 'back', go: function () { partnerMenu('Anything else?'); } }]); })
        .catch(function () { bot('Our system didn’t take that just now — please email or call us with these details:'); finish(); });
    } else {
      bot('Thank you, ' + esc(B.name.split(' ')[0]) + '. Send these details to our partnerships team with one tap, or call us:');
      finish();
    }
  }

  // ── free text → intent ─────────────────────────────────────────────────────
  var INTENTS = [
    [/home|collect|ghar|door|pick ?up/i, function () { homeStart(); }],
    [/track|status|where.*report|report.*(ready|kab)/i, track],
    [/offer|package|campaign|discount|check ?up|nirogyam|full body/i, offers],
    [/visit|centre|center|appointment|schedule|slot|branch/i, function () { visitStart(); }],
    [/price|cost|rate|kitna|charge|fee|₹|rs\.?/i, function () { FAQ[0].a(); andThen(); }],
    [/fast|khali|empty stomach/i, function () { FAQ[1].a(); andThen(); }],
    [/pay|upi|cash|card/i, function () { FAQ[3].a(); andThen(); }],
    [/report|result|whatsapp/i, function () { FAQ[5].a(); andThen(); }],
    [/app|download|install|qr/i, app],
    [/call|phone|agent|human|talk|person|number/i, call],
    [/^(hi|hello|hey|namaste|hlo|menu|start)\b/i, function () { menu(); }]
  ];
  var PARTNER_INTENTS = [
    [/refer|doctor|clinic/i, function () { partnerTopic('refer'); }],
    [/sample|lab|outsourc/i, function () { partnerTopic('samples'); }],
    [/become|join|agent|phlebo|collector/i, function () { partnerTopic('collect'); }],
    [/api|integrat|website|software/i, function () { partnerTopic('api'); }],
    [/login|portal|track/i, function () { bot('Partners sign in here:'); choose([{ l: 'Partner login', i: 'key', href: C.apps.partnerPortal }]); }],
    [/call|phone|talk/i, call]
  ];
  function route(text) {
    var list = aud === 'b2b' ? PARTNER_INTENTS : INTENTS;
    for (var i = 0; i < list.length; i++) if (list[i][0].test(text)) { clearChips(); return list[i][1](); }
    bot('Sorry, I didn’t quite get that. Pick an option below, or call us on <b>' + C.phoneDisplay + '</b>.');
    return aud === 'b2b' ? partnerMenu('Here’s what I can help with:') : menu('Here’s what I can help with:');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = input.value; if (!v.trim()) return;
    input.value = '';
    me(v);
    if (expect) {
      var ex = expect, err = ex.validate ? ex.validate(v) : null;
      if (err) { bot(err); return; }
      expect = null; setPlaceholder(); clearChips(); ex.then(v);
    } else route(v);
  });

  // ── open / close / tabs / audience ─────────────────────────────────────────
  function reset() { gen++; log.innerHTML = ''; expect = null; setPlaceholder(); queue = Promise.resolve(); }
  function open(intent) {
    root.classList.add('open'); document.documentElement.classList.add('mc-locked');
    showChat();
    intent = intent || 'menu';
    var p = intent.split(':'), k = p[0], arg = p.slice(1).join(':');
    if (k === 'partner') { if (aud !== 'b2b') setAudience('b2b', true); reset(); return arg ? (bot('Hello! Here’s how that works.'), partnerTopic(arg)) : partnerMenu(); }
    reset();
    if (k === 'home') homeStart();
    else if (k === 'visit') visitStart();
    else if (k === 'centre') visitStart(arg);
    else if (k === 'track') track();
    else if (k === 'offers') offers();
    else if (k === 'campaign') showCampaign(arg);
    else if (k === 'faq') faq();
    else if (k === 'app') app();
    else if (k === 'call') { menu(); showCall(); }
    else menu();
  }
  function close() { root.classList.remove('open'); document.documentElement.classList.remove('mc-locked'); }
  function setAudience(a, silent) {
    aud = a === 'b2b' ? 'b2b' : 'patients';
    root.setAttribute('data-aud', aud);
    root.querySelector('.mc-title').textContent = aud === 'b2b' ? 'Partner desk' : 'MedRelief assistant';
    if (!silent) { reset(); aud === 'b2b' ? partnerMenu() : menu(); }
  }

  root.querySelectorAll('.mc-tab').forEach(function (t) { t.addEventListener('click', function () { t.getAttribute('data-tab') === 'call' ? showCall() : showChat(); }); });
  root.querySelector('.mc-restart').addEventListener('click', function () { reset(); aud === 'b2b' ? partnerMenu() : menu(); showChat(); });
  root.querySelector('.mc-close').addEventListener('click', close);
  root.querySelector('.mc-launch-open').addEventListener('click', function () { if (!log.children.length) open(aud === 'b2b' ? 'partner' : 'menu'); else { root.classList.add('open'); document.documentElement.classList.add('mc-locked'); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('open')) close(); });
  // Any element with data-chat="<intent>" on the page drives the assistant.
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-chat]');
    if (!t) return; e.preventDefault(); open(t.getAttribute('data-chat'));
  });

  window.MRChat = { open: open, close: close, setAudience: setAudience };
  setAudience(document.body.getAttribute('data-view') === 'b2b' ? 'b2b' : 'patients', true);
  // Docked (desktop) the assistant is always visible, so greet straight away.
  aud === 'b2b' ? partnerMenu() : menu();
})();
