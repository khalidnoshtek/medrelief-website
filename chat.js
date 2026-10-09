/* Med Relief assistant — a guided chat that books and takes payment for home
 * collections, books centre visits, tracks reports, answers price questions and
 * signs up partners. Patient text is bilingual (i18n.js); partner text is English.
 *
 * Home collection (MR_CONFIG.api.baseUrl set):
 *   location check (≤ radiusKm of the lab) → details → slot → summary →
 *   POST /public/home-collection/orders (server re-prices + re-checks the radius) →
 *   Razorpay Checkout (UPI) → POST /orders/:ref/verify → booked; the bill appears
 *   in the staff app as an "Online order". Without an API it hands off to a call.
 *
 * Public surface: window.MRChat.open(intent) — intents: menu | home | visit | track |
 * offers | faq | app | call | campaign:<code> | centre:<id> | partner | partner:<topic>.
 */
(function () {
  'use strict';
  var C = window.MR_CONFIG || {};
  var t = window.MR_T || function (k) { return k; };
  var lang = function () { return window.MR_LANG ? window.MR_LANG() : 'en'; };
  var API = (C.api && C.api.baseUrl) ? C.api.baseUrl.replace(/\/$/, '') : '';
  // In-chat payment is on only when the backend says so (live Razorpay keys). Until the
  // status call answers true, every booking hands off to a call.
  var ONLINE = false;
  // Hidden staff switch: ?testpay=1 (remembered for the tab, ?testpay=0 clears) runs a
  // Razorpay TEST-mode checkout when the backend only has test keys. Bannered, no real
  // money; ordinary visitors never see it.
  var TEST = false;
  var API_OK = false;       // the booking API answered — returning-patient lookup available
  try {
    var tp = new URLSearchParams(location.search).get('testpay');
    if (tp === '1') sessionStorage.setItem('mr_testpay', '1');
    if (tp === '0') sessionStorage.removeItem('mr_testpay');
  } catch (e) {}
  var wantTest = false;
  try { wantTest = sessionStorage.getItem('mr_testpay') === '1'; } catch (e) {}
  if (API) {
    fetch(API + '/public/home-collection/status', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (r) {
        API_OK = !!r;
        TEST = !!(r && !r.online_payment && r.test_payment && wantTest);
        ONLINE = !!(r && r.online_payment) || TEST;
        window.MR_ONLINE = ONLINE;
        if (TEST) {
          var bar = document.createElement('div');
          bar.className = 'mc-testbar';
          bar.textContent = 'TEST MODE — Razorpay test payments, no real money';
          var head = root.querySelector('.mc-head'); head.parentNode.insertBefore(bar, head.nextSibling);
        }
        document.dispatchEvent(new CustomEvent('mr:online', { detail: ONLINE }));
      })
      .catch(function () { /* stays in hand-off mode */ });
  }
  var HC = C.homeCollection || {};
  var KM = HC.radiusKm || 15;
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
    key: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9.2-9.2M17 6l3 3"/>',
    pin: '<path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.4"/>',
    upi: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>'
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

  var aud = 'patients';
  var expect = null;           // { placeholder, type, validate(v) -> error|null, then(v) }
  var B = {};                  // current booking / lead draft
  var queue = Promise.resolve();
  // The step on screen now, so a language switch can re-ask it without losing the draft.
  var resume = null;
  var gen = 0;                 // bumped on reset so a flow still 'typing' can't leak into the next one
  function later(fn) { var g = gen; queue = queue.then(function () { if (g === gen) return fn(); }); return queue; }

  // ── message primitives ─────────────────────────────────────────────────────
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
        }, reduce ? 0 : typeof content === 'string' ? 380 : 160);
      });
    });
  }
  function wide(node) { later(function () { log.appendChild(h('div', { class: 'mc-msg mc-bot mc-wide' }, [node])); scroll(); }); }
  function me(text) { log.appendChild(h('div', { class: 'mc-msg mc-me', text: text })); scroll(); }
  // Predefined options. Each: { l: label, go: fn, i: icon, p: primary, href }
  function choose(list) {
    later(function () {
      var row = h('div', { class: 'mc-chips', role: 'group' });
      list.forEach(function (o) {
        var cls = 'mc-chip' + (o.p ? ' mc-chip-pri' : '');
        var el;
        if (o.href) {
          el = h('a', { class: cls, href: o.href, target: o.href.indexOf('http') === 0 ? '_blank' : null, rel: 'noopener' });
        } else {
          el = h('button', { class: cls, type: 'button' });
          el.addEventListener('click', function () { row.remove(); expect = null; setPlaceholder(); me(o.l); o.go(); });
        }
        el.innerHTML = (o.i ? ico(o.i, 15) : '') + '<span></span>';
        el.querySelector('span').textContent = o.l;
        row.appendChild(el);
      });
      log.appendChild(row); scroll();
    });
  }
  function clearChips() { [].slice.call(log.querySelectorAll('.mc-chips')).forEach(function (r) { r.remove(); }); }
  var pendingAsks = 0;         // questions queued but not yet on screen
  function ask(opt) {
    pendingAsks++;
    later(function () {
      pendingAsks = Math.max(0, pendingAsks - 1);
      expect = opt; setPlaceholder(opt.placeholder, opt.type);
      if (window.matchMedia('(min-width:1080px)').matches || root.classList.contains('open')) input.focus({ preventScroll: true });
    });
  }
  function setPlaceholder(p, type) {
    input.placeholder = p || t('input_ph');
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
  function nm(o) { return (lang() === 'hi' && o.name_hi) || o.name; }
  function menuAgain() { menu(t('greet_again')); }

  // ── validators ─────────────────────────────────────────────────────────────
  function vName(v) { return v.trim().length >= 2 ? null : t('v_name'); }
  function normMobile(v) { var d = v.replace(/\D/g, ''); if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2); if (d.length === 11 && d[0] === '0') d = d.slice(1); return d; }
  function vMobile(v) { return /^[6-9]\d{9}$/.test(normMobile(v)) ? null : t('v_mobile'); }
  function vAge(v) { var n = parseInt(v, 10); return (/^\d{1,3}$/.test(v.trim()) && n >= 0 && n <= 120) ? null : t('v_age'); }
  function vPin(v) { return /^\d{6}$/.test(v.replace(/\s/g, '')) ? null : t('v_pin'); }
  function vText(min) { return function (v) { return v.trim().length >= min ? null : t('v_text'); }; }

  // ── dates & slots ──────────────────────────────────────────────────────────
  function isoDay(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dayLabel(d, i) {
    var s = d.toLocaleDateString(lang() === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    return i === 0 ? t('today') + ', ' + s : i === 1 ? t('tomorrow') + ', ' + s : s;
  }
  function slotsFor(kind, date) {
    var all = ((C.slots || {})[kind]) || [];
    var now = new Date();
    if (isoDay(date) !== isoDay(now)) return all;
    return all.filter(function (s) { return s.start > now.getHours() + 1; });
  }
  function pickDay(kind, then) {
    resume = function () { pickDay(kind, then); };
    var days = [], n = (C.slots && C.slots.daysAhead) || 3;
    for (var i = 0; i <= n; i++) {
      var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i);
      if (slotsFor(kind, d).length) days.push({ d: d, i: i });
    }
    bot(t('ask_day'));
    choose(days.slice(0, n).map(function (x) {
      return { l: dayLabel(x.d, x.i), go: function () { B.date = isoDay(x.d); B.dateLabel = dayLabel(x.d, x.i); pickSlot(kind, x.d, then); } };
    }));
  }
  function pickSlot(kind, d, then) {
    resume = function () { pickSlot(kind, d, then); };
    bot(t('ask_slot'));
    choose(slotsFor(kind, d).map(function (s) { return { l: s.label, go: function () { B.slot = s; then(); } }; }));
  }

  // ── catalogue ──────────────────────────────────────────────────────────────
  function campaigns() { return (C.campaigns || []).filter(function (c) { return c.active !== false; }); }
  function camp(code) { return campaigns().filter(function (c) { return c.code === code; })[0]; }
  function mrpOf(c) { return c.tests.reduce(function (s, x) { return s + x[1]; }, 0); }
  function pkgItem(c) { return { type: 'PACKAGE', code: c.code, name: c.name, name_hi: c.name_hi, price: c.price, mrp: mrpOf(c) }; }
  function estimate() { return (B.items || []).reduce(function (s, it) { return s + it.price; }, 0); }

  function offerCard(c, opts) {
    var mrp = mrpOf(c), save = mrp - c.price, hi = lang() === 'hi';
    var list = h('ul', { class: 'mc-inc' });
    c.tests.forEach(function (x) { list.appendChild(h('li', {}, [h('span', { text: x[0] }), h('span', { class: 'mc-inc-p', text: inr(x[1]) })])); });
    return h('div', { class: 'mc-card mc-offer' }, [
      h('div', { class: 'mc-offer-top' }, [h('span', { class: 'mc-tag', text: (hi && c.tag_hi) || c.tag || 'Offer' }), h('span', { class: 'mc-offer-n', text: t('tests_n', { n: c.tests.length }) })]),
      h('div', { class: 'mc-offer-name', text: nm(c) }),
      h('p', { class: 'mc-offer-blurb', text: (hi && c.blurb_hi) || c.blurb || '' }),
      h('div', { class: 'mc-price' }, [
        h('b', { text: inr(c.price) }), h('s', { text: inr(mrp) }),
        save > 0 ? h('span', { class: 'mc-save', text: t('save') + ' ' + inr(save) + ' (' + Math.round(save * 100 / mrp) + '%)' }) : null
      ]),
      h('details', { class: 'mc-details', open: opts && opts.open ? true : null }, [h('summary', { text: t('included') }), list,
        h('div', { class: 'mc-inc-total' }, [h('span', { text: t('standard_price') }), h('span', { text: inr(mrp) })])]),
      c.fasting ? h('div', { class: 'mc-note', text: t('fast_note') }) : null,
      h('div', { class: 'mc-actions' }, [
        btn(t('btn_home'), 'home', function () { clearChips(); me(t('btn_home') + ' — ' + nm(c)); homeStart(c); }, 'mc-btn-pri'),
        btn(t('btn_visit'), 'visit', function () { clearChips(); me(t('btn_visit') + ' — ' + nm(c)); visitStart(null, c); })
      ])
    ]);
  }

  // ── PATIENT: menu ──────────────────────────────────────────────────────────
  function menu(greet) {
    resume = function () { menu(t('greet_again')); };
    B = {};
    bot((greet || t('greet')) + '<br><span class="mc-hint">' + t('tap_hint') + '</span>');
    choose([
      { l: t('m_home'), i: 'home', go: function () { homeStart(); } },
      { l: t('m_visit'), i: 'visit', go: function () { visitStart(); } },
      { l: t('m_track'), i: 'track', go: track },
      { l: t('m_offers'), i: 'tag', go: offers },
      { l: t('m_faq'), i: 'help', go: faq },
      { l: t('m_app'), i: 'app', go: app },
      { l: t('m_call'), i: 'phone', go: call }
    ]);
  }
  function andThen() {
    resume = andThen;
    choose([
      { l: t('m_book_home'), i: 'home', go: function () { homeStart(); } },
      { l: t('m_menu'), i: 'back', go: menuAgain }
    ]);
  }

  // ── HOME COLLECTION ────────────────────────────────────────────────────────
  function newKey() { return String(Date.now()) + Math.random().toString(36).slice(2, 8); }
  function homeStart(c) {
    B = { kind: 'home', items: [], key: newKey() };
    if (c) { B.items = [pkgItem(c)]; bot(t('home_with', { name: esc(nm(c)) })); return homeMobile(); }
    homeWhat();
  }
  function homeWhat() {
    resume = homeWhat;
    bot(t('home_intro', { km: KM }));
    choose([
      { l: t('o_offer'), i: 'tag', go: function () { pickPackage(homeMobile); } },
      { l: t('o_tests'), i: 'list', go: function () { pickTests(homeMobile); } },
      { l: t('o_rx'), i: 'rx', go: function () {
        bot(t('rx_home')); bot(t('rx_pick'));
        choose([{ l: t('o_offer'), i: 'tag', go: function () { pickPackage(homeMobile); } }, { l: t('o_tests'), i: 'list', go: function () { pickTests(homeMobile); } }, { l: t('m_call'), i: 'phone', go: call }]);
      } },
      { l: t('o_notsure'), i: 'help', go: function () { bot(t('notsure_home')); call(); } }
    ]);
  }
  function pickPackage(next) {
    resume = function () { pickPackage(next); };
    bot(t('pick_offer'));
    later(function () {
      var wrap = h('div', { class: 'mc-pick' });
      campaigns().forEach(function (c) {
        var mrp = mrpOf(c);
        wrap.appendChild(h('div', { class: 'mc-pick-row' }, [
          h('div', {}, [h('b', { text: nm(c) }), h('small', {}, [t('tests_n', { n: c.tests.length }) + ' · ', h('b', { class: 'mc-pp', text: inr(c.price) }), ' ', h('s', { text: inr(mrp) })])]),
          btn(t('choose'), null, function () {
            wrap.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
            me(nm(c)); B.items = [pkgItem(c)]; next();
          }, 'mc-btn-sm')
        ]));
      });
      log.appendChild(h('div', { class: 'mc-msg mc-bot mc-wide' }, [wrap])); scroll();
    });
  }
  function pickTests(next) {
    resume = function () { pickTests(next); };
    bot(t('pick_tests'));
    later(function () {
      var chosen = {};
      var total = h('b', { text: inr(0) });
      var box;
      var done = btn(t('done'), 'check', function () {
        var codes = Object.keys(chosen); if (!codes.length) return;
        box.querySelectorAll('input,button').forEach(function (x) { x.disabled = true; });
        B.items = codes.map(function (k) { return chosen[k]; });
        me(B.items.map(nm).join(', '));
        if (B.items.some(function (i) { return i.fasting; })) bot(t('fast_warn'));
        next();
      }, 'mc-btn-pri');
      done.disabled = true;
      var list = h('div', { class: 'mc-checks' });
      (C.tests || []).forEach(function (x) {
        var cb = h('input', { type: 'checkbox', value: x.code });
        cb.addEventListener('change', function () {
          if (cb.checked) chosen[x.code] = { type: 'TEST', code: x.code, name: x.name, name_hi: x.name_hi, price: x.mrp, mrp: x.mrp, fasting: !!x.fasting };
          else delete chosen[x.code];
          total.textContent = inr(Object.keys(chosen).reduce(function (s, k) { return s + chosen[k].price; }, 0));
          done.disabled = !Object.keys(chosen).length;
        });
        list.appendChild(h('label', { class: 'mc-check' }, [cb, h('span', { text: nm(x) }), h('span', { class: 'mc-inc-p', text: inr(x.mrp) })]));
      });
      box = h('div', { class: 'mc-card' }, [list, h('div', { class: 'mc-checks-foot' }, [h('span', {}, [t('estimate') + ' ', total]), done])]);
      log.appendChild(h('div', { class: 'mc-msg mc-bot mc-wide' }, [box])); scroll();
    });
  }
  // ── number first: OTP, then pick an existing patient on that number ──────
  function homeMobile() { mobile(function () { identify(homeName, homeLocation); }); }
  // Already know who it is (switched over from home collection): don't ask again.
  function visitMobile() {
    if (B.mobile && B.name) return summary();
    if (B.mobile) return identify(visitName, summary);
    mobile(function () { identify(visitName, summary); });
  }
  // Home collection → centre visit (out of area, or the patient prefers it): keep the
  // tests and everything already given — mobile, verified identity, name, age, gender.
  function homeToVisit() {
    var keep = { items: B.items, mobile: B.mobile, token: B.token, patientRef: B.patientRef, name: B.name, gender: B.gender, age: B.age };
    visitStart();
    Object.keys(keep).forEach(function (k) { if (keep[k] != null) B[k] = keep[k]; });
    if (!B.items) B.items = [];
  }
  function identify(asNew, asKnown) {
    if (!API_OK) return asNew();
    var g = gen;
    fetch(API + '/public/home-collection/lookup/request-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile: B.mobile }) })
      .then(function (r) {
        if (g !== gen) return;
        if (r.status === 404) return asNew();   // older backend without the lookup: just continue
        if (!r.ok) throw r;
        askOtp(asNew, asKnown, 0);
      })
      .catch(function () { if (g !== gen) return; bot(t('otp_send_fail')); asNew(); });
  }
  function askOtp(asNew, asKnown, tries) {
    resume = function () { askOtp(asNew, asKnown, tries); };
    bot(t('otp_sent', { m: B.mobile.replace(/(\d{2})\d{6}(\d{2})/, '$1••••••$2') }));
    choose([{ l: t('otp_skip'), i: 'user', go: function () { expect = null; setPlaceholder(); asNew(); } }]);
    ask({ placeholder: t('ph_otp'), type: 'number', validate: function (v) { return /^\d{4,8}$/.test(v.trim()) ? null : t('otp_bad'); }, then: function (v) {
      var g = gen;
      fetch(API + '/public/home-collection/lookup/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile: B.mobile, code: v.trim() }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); })
        .then(function (r) {
          if (g !== gen) return;
          B.token = r.token;
          var list = r.patients || [];
          if (!list.length) { bot(t('new_here')); return asNew(); }
          pickPatient(list, asNew, asKnown);
        })
        .catch(function () {
          if (g !== gen) return;
          if (tries >= 2) { bot(t('otp_give_up')); return asNew(); }
          bot(t('otp_bad')); clearChips(); askOtp(asNew, asKnown, tries + 1);
        });
    } });
  }
  function pickPatient(list, asNew, asKnown) {
    resume = function () { pickPatient(list, asNew, asKnown); };
    bot(t('who_is_it'));
    choose(list.map(function (p) {
      var g = p.gender ? t('g_' + p.gender) : '';
      return { l: p.name + (p.age_years != null ? ' · ' + p.age_years : '') + (g ? ' · ' + g : ''), i: 'user', go: function () {
        B.patientRef = p.patient_ref; B.name = p.name; B.gender = p.gender || 'OTHER'; B.age = p.age_years != null ? p.age_years : null;
        bot(t('welcome_back', { name: esc(p.name.split(' ')[0]) })); asKnown();
      } };
    }).concat([{ l: t('someone_else'), i: 'help', go: function () { asNew(); } }]));
  }

  function homeName() {
    resume = homeName;
    bot(t('ask_name'));
    ask({ placeholder: t('ph_name'), type: 'name', validate: vName, then: function (v) { B.name = v.trim(); homeGender(); } });
  }
  function homeGender() {
    resume = homeGender;
    bot(t('ask_gender'));
    choose(['MALE', 'FEMALE', 'OTHER'].map(function (g) { return { l: t('g_' + g), go: function () { B.gender = g; homeAge(); } }; }));
  }
  function homeAge() {
    resume = homeAge;
    bot(t('ask_age'));
    ask({ placeholder: t('ph_age'), type: 'number', validate: vAge, then: function (v) { B.age = parseInt(v, 10); homeLocation(); } });
  }
  function mobile(next) {
    resume = function () { mobile(next); };
    bot(t('ask_mobile_first'));
    ask({ placeholder: t('ph_mobile'), type: 'tel', validate: vMobile, then: function (v) { B.mobile = normMobile(v); next(); } });
  }

  // 15 km rule: the browser checks first; the server re-checks on the order.
  function distanceKm(lat1, lng1, lat2, lng2) {
    var R = 6371, r = function (d) { return d * Math.PI / 180; };
    var a = Math.pow(Math.sin(r(lat2 - lat1) / 2), 2) + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.pow(Math.sin(r(lng2 - lng1) / 2), 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  function homeLocation() {
    resume = homeLocation;
    bot(t('ask_location', { km: KM }));
    choose([
      { l: t('share_loc'), i: 'pin', p: true, go: locate },
      { l: t('btn_visit'), i: 'visit', go: homeToVisit },
      { l: t('m_call'), i: 'phone', go: call }
    ]);
  }
  function locFail(key) {
    resume = function () { locFail(key); };
    bot(t(key));
    choose([{ l: t('try_again'), i: 'pin', p: true, go: locate }, { l: t('btn_visit'), i: 'visit', go: homeToVisit }, { l: t('m_call'), i: 'phone', go: call }]);
  }
  function locate() {
    if (!navigator.geolocation) return locFail('loc_unsupported');
    bot(t('loc_wait'));
    var g = gen;
    navigator.geolocation.getCurrentPosition(function (pos) {
      if (g !== gen) return;
      B.lat = pos.coords.latitude; B.lng = pos.coords.longitude;
      var lab = HC.lab || {};
      var local = distanceKm(B.lat, B.lng, lab.lat, lab.lng);
      var decide = function (covered, d) {
        B.distance = Math.round(d * 10) / 10;
        if (!covered) {
          bot(t('loc_far', { d: B.distance, km: KM }));
          return choose([{ l: t('btn_visit'), i: 'visit', p: true, go: homeToVisit }, { l: t('m_call'), i: 'phone', go: call }]);
        }
        bot(t('loc_ok', { d: B.distance }));
        homeAddress();
      };
      if (!API) return decide(local <= KM, local);
      fetch(API + '/public/home-collection/coverage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: B.lat, lng: B.lng }) })
        .then(function (r) { return r.ok ? r.json() : null; })
        // Only a real yes/no from the server overrides the browser's check (an old
        // backend without this endpoint answers 404 — that is not "out of area").
        .then(function (r) { if (r && typeof r.covered === 'boolean') decide(r.covered, r.distance_km != null ? r.distance_km : local); else decide(local <= KM, local); })
        .catch(function () { decide(local <= KM, local); });
    }, function (err) {
      if (g !== gen) return;
      locFail(err && err.code === 1 ? 'loc_denied' : 'loc_denied');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }
  function homeAddress() {
    resume = homeAddress;
    bot(t('ask_address'));
    ask({ placeholder: t('ph_address'), validate: vText(8), then: function (v) { B.address = v.trim(); homePin(); } });
  }
  function homePin() {
    resume = homePin;
    bot(t('ask_pin'));
    ask({ placeholder: t('ph_pin'), type: 'number', validate: vPin, then: function (v) { B.pincode = v.replace(/\s/g, ''); pickDay('home', summary); } });
  }

  // ── CENTRE VISIT ───────────────────────────────────────────────────────────
  function visitStart(centreId, c) {
    B = { kind: 'visit', items: [], key: newKey() };
    if (c) B.items = [pkgItem(c)];
    var centre = (C.centres || []).filter(function (x) { return x.id === centreId; })[0];
    if (centre) { B.centre = centre; bot(t('visit_at', { c: esc(centre.name) })); return pickDay('centre', visitTests); }
    visitWhere();
  }
  function visitWhere() {
    resume = visitWhere;
    bot(t('ask_centre'));
    choose((C.centres || []).map(function (x) { return { l: x.name, go: function () { B.centre = x; pickDay('centre', visitTests); } }; }));
  }
  function visitTests() {
    resume = visitTests;
    if (B.items.length) return visitMobile();
    bot(t('visit_tests'));
    choose([
      { l: t('o_offer'), i: 'tag', go: function () { pickPackage(visitMobile); } },
      { l: t('o_tests'), i: 'list', go: function () { pickTests(visitMobile); } },
      { l: t('o_rx'), i: 'rx', go: function () { B.rx = true; bot(t('rx_visit')); visitMobile(); } },
      { l: t('o_decide'), i: 'help', go: visitMobile }
    ]);
  }
  function visitName() {
    resume = visitName;
    bot(t('ask_name_visit'));
    ask({ placeholder: t('ph_fullname'), type: 'name', validate: vName, then: function (v) { B.name = v.trim(); summary(); } });
  }

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  function row(k, v) { return h('div', { class: 'mc-row' }, [h('span', { text: k }), h('b', { text: v })]); }
  function summary() {
    resume = summary;
    var home = B.kind === 'home';
    bot(home ? t('sum_home') : t('sum_visit'));
    later(function () {
      var est = estimate(), mrp = (B.items || []).reduce(function (s, i) { return s + i.mrp; }, 0);
      var lines = h('div', { class: 'mc-lines' });
      (B.items || []).forEach(function (it) {
        lines.appendChild(h('div', { class: 'mc-line' }, [h('span', { text: nm(it) }), h('span', {}, [it.mrp > it.price ? h('s', { text: inr(it.mrp) }) : null, ' ', h('b', { text: inr(it.price) })])]));
      });
      if (B.rx) lines.appendChild(h('div', { class: 'mc-line' }, [h('span', { text: t('s_rx_line') }), h('span', { class: 'mc-muted', text: t('s_rx_counter') })]));
      var cb = h('input', { type: 'checkbox' });
      var go, edit;
      var payOnline = home && ONLINE;
      var goLabel = payOnline ? t('pay_btn', { amt: inr(est) }) : home ? t('confirm_booking') : t('confirm_visit');
      go = btn(goLabel, payOnline ? 'upi' : 'check', function () {
        if (!cb.checked) return; go.disabled = true; edit.disabled = true; cb.disabled = true;
        me(goLabel);
        home ? payHome() : handoff();
      }, 'mc-btn-pri mc-btn-block');
      go.disabled = true;
      cb.addEventListener('change', function () { go.disabled = !cb.checked; });
      edit = btn(t('start_again'), 'back', function () { go.disabled = true; edit.disabled = true; me(t('start_again')); home ? homeStart() : visitStart(); });
      var gender = B.gender ? t('g_' + B.gender) : '';
      var card = h('div', { class: 'mc-card mc-summary' }, [
        h('div', { class: 'mc-sum-h', text: home ? t('s_home') : t('s_visit', { c: B.centre.name }) }),
        row(t('s_patient'), B.name + (home ? (B.age != null ? ' · ' + B.age : '') + (gender ? ' · ' + gender : '') : '')),
        row(t('s_mobile'), B.mobile.replace(/(\d{5})(\d{5})/, '$1 $2')),
        home ? row(t('s_address'), B.address + ', ' + B.pincode) : row(t('s_centre'), B.centre.address),
        row(t('s_when'), B.dateLabel + ' · ' + B.slot.label),
        lines,
        (B.items && B.items.length) ? h('div', { class: 'mc-total' }, [h('span', { text: payOnline ? t('s_total') : B.rx ? t('s_est_sofar') : t('s_est') }), h('span', {}, [mrp > est ? h('s', { text: inr(mrp) }) : null, ' ', h('b', { text: inr(est) })])]) : null,
        h('p', { class: 'mc-note', text: payOnline ? t('note_home') : home ? t('note_home_call') : t('note_visit') }),
        h('label', { class: 'mc-consent' }, [cb, h('span', { html: t('consent') })]),
        h('div', { class: 'mc-actions mc-actions-col' }, [go, edit])
      ]);
      log.appendChild(h('div', { class: 'mc-msg mc-bot mc-wide' }, [card])); scroll();
    });
  }

  // ── PAY (home collection) ──────────────────────────────────────────────────
  function post(path, body) {
    return fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }  /* only CORS-allowed headers: the API rejects others at preflight */, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { j.status = r.status; throw j; } return j; }); });
  }
  function payHome() {
    if (!ONLINE) return handoff();
    bot(t('creating'));
    post('/public/home-collection/orders', {
      source: 'WEBSITE_CHAT', language: lang(), test_payment: TEST,
      patient: { name: B.name, mobile: B.mobile, age: B.age, gender: B.gender },
      patient_token: B.token || null, patient_ref: B.patientRef || null,
      items: B.items.map(function (i) { return { type: i.type, code: i.code }; }),
      address: { line: B.address, pincode: B.pincode },
      location: { lat: B.lat, lng: B.lng },
      slot: { date: B.date, start_hour: B.slot.start, label: B.slot.label },
      estimate_inr: estimate(),
      consent: { policy: 'privacy.html', accepted_at: new Date().toISOString() }
    }).then(function (r) {
      B.order = r;
      if (Math.round(r.total_inr) !== Math.round(estimate())) bot(t('price_changed', { amt: inr(r.total_inr) }));
      checkout();
    }).catch(function (e) {
      if (e && e.error === 'OUT_OF_COVERAGE') { bot(t('out_of_coverage', { km: KM })); return choose([{ l: t('btn_visit'), i: 'visit', go: homeToVisit }, { l: t('m_call'), i: 'phone', go: call }]); }
      bot(t('order_fail')); handoff(true);
    });
  }
  function loadRazorpay() {
    if (window.Razorpay) return Promise.resolve();
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = (C.razorpay && C.razorpay.script) || 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = function () { res(); }; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  function checkout() {
    var o = B.order, rz = o.razorpay;
    bot(t('opening_upi'));
    if (rz.is_mock) {
      // Staging with RAZORPAY_MOCK=true: no gateway; the backend accepts any signature.
      return later(function () { verify({ razorpay_order_id: rz.order_id, razorpay_payment_id: 'pay_mock_' + Date.now(), razorpay_signature: 'mock' }); });
    }
    loadRazorpay().then(function () {
      var done = false;
      var rzp = new window.Razorpay({
        key: rz.key_id, order_id: rz.order_id, amount: rz.amount_paise, currency: rz.currency || 'INR',
        name: 'Med Relief Diagnostics', description: o.order_ref,
        image: new URL('assets/brand/maskable-192.png', location.href).href,
        prefill: { name: B.name, contact: '+91' + B.mobile },
        notes: { order_ref: o.order_ref },
        theme: { color: (C.razorpay && C.razorpay.brandColor) || '#86198F' },
        config: { display: { blocks: { upi: { name: 'UPI', instruments: [{ method: 'upi' }] } }, sequence: ['block.upi'], preferences: { show_default_blocks: false } } },
        handler: function (resp) { done = true; verify(resp); },
        modal: { ondismiss: function () { if (!done) payCancelled(); } }
      });
      rzp.on('payment.failed', function () { /* the modal stays open to retry; ondismiss covers giving up */ });
      rzp.open();
    }).catch(function () { bot(t('order_fail')); handoff(true); });
  }
  function payCancelled() {
    bot(t('pay_cancel'));
    choose([{ l: t('pay_retry'), i: 'upi', p: true, go: checkout }, { l: t('m_call'), i: 'phone', go: call }]);
  }
  function verify(resp) {
    bot(t('verifying'));
    var o = B.order;
    var when = B.dateLabel + ' · ' + B.slot.label;
    post('/public/home-collection/orders/' + encodeURIComponent(o.order_ref) + '/verify', resp)
      .then(function (r) {
        bot(t('paid_ok', { ref: esc(r.order_ref || o.order_ref), when: esc(when), bill: r.bill_number ? t('paid_bill', { b: esc(r.bill_number) }) : '' }));
        andThen();
      })
      .catch(function () {
        // The Razorpay webhook completes the booking even if this call fails.
        bot(t('paid_pending', { ref: esc(o.order_ref), phone: C.phoneDisplay }));
        andThen();
      });
  }

  // ── hand-off (no API / API down / centre visit) ────────────────────────────
  function summaryText() {
    var home = B.kind === 'home';
    return [
      home ? 'HOME COLLECTION REQUEST' : 'CENTRE VISIT REQUEST — ' + B.centre.name,
      'Patient: ' + B.name + (home ? ' (' + B.age + ', ' + B.gender.charAt(0) + B.gender.slice(1).toLowerCase() + ')' : ''),
      'Mobile: ' + B.mobile,
      home ? 'Address: ' + B.address + ', ' + B.pincode + (B.distance != null ? ' (' + B.distance + ' km from lab)' : '') : null,
      'When: ' + B.date + ', ' + B.slot.label,
      'Tests: ' + ((B.items && B.items.length) ? B.items.map(function (i) { return i.name; }).join(', ') : B.rx ? 'As per prescription' : 'To decide at the centre'),
      (B.items && B.items.length) ? 'Estimate: ' + inr(estimate()) : null
    ].filter(Boolean).join('\n');
  }
  function handoff(afterError) {
    if (!afterError) bot(t('handoff', { name: esc(B.name.split(' ')[0]) }));
    later(function () {
      var txt = summaryText();
      var copyBtn = btn(t('copy'), 'copy', function () {
        var ok = function () { copyBtn.querySelector('span').textContent = t('copied'); };
        if (navigator.clipboard) navigator.clipboard.writeText(txt).then(ok, function () {}); else ok();
      });
      var acts = [linkBtn(t('call_phone', { phone: C.phoneDisplay }), 'phone', tel(), 'mc-btn-pri'), copyBtn];
      if (C.whatsapp) acts.push(linkBtn('WhatsApp', 'msg', 'https://wa.me/' + C.whatsapp.replace(/\D/g, '') + '?text=' + encodeURIComponent(txt)));
      log.appendChild(h('div', { class: 'mc-msg mc-bot mc-wide' }, [h('div', { class: 'mc-card' }, [h('pre', { class: 'mc-pre', text: txt }), h('div', { class: 'mc-actions' }, acts)])])); scroll();
    });
    andThen();
  }

  // ── TRACK / OFFERS / FAQ / APP / CALL ──────────────────────────────────────
  function track() {
    resume = track;
    bot(t('track_intro'));
    wide(h('div', { class: 'mc-card' }, [
      h('div', { class: 'mc-step' }, [h('span', { class: 'mc-num', text: '1' }), h('span', { html: t('track_1') })]),
      h('div', { class: 'mc-step' }, [h('span', { class: 'mc-num', text: '2' }), h('span', { html: t('track_2') })]),
      h('div', { class: 'mc-actions' }, [linkBtn(t('open_portal'), 'link', C.apps.patientWeb, 'mc-btn-pri'), linkBtn(t('call_phone', { phone: C.phoneDisplay }), 'phone', tel())])
    ]));
    choose([{ l: t('m_app'), i: 'app', go: app }, { l: t('m_menu'), i: 'back', go: menuAgain }]);
  }
  function offers() {
    resume = offers;
    bot(t('offers_intro'));
    campaigns().forEach(function (c) { bot(offerCard(c)); });
    choose([{ l: t('single_tests'), i: 'list', go: function () { homeStart(); } }, { l: t('m_menu'), i: 'back', go: menuAgain }]);
  }
  function showCampaign(code) {
    resume = function () { showCampaign(code); };
    var c = camp(code);
    if (!c) return offers();
    bot(offerCard(c, { open: true }));
    choose([{ l: t('all_offers'), i: 'tag', go: offers }, { l: t('m_menu'), i: 'back', go: menuAgain }]);
  }
  function priceList() {
    bot(t('faq_a1'));
    var list = h('ul', { class: 'mc-inc' });
    (C.tests || []).forEach(function (x) { list.appendChild(h('li', {}, [h('span', { text: nm(x) }), h('span', { class: 'mc-inc-p', text: inr(x.mrp) })])); });
    wide(h('div', { class: 'mc-card' }, [list]));
    bot(t('faq_a1b'));
  }
  var FAQ = [
    { q: 'faq_q1', a: priceList },
    { q: 'faq_q2', a: function () { bot(t('faq_a2')); } },
    { q: 'faq_q3', a: function () { bot(t('faq_a3')); } },
    { q: 'faq_q4', a: function () { bot(t(ONLINE ? 'faq_a4' : 'faq_a4_call')); } },
    { q: 'faq_q5', a: function () { bot(t('faq_a5', { km: KM })); } },
    { q: 'faq_q6', a: function () { bot(t('faq_a6')); } }
  ];
  function faq() {
    resume = faq;
    bot(t('faq_intro'));
    choose(FAQ.map(function (f) { return { l: t(f.q), go: function () { f.a(); andThen(); } }; }).concat([{ l: t('m_menu'), i: 'back', go: menuAgain }]));
  }
  function app() {
    resume = app;
    bot(t('app_intro'));
    wide(h('div', { class: 'mc-card' }, [
      h('div', { class: 'mc-qr' }, [h('img', { src: 'assets/qr-patient-app.svg', alt: 'QR', width: '120', height: '120' }), h('span', { text: t('app_scan') })]),
      h('div', { class: 'mc-actions' }, [
        linkBtn(t('app_android'), 'app', C.apps.patientAndroid, 'mc-btn-pri'),
        C.apps.patientIos ? linkBtn('App Store', 'link', C.apps.patientIos) : h('span', { class: 'mc-muted mc-soon', text: t('app_ios_soon') })
      ])
    ]));
    andThen();
  }
  function call() { showCall(); bot(t('call_msg')); andThen(); }
  function showCall() { root.classList.add('calling'); callPane.hidden = false; chatPane.hidden = true; tab('call'); }
  function showChat() { root.classList.remove('calling'); callPane.hidden = true; chatPane.hidden = false; tab('chat'); }
  function tab(which) {
    root.querySelectorAll('.mc-tab').forEach(function (x) { var on = x.getAttribute('data-tab') === which; x.classList.toggle('on', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); });
  }

  // ── PARTNERS (English) ─────────────────────────────────────────────────────
  var PARTNER = {
    refer: { l: 'Refer patients (doctors & clinics)', i: 'user', a: 'Refer your patients to Med Relief for a centre visit or home collection. Their verified reports reach you in the Med Relief doctor app, with a statement of every referral.' },
    samples: { l: 'Send samples to Med Relief (labs)', i: 'lab', a: 'Send us the samples you don’t run in-house. We process them on connected analysers, a pathologist verifies every result, and the report comes back to you and your patient.' },
    agents: { l: 'Use Med Relief collection agents', i: 'bike', a: 'Our trained collection agents can pick up samples from your clinic or from your patients’ homes and bring them to our lab — barcoded and tracked.' },
    collect: { l: 'Become a collection agent', i: 'bike', a: 'Collection agents collect samples on Med Relief’s behalf — you don’t run the tests. You get assignments and addresses in our app, and hand samples over to our lab.' },
    api: { l: 'API or website integration', i: 'plug', a: 'Integrations (API access, results into your system, a booking link on your website) are set up by our team for approved partners — they aren’t self-service. Tell us what you need and we’ll plan it with you.' }
  };
  function partnerMenu(greet) {
    B = {};
    bot(greet || 'Hello! I help labs, doctors and collection agents partner with Med Relief. How would you like to work with us?');
    choose(Object.keys(PARTNER).map(function (k) { return { l: PARTNER[k].l, i: PARTNER[k].i, go: function () { partnerTopic(k); } }; }).concat([
      { l: 'Partner login', i: 'key', href: C.apps.partnerPortal },
      { l: 'Call us', i: 'phone', go: call }
    ]));
  }
  function partnerTopic(k) {
    var p = PARTNER[k]; if (!p) return partnerMenu();
    bot(p.a);
    choose([
      { l: 'Leave my details', i: 'check', p: true, go: function () { partnerLead(k); } },
      { l: 'Call us', i: 'phone', go: call },
      { l: 'Other options', i: 'back', go: function () { partnerMenu('How else can we work together?'); } }
    ]);
  }
  function partnerLead(k) {
    B = { kind: 'partner', topic: k };
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
    bot('Thank you, ' + esc(B.name.split(' ')[0]) + '. Send these details to our partnerships team with one tap, or call us:');
    wide(h('div', { class: 'mc-card' }, [h('pre', { class: 'mc-pre', text: txt }), h('div', { class: 'mc-actions' }, [
      linkBtn('Email this to us', 'mail', 'mailto:' + C.email + '?subject=' + encodeURIComponent('Partner enquiry — ' + B.org) + '&body=' + encodeURIComponent(txt), 'mc-btn-pri'),
      linkBtn('Call ' + C.phoneDisplay, 'phone', tel())
    ])]));
    choose([{ l: 'Other options', i: 'back', go: function () { partnerMenu('Anything else?'); } }]);
  }

  // ── free text → intent (English + Hindi / Hinglish keywords) ───────────────
  var INTENTS = [
    [/home|collect|ghar|door|pick ?up|घर|कलेक्शन/i, function () { homeStart(); }],
    [/track|status|where.*report|report.*(ready|kab)|रिपोर्ट कहाँ|रिपोर्ट कब/i, track],
    [/offer|package|campaign|discount|check ?up|nirogyam|full body|ऑफ़र|ऑफर|पैकेज|निरोग्यम/i, offers],
    [/visit|centre|center|appointment|schedule|slot|branch|सेंटर|विज़िट/i, function () { visitStart(); }],
    [/price|cost|rate|kitna|kitne|charge|fee|₹|rs\.?|कीमत|कितना|दाम/i, function () { priceList(); andThen(); }],
    [/fast|khali|empty stomach|खाली पेट/i, function () { bot(t('faq_a2')); andThen(); }],
    [/pay|upi|cash|card|भुगतान|पैसा/i, function () { bot(t(ONLINE ? 'faq_a4' : 'faq_a4_call')); andThen(); }],
    [/report|result|whatsapp|रिपोर्ट/i, function () { bot(t('faq_a6')); andThen(); }],
    [/app|download|install|qr|ऐप/i, app],
    [/call|phone|agent|human|talk|person|number|कॉल|फ़ोन|फोन|बात/i, call],
    [/^(hi|hello|hey|namaste|hlo|menu|start|नमस्ते|हेलो)/i, function () { menu(); }]
  ];
  var PARTNER_INTENTS = [
    [/refer|doctor|clinic/i, function () { partnerTopic('refer'); }],
    [/sample|lab|outsourc/i, function () { partnerTopic('samples'); }],
    [/become|join|agent|phlebo|collector/i, function () { partnerTopic('collect'); }],
    [/api|integrat|website|software/i, function () { partnerTopic('api'); }],
    [/call|phone|talk/i, call]
  ];
  function route(text) {
    var list = aud === 'b2b' ? PARTNER_INTENTS : INTENTS;
    for (var i = 0; i < list.length; i++) if (list[i][0].test(text)) { clearChips(); return list[i][1](); }
    bot(t('didnt_get', { phone: C.phoneDisplay }));
    return aud === 'b2b' ? partnerMenu('Here’s what I can help with:') : menu(t('here_is_help'));
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = input.value; if (!v.trim()) return;
    input.value = '';
    me(v);
    var run = function () {
      if (expect) {
        var ex = expect, err = ex.validate ? ex.validate(v) : null;
        if (err) { bot(err); return; }
        expect = null; setPlaceholder(); clearChips(); ex.then(v);
      } else route(v);
    };
    // Typed before the next question finished appearing: answer that question.
    if (!expect && pendingAsks > 0) later(run); else run();
  });

  // ── open / close / tabs / audience / language ──────────────────────────────
  function reset() { gen++; pendingAsks = 0; log.innerHTML = ''; expect = null; setPlaceholder(); queue = Promise.resolve(); }
  function open(intent) {
    root.classList.add('open'); document.documentElement.classList.add('mc-locked');
    showChat();
    intent = intent || 'menu';
    var p = intent.split(':'), k = p[0], arg = p.slice(1).join(':');
    if (k === 'partner') { if (aud !== 'b2b') setAudience('b2b', true); reset(); return arg ? partnerTopic(arg) : partnerMenu(); }
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
  function titleText() { return aud === 'b2b' ? t('chat_title_b2b') : t('chat_title'); }
  function setAudience(a, silent) {
    aud = a === 'b2b' ? 'b2b' : 'patients';
    root.setAttribute('data-aud', aud);
    root.querySelector('.mc-title').textContent = titleText();
    if (!silent) { reset(); aud === 'b2b' ? partnerMenu() : menu(); }
  }
  // Switching language keeps the conversation and everything typed so far; only the
  // question on screen is asked again in the new language (Khalid 2026-10-01).
  document.addEventListener('mr:lang', function () {
    root.querySelector('.mc-title').textContent = titleText();
    setPlaceholder(expect && expect.placeholderKey ? t(expect.placeholderKey) : null, expect && expect.type);
    if (aud === 'b2b') return;
    if (!log.children.length) return menu();
    clearChips(); expect = null; pendingAsks = 0; setPlaceholder();
    bot(t('lang_continue'));
    resume ? resume() : menu();
  });

  root.querySelectorAll('.mc-tab').forEach(function (x) { x.addEventListener('click', function () { x.getAttribute('data-tab') === 'call' ? showCall() : showChat(); }); });
  root.querySelector('.mc-restart').addEventListener('click', function () { reset(); aud === 'b2b' ? partnerMenu() : menu(); showChat(); });
  root.querySelector('.mc-close').addEventListener('click', close);
  root.querySelector('.mc-launch-open').addEventListener('click', function () { if (!log.children.length) open(aud === 'b2b' ? 'partner' : 'menu'); else { root.classList.add('open'); document.documentElement.classList.add('mc-locked'); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('open')) close(); });
  document.addEventListener('click', function (e) {
    var x = e.target.closest && e.target.closest('[data-chat]');
    if (!x) return; e.preventDefault(); open(x.getAttribute('data-chat'));
  });

  window.MRChat = { open: open, close: close, setAudience: setAudience };
  setAudience(document.body.getAttribute('data-view') === 'b2b' ? 'b2b' : 'patients', true);
  setPlaceholder();
  aud === 'b2b' ? partnerMenu() : menu();
})();
