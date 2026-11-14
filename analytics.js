/* Med Relief website — campaign measurement (Google Analytics 4 + Meta Pixel), consent first.
 *
 * Nothing loads and nothing is sent unless BOTH:
 *   1. config.js sets analytics.ga4 and/or analytics.metaPixel, and
 *   2. the visitor taps "Allow" on the banner (the choice is remembered on this device;
 *      "Cookie choices" in the footer asks again).
 *
 * What is sent: page views, taps on Call / WhatsApp / the chat / the /links buttons, and booking events with an
 * amount and our opaque order reference. NEVER names, mobile numbers, addresses, ages or
 * test/package names (DPDP, and Meta's rules for health-related advertisers).
 *
 * Campaign links: every ad link carries UTM tags, e.g.
 *   https://medrelief.co.in/?utm_source=facebook&utm_medium=paid_social&utm_campaign=eks-launch&utm_content=find-us
 * The first set seen in a visit is kept for that browser session (window.MR_UTM()).
 *
 * Other scripts report events through window.mrTrack(name, params); it is a no-op until
 * the visitor allows measurement.
 *
 * Anonymous visit count (2026-11-09) — runs for EVERY visitor, no consent needed because
 * nothing personal is sent or kept: once per browser tab, the landing page, the UTM tags
 * above and the referring site's host name (e.g. instagram.com) go to our own API
 * (POST /public/web-visits). No cookie is set (a sessionStorage flag stops a second count
 * in the same tab) and the server stores no IP address, device ID or user agent — only
 * "day × tags × page → a number". This is how the staff app's Reports → Patient sources
 * shows real Facebook / Instagram traffic; GA4 and the Pixel only see people who tap Allow.
 */
(function () {
  var C = (window.MR_CONFIG && window.MR_CONFIG.analytics) || {};
  var GA = String(C.ga4 || '').trim();
  var PX = String(C.metaPixel || '').trim();
  var KEY = 'mr_consent', UTM_KEY = 'mr_utm';
  var on = false;

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }

  // ── campaign tags (kept even without consent: they stay in this browser) ──
  // The FIRST set seen in this visit wins (2026-11-14): a link on our own pages (e.g. the
  // /links "Book here" buttons) must not overwrite the ad tags the visitor arrived with.
  var utm = {};
  try {
    var q = new URLSearchParams(location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'fbclid', 'gclid'].forEach(function (k) {
      var v = q.get(k); if (v) utm[k] = v.slice(0, 100);
    });
    var kept = JSON.parse(sessionStorage.getItem(UTM_KEY) || '{}') || {};
    if (Object.keys(kept).length) utm = kept;
    else if (Object.keys(utm).length) sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
  } catch (e) { utm = {}; }
  window.MR_UTM = function () { return utm; };

  // ── anonymous tap count (2026-11-14), same rules as the visit count below: no consent
  // needed because nothing personal is sent — the page, which button (action), its centre
  // or app, and the visit's UTM tags (POST /public/web-events). Fails silently. ──
  window.mrCount = function (action, centre) {
    var api = (window.MR_CONFIG && window.MR_CONFIG.api && window.MR_CONFIG.api.baseUrl) || '';
    if (!api || !action) return;
    var body = JSON.stringify({
      page: location.pathname, action: String(action), centre: String(centre || ''),
      utm_source: utm.utm_source || '', utm_medium: utm.utm_medium || '',
      utm_campaign: utm.utm_campaign || '', utm_content: utm.utm_content || '',
    });
    var url = api + '/public/web-events';
    try { if (navigator.sendBeacon && navigator.sendBeacon(url, body)) return; } catch (e) {}
    try { fetch(url, { method: 'POST', body: body, keepalive: true, mode: 'cors', credentials: 'omit' }).catch(function () {}); } catch (e) {}
  };

  // ── anonymous visit count (see the header: no cookie, nothing personal) ──
  (function countVisit() {
    try {
      if (sessionStorage.getItem('mr_counted')) return;
      sessionStorage.setItem('mr_counted', '1');
    } catch (e) { return; }   // storage blocked: skip, rather than count every page of the visit
    var api = (window.MR_CONFIG && window.MR_CONFIG.api && window.MR_CONFIG.api.baseUrl) || '';
    if (!api) return;
    var ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) { ref = ''; }
    var body = JSON.stringify({
      page: location.pathname,
      utm_source: utm.utm_source || '', utm_medium: utm.utm_medium || '',
      utm_campaign: utm.utm_campaign || '', utm_content: utm.utm_content || '',
      ref: ref,
    });
    var url = api + '/public/web-visits';
    try { if (navigator.sendBeacon && navigator.sendBeacon(url, body)) return; } catch (e) {}
    // Fallback: a plain-text POST (no custom headers, so no CORS preflight), no cookies.
    try { fetch(url, { method: 'POST', body: body, keepalive: true, mode: 'cors', credentials: 'omit' }).catch(function () {}); } catch (e) {}
  })();

  // ── loaders ──
  function loadGA() {
    if (!GA) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    // Loaded only after the visitor allowed it; no Google ads personalisation either way.
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    window.gtag('config', GA);
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA);
    document.head.appendChild(s);
  }
  function loadPixel() {
    if (!PX) return;
    if (window.fbq) return;
    var n = window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!window._fbq) window._fbq = n;
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    var s = document.createElement('script');
    s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
    window.fbq('init', PX);
    window.fbq('track', 'PageView');
  }
  function start() {
    if (on) return;
    on = true; loadGA(); loadPixel();
  }

  // ── events: name → GA4 event + Meta standard event ──
  var MAP = {
    click_call:       { ga: 'call_click',     px: 'Contact' },        // names as in the launch plan
    click_whatsapp:   { ga: 'whatsapp_click', px: 'Contact' },
    chat_open:        { ga: 'booking_start' },                        // the chat opens (intent = home/visit/track/…)
    booking_request:  { ga: 'generate_lead',  px: 'Lead' },             // call-to-confirm hand-off
    order_created:    { ga: 'begin_checkout', px: 'InitiateCheckout' }, // home-collection order made, before UPI
    purchase:         { ga: 'purchase',       px: 'Purchase' },         // UPI payment confirmed
    link_click:       { ga: 'link_click' },                             // /links taps: kind = book/location/social/website, intent = centre or platform
    links_click:      { ga: 'links_click' }                             // every /links button: centre (or app) + action (call, maps, book, …)
  };
  var SAFE = { where: 1, intent: 1, kind: 1, value: 1, currency: 1, transaction_id: 1, centre: 1, action: 1 };
  window.mrTrack = function (name, params) {
    if (!on) return;
    var m = MAP[name]; if (!m) return;
    var p = {};
    Object.keys(params || {}).forEach(function (k) { if (SAFE[k] && params[k] != null) p[k] = params[k]; });
    if (p.value != null) { p.value = Math.round(Number(p.value) || 0); p.currency = 'INR'; }
    try { if (window.gtag && m.ga) window.gtag('event', m.ga, p); } catch (e) {}
    try {
      if (window.fbq && m.px) {
        var px = {};
        if (p.value != null) { px.value = p.value; px.currency = 'INR'; }
        window.fbq('track', m.px, px, p.transaction_id ? { eventID: String(p.transaction_id) } : undefined);
      }
    } catch (e) {}
  };

  // Taps anywhere on the page (page links and the chat's buttons alike).
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest('a[href^="tel:"], a[href*="wa.me/"], [data-chat], [data-track]');
    if (!el) return;
    var area = el.closest('[data-where]');   // e.g. the /links page
    var where = (el.closest('footer') && 'footer') || (el.closest('#mr-chat') && 'chat') || (area && area.getAttribute('data-where')) || 'page';
    if (el.matches('a[href^="tel:"]')) window.mrTrack('click_call', { where: where });
    else if (el.matches('a[href*="wa.me/"]')) window.mrTrack('click_whatsapp', { where: where });
    else if (el.hasAttribute('data-chat')) window.mrTrack('chat_open', { intent: String(el.getAttribute('data-chat') || '').split(':')[0], where: where });
    else window.mrTrack('link_click', { kind: el.getAttribute('data-track'), intent: el.getAttribute('data-intent') || '', where: where });
  }, true);

  if (!GA && !PX) return;   // nothing configured: no banner, nothing loads

  // ── consent banner ──
  var TXT = {
    en: { msg: 'We would like to use cookies from Google and Meta to see which of our ads bring people to this website. Your name, number and test details are never shared.', yes: 'Allow', no: 'No thanks', more: 'Privacy policy', again: 'Cookie choices' },
    hi: { msg: 'हम Google और Meta की कुकीज़ से यह देखना चाहते हैं कि हमारे कौन-से विज्ञापन से लोग इस वेबसाइट पर आते हैं। आपका नाम, नंबर या जाँच की जानकारी कभी साझा नहीं होती।', yes: 'ठीक है', no: 'नहीं', more: 'प्राइवेसी पॉलिसी', again: 'कुकी विकल्प' }
  };
  function tx() { var l = (window.MR_LANG && window.MR_LANG()) === 'hi' ? 'hi' : 'en'; return TXT[l]; }

  var css = document.createElement('style');
  // Docked (2026-11-14): sits above the chat launcher bar, BELOW the open chat (z-index 60) and
  // hidden while the chat is open, and the page gets bottom padding so nothing stays covered
  // (it used to sit on top of everything and swallow taps at the OTP step and on /links).
  css.textContent = '.mr-consent{position:fixed;left:12px;right:12px;bottom:calc(88px + env(safe-area-inset-bottom,0px));z-index:55;max-width:560px;margin:0 auto;' +
    'background:#fff;color:#1f1f1f;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.18);padding:14px 16px;font:14px/1.45 var(--font,system-ui,sans-serif)}' +
    '.mr-consent p{margin:0 0 10px}.mr-consent a{color:var(--mr-primary,#701A75)}' +
    '.mr-consent .mr-c-row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}' +
    '.mr-consent button{border:0;border-radius:10px;padding:9px 16px;font:600 14px/1 inherit;cursor:pointer}' +
    '.mr-consent .mr-c-yes{background:var(--mr-primary,#701A75);color:#fff}.mr-consent .mr-c-no{background:#f1eef2;color:#1f1f1f}' +
    'html.mc-locked .mr-consent{display:none}' +
    '.mr-consent.mr-c-bare{bottom:calc(12px + env(safe-area-inset-bottom,0px))}' +
    '.mr-consent p{font-size:13.5px}.mr-consent button{min-height:44px}';
  document.head.appendChild(css);

  function banner() {
    var old = document.querySelector('.mr-consent'); if (old) old.remove();
    var t = tx();
    var box = document.createElement('div');
    box.className = 'mr-consent'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-live', 'polite');
    var p = document.createElement('p'); p.textContent = t.msg + ' ';
    var a = document.createElement('a'); a.href = 'privacy.html#analytics'; a.textContent = t.more; p.appendChild(a);
    var row = document.createElement('div'); row.className = 'mr-c-row';
    var no = document.createElement('button'); no.type = 'button'; no.className = 'mr-c-no'; no.textContent = t.no;
    var yes = document.createElement('button'); yes.type = 'button'; yes.className = 'mr-c-yes'; yes.textContent = t.yes;
    function done() { box.remove(); document.body.style.paddingBottom = ''; }
    no.onclick = function () { set(KEY, 'denied'); done(); };
    yes.onclick = function () { set(KEY, 'granted'); done(); start(); };
    row.appendChild(no); row.appendChild(yes); box.appendChild(p); box.appendChild(row);
    // A page without the chat bar (e.g. /links): docked at the very bottom.
    if (!document.getElementById('mr-chat')) box.className += ' mr-c-bare';
    document.body.appendChild(box);
    // Room under the page's last item, so every button can be scrolled clear of the banner.
    try {
      var r = box.getBoundingClientRect();
      document.body.style.paddingBottom = Math.ceil(window.innerHeight - r.top + 12) + 'px';
    } catch (e) {}
  }

  function footerLink() {
    var spot = document.querySelector('.foot-bot span:last-child');
    if (!spot || spot.querySelector('.mr-c-again')) return;
    var b = document.createElement('a'); b.href = '#'; b.className = 'mr-c-again'; b.textContent = tx().again;
    b.onclick = function (e) { e.preventDefault(); if (get(KEY) === 'granted') { set(KEY, null); location.reload(); } else { set(KEY, null); banner(); } };
    spot.appendChild(document.createTextNode(' · ')); spot.appendChild(b);
  }

  function init() {
    footerLink();
    var choice = get(KEY);
    if (choice === 'granted') start();
    else if (choice !== 'denied') banner();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  document.addEventListener('mr:lang', function () {
    var b = document.querySelector('.mr-consent'); if (b) banner();
    var f = document.querySelector('.mr-c-again'); if (f) f.textContent = tx().again;
  });
})();
