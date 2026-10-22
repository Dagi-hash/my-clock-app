/* ================= ENVIRONMENT ================= */
const isNativeApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const $ = (id) => document.getElementById(id);
const root = document.documentElement;
function setHidden(id, hide) { const el = $(id); if (el) { if (hide) el.setAttribute('hidden', ''); else el.removeAttribute('hidden'); } }

/* ================= PWA: SERVICE WORKER + INSTALL ================= */
if ('serviceWorker' in navigator && !isNativeApp) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

let deferredPrompt = null;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standaloneQuery = window.matchMedia('(display-mode: standalone)');
const INSTALLED_KEY = 'flipclock.installed';

function isInstalledApp() {
    return standaloneQuery.matches || navigator.standalone === true;
}

/* Front-screen install button: visible until the app runs as an installed app (never in the APK) */
function updateInstallUI() {
    let installedFlag = false;
    try { installedFlag = localStorage.getItem(INSTALLED_KEY) === '1'; } catch (e) {}
    const show = !isInstalledApp() && !installedFlag && !isNativeApp;
    $('front-install-btn').hidden = !show;
}

function markInstalled() {
    try { localStorage.setItem(INSTALLED_KEY, '1'); } catch (e) {}
    deferredPrompt = null;
    updateInstallUI();
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    try { localStorage.removeItem(INSTALLED_KEY); } catch (err) {}
    updateInstallUI();
});
window.addEventListener('appinstalled', markInstalled);
standaloneQuery.addEventListener && standaloneQuery.addEventListener('change', updateInstallUI);

function showTip(title, sub) {
    showBanner(title, sub);
}

function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choice) => {
            deferredPrompt = null;
            if (choice.outcome === 'accepted') markInstalled();
        });
    } else if (isIOS) {
        showTip('Install on iPhone', 'Tap Share, then "Add to Home Screen"');
    } else {
        showTip('Install App', 'Open the browser menu, then tap "Install app" or "Add to Home screen"');
    }
}

/* Keep the screen on while the app is open (it is a clock) */
let wakeLock = null;
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator && !wakeLock) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
        }
    } catch (e) {}
}

/* ================= PERSISTENCE ================= */
const STORE_KEY = 'flipclock.v1';
let theme = 'midnight';   // default theme: Midnight Navy + Pearl Cream
let clockMode = 'digital';

function saveState() {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify({
            alarms, use24Hour, isMuted, themeId: theme, clockMode,
            timer: { total: timerTotalSeconds, remaining: timerRemainingSeconds, running: timerRunning, endAt: timerEndAt }
        }));
    } catch (e) {}
    scheduleNativeSync();
}
function loadState() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
}

function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ================= THEMES (palettes from the design images) WITH CIRCULAR REVEAL ================= */

function setTheme(id) {
    if (!window.THEME_BY_ID[id]) id = 'midnight';
    theme = id;
    root.setAttribute('data-theme', id);
    const meta = $('meta-theme');
    if (meta) meta.setAttribute('content', window.THEME_BY_ID[id].bg);
    applySystemBars();
    markSelectedTheme();
}

/* Android status / navigation bars take the colours of the chosen theme */
function applySystemBars(id) {
    if (!AR) return;
    const t = window.THEME_BY_ID[id || theme];
    if (!t) return;
    try {
        AR.setBars({ status: t.top, nav: t.bg2, bg: t.bg, darkIcons: !t.dark }).catch(() => {});
    } catch (e) {}
}

function renderThemePicker() {
    const grid = $('theme-grid');
    if (!grid) return;
    grid.innerHTML = window.THEMES.map(t => {
        const sw = t.sw.map(c => `<i style="background:${c}"></i>`).join('');
        return `<button class="theme-card${t.id === theme ? ' sel' : ''}" data-id="${t.id}" onclick="selectTheme('${t.id}')" style="background:${t.v['--bg-grad']};color:${t.text}">` +
            `<span class="tc-check" style="background:${t.accent};color:${t.on}">&#10003;</span>` +
            `<span class="tc-sw">${sw}</span><span class="tc-name">${t.name}</span></button>`;
    }).join('');
}

function markSelectedTheme() {
    document.querySelectorAll('.theme-card').forEach(c => c.classList.toggle('sel', c.getAttribute('data-id') === theme));
}

function openThemePicker() { renderThemePicker(); $('theme-modal').classList.add('open'); }
function closeThemePicker() { $('theme-modal').classList.remove('open'); }

function selectTheme(id) {
    closeThemePicker();
    if (id === theme) return;
    applyThemeAnimated(id);
}

let themeAnimating = false;
function applyThemeAnimated(next) {
    if (themeAnimating) return;
    themeAnimating = true;
    const rect = $('theme-toggle-btn').getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const endR = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 4;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setTheme(next); themeAnimating = false; saveState(); return; }

    /* a lightweight copy of the app, already in the NEW theme, is revealed by a growing circle */
    const wrap = document.createElement('div');
    wrap.className = 'theme-reveal';
    wrap.setAttribute('data-theme', next);
    wrap.setAttribute('aria-hidden', 'true');
    ['.topbar', '.main', '.nav'].forEach(sel => {
        const src = document.querySelector(sel);
        if (!src) return;
        /* ids are kept on purpose (the layout rules use them); the originals come first in the document so lookups still hit them */
        const copy = src.cloneNode(true);
        copy.querySelectorAll('.view:not(.active)').forEach(v => v.remove());
        wrap.appendChild(copy);
    });
    wrap.style.clipPath = `circle(0px at ${x}px ${y}px)`;
    document.body.appendChild(wrap);
    const anim = wrap.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endR}px at ${x}px ${y}px)`] },
        { duration: 520, easing: 'cubic-bezier(.25,.8,.25,1)', fill: 'forwards' }
    );
    setTimeout(() => applySystemBars(next), 200);
    anim.onfinish = () => {
        root.classList.add('no-trans');
        setTheme(next);
        requestAnimationFrame(() => requestAnimationFrame(() => {
            wrap.remove();
            root.classList.remove('no-trans');
            themeAnimating = false;
            saveState();
        }));
    };
}

const textCache = {};
function setText(id, value) {
    if (textCache[id] === value) return;
    textCache[id] = value;
    const el = $(id);
    if (el) el.textContent = value;
}

/* ================= NOTIFICATION BANNER (swipe left / right to dismiss) ================= */
let alertInterval = null;
let bannerBusy = false;

function showBanner(title, subtitle) {
    const banner = $('alert-banner');
    $('alert-title').textContent = title;
    $('alert-subtitle').textContent = subtitle;
    banner.classList.remove('leaving', 'dragging');
    banner.style.removeProperty('--tx');
    banner.style.removeProperty('--o');
    banner.classList.add('show');
    bannerBusy = false;
}

function hideBanner(direction) {
    const banner = $('alert-banner');
    if (!banner.classList.contains('show') || bannerBusy) return;
    bannerBusy = true;
    if (direction) {
        banner.classList.remove('dragging');
        banner.classList.add('leaving');
        banner.style.setProperty('--tx', (direction * (window.innerWidth + 80)) + 'px');
        banner.style.setProperty('--o', '0');
        setTimeout(() => {
            banner.classList.remove('show', 'leaving');
            banner.style.removeProperty('--tx');
            banner.style.removeProperty('--o');
            bannerBusy = false;
        }, 260);
    } else {
        banner.classList.remove('show');
        banner.style.removeProperty('--tx');
        banner.style.removeProperty('--o');
        bannerBusy = false;
    }
}

(function setupBannerSwipe() {
    const banner = $('alert-banner');
    let startX = 0, startY = 0, dx = 0, startT = 0, dragging = false, decided = false, pid = null;

    banner.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button') || !banner.classList.contains('show') || bannerBusy) return;
        dragging = true; decided = false; dx = 0;
        startX = e.clientX; startY = e.clientY; startT = performance.now(); pid = e.pointerId;
    });
    banner.addEventListener('pointermove', (e) => {
        if (!dragging || e.pointerId !== pid) return;
        const mx = e.clientX - startX, my = e.clientY - startY;
        if (!decided) {
            if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
            if (Math.abs(my) > Math.abs(mx)) { dragging = false; return; }
            decided = true;
            banner.classList.add('dragging');
            try { banner.setPointerCapture(pid); } catch (err) {}
        }
        dx = mx;
        banner.style.setProperty('--tx', dx + 'px');
        banner.style.setProperty('--o', String(Math.max(0.15, 1 - Math.abs(dx) / (banner.offsetWidth * 0.9))));
    });
    const end = () => {
        if (!dragging) return;
        dragging = false;
        if (!decided) return;
        banner.classList.remove('dragging');
        const dt = Math.max(1, performance.now() - startT);
        const velocity = Math.abs(dx) / dt;
        if (Math.abs(dx) > banner.offsetWidth * 0.3 || (Math.abs(dx) > 40 && velocity > 0.5)) {
            dismissAlert(dx < 0 ? -1 : 1);
        } else {
            banner.style.setProperty('--tx', '0px');
            banner.style.setProperty('--o', '1');
            setTimeout(() => { banner.style.removeProperty('--tx'); banner.style.removeProperty('--o'); }, 400);
        }
    };
    banner.addEventListener('pointerup', end);
    banner.addEventListener('pointercancel', end);
})();

/* ================= WEB AUDIO SYNTHESIZER (used in browsers / if native alerts are unavailable) ================= */
let audioCtx = null;
let isMuted = false;

function ensureAudioContext() {
    try {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) audioCtx = new AudioContextClass();
        }
        if (audioCtx && audioCtx.state === 'suspended' && !isMuted) {
            audioCtx.resume();
        }
    } catch (e) {}
}

function playBeepPattern() {
    if (isMuted) return;
    try { if (navigator.vibrate) navigator.vibrate([250, 120, 250]); } catch (e) {}
    try {
        ensureAudioContext();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        [880, 1174.66].forEach((f, idx) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, now + idx * 0.14);
            gain.gain.setValueAtTime(0.001, now + idx * 0.14);
            gain.gain.exponentialRampToValueAtTime(0.22, now + idx * 0.14 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 0.25);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now + idx * 0.14);
            osc.stop(now + idx * 0.14 + 0.26);
        });
    } catch (e) {}
}

function triggerAlert(title, subtitle) {
    showBanner(title, subtitle);
    if (alertInterval) { clearInterval(alertInterval); alertInterval = null; }
    /* On Android the system notification rings (even when the app is closed), so only synthesize sound when it is not available */
    if (!nativeOK) {
        playBeepPattern();
        alertInterval = setInterval(playBeepPattern, 1200);
    }
}

function dismissAlert(direction) {
    hideBanner(direction);
    if (alertInterval) { clearInterval(alertInterval); alertInterval = null; }
    stopNativeRinging();
}

let toastTimer = null;
function showToast(msg) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.toggle('up', $('dock').classList.contains('on'));
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

function applyMuteUI() {
    setHidden('sound-on-icon', isMuted);
    setHidden('sound-off-icon', !isMuted);
    $('sound-label').textContent = isMuted ? 'Muted' : 'Sound On';
    const btn = $('sound-toggle-btn');
    btn.classList.toggle('on', isMuted);
    btn.setAttribute('aria-pressed', String(isMuted));
}

function toggleMute() {
    /* state + visuals first, so nothing below can ever stop the button from responding */
    isMuted = !isMuted;
    applyMuteUI();
    showToast(isMuted ? 'Sound muted - alarms will only vibrate' : 'Sound on');
    try {
        if (isMuted) {
            if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
            if (navigator.vibrate) navigator.vibrate(0);
        } else {
            ensureAudioContext();
        }
    } catch (e) {}
    saveState();
    if (AR) { clearTimeout(nativeSyncTimer); nativeSync(); }   // tell the Android alarm service right away
}

/* ================= NAVIGATION CONTROLLER ================= */
const tabOrder = ['clock', 'alarm', 'timer', 'stopwatch'];
const tabTitles = {
    clock: 'Clock',
    alarm: 'Alarms',
    timer: 'Timer',
    stopwatch: 'Stopwatch'
};
let currentTab = 'clock';

function switchTab(tabName) {
    if (tabName === currentTab) return;
    ensureAudioContext();
    const dir = tabOrder.indexOf(tabName) >= tabOrder.indexOf(currentTab) ? 1 : -1;
    const prev = $(`view-${currentTab}`);
    const next = $(`view-${tabName}`);
    currentTab = tabName;

    /* put the incoming page on its starting side instantly, then let both pages slide with a spring */
    next.style.transition = 'none';
    next.style.setProperty('--enter', dir);
    void next.offsetWidth;
    next.style.transition = '';
    prev.style.setProperty('--enter', -dir);
    prev.classList.remove('active');
    next.classList.add('active');

    $('header-title').textContent = tabTitles[tabName] || 'Clock';
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });
    updateDock();
}

/* ================= SIDE DOCK (slides out of the nav bar and merges with it while a timer / stopwatch runs) ================= */
function updateDock() {
    const showT = timerRunning && currentTab !== 'timer';
    const showS = swRunning && currentTab !== 'stopwatch';
    const any = showT || showS;
    $('dock-timer').classList.toggle('on', showT);
    $('dock-sw').classList.toggle('on', showS);
    $('dock').classList.toggle('on', any);
    $('main').classList.toggle('has-dock', any);
    if (showT) {
        const r = timerRemainingSeconds, h = Math.floor(r / 3600);
        setText('dock-timer-text', (h > 0 ? h + ':' : '') + formatTwoDigits(Math.floor((r % 3600) / 60)) + ':' + formatTwoDigits(r % 60));
    }
    if (showS) {
        const ms = currentStopwatchMs(), t = Math.floor(ms / 1000);
        setText('dock-sw-text', formatTwoDigits(Math.floor(t / 60) % 100) + ':' + formatTwoDigits(t % 60) + '.' + Math.floor((ms % 1000) / 100));
    }
}

/* ================= CLOCK STYLE (digital / analog) - one button in the top bar ================= */
const clockModes = ['digital', 'analog'];

function setClockMode(mode, persist = true) {
    if (clockModes.indexOf(mode) < 0) mode = 'digital';
    clockMode = mode;
    root.setAttribute('data-mode', mode);
    updateLiveClock(true);
    renderTimerDisplay();
    renderStopwatchDisplay(currentStopwatchMs());
    renderAlarmList();
    if (persist) saveState();
}

function toggleClockMode() {
    const next = clockMode === 'digital' ? 'analog' : 'digital';
    setClockMode(next);
    showToast(next === 'analog' ? 'Analog clock' : 'Digital clock');
}

/* dotted analog dial: 60 second dots, minute numbers, big hour numerals, glowing dot on the second hand */
const dialState = {};
function buildDial(prefix, containerId, withAmPm) {
    let dots = '', mn = '', hn = '';
    for (let i = 0; i < 60; i++) {
        const a = i * 6 * Math.PI / 180, big = i % 5 === 0;
        dots += `<circle class="an-dot${big ? ' big' : ''}" cx="${(100 + 94 * Math.sin(a)).toFixed(2)}" cy="${(100 - 94 * Math.cos(a)).toFixed(2)}" r="${big ? 2.5 : 1.3}"></circle>`;
        if (big) mn += `<text class="an-mnum" x="${(100 + 81 * Math.sin(a)).toFixed(2)}" y="${(100 - 81 * Math.cos(a)).toFixed(2)}">${i}</text>`;
    }
    for (let n = 1; n <= 12; n++) {
        const a = n * 30 * Math.PI / 180;
        hn += `<text class="an-hnum" x="${(100 + 58 * Math.sin(a)).toFixed(2)}" y="${(100 - 58 * Math.cos(a)).toFixed(2)}">${n}</text>`;
    }
    $(containerId).innerHTML = `<svg viewBox="0 0 200 200" aria-hidden="true"><g id="${prefix}-dots">${dots}</g>${mn}${hn}` +
        (withAmPm ? `<text id="${prefix}-ampm" class="an-ampm" x="100" y="128">AM</text>` : '') +
        `<g id="${prefix}-hh"><line class="an-hand" x1="100" y1="100" x2="100" y2="66" stroke-width="4.6"></line></g>` +
        `<g id="${prefix}-mm"><line class="an-hand" x1="100" y1="100" x2="100" y2="66" stroke-width="4.6"></line><line class="an-hand" x1="100" y1="68" x2="100" y2="44" stroke-width="2.2"></line></g>` +
        `<g id="${prefix}-ss"><line class="an-sec" x1="100" y1="113" x2="100" y2="8"></line></g>` +
        `<circle class="an-hub" cx="100" cy="100" r="3.6"></circle></svg>`;
    dialState[prefix] = { dots: Array.from($(prefix + '-dots').children), lit: [], last: -1, hh: $(prefix + '-hh'), mm: $(prefix + '-mm'), ss: $(prefix + '-ss') };
}

function setHands(prefix, hourDeg, minDeg, secDeg) {
    const d = dialState[prefix];
    if (!d) return;
    d.hh.setAttribute('transform', `rotate(${hourDeg.toFixed(2)} 100 100)`);
    d.mm.setAttribute('transform', `rotate(${minDeg.toFixed(2)} 100 100)`);
    d.ss.setAttribute('transform', `rotate(${secDeg.toFixed(2)} 100 100)`);
}

/* the light that rides on the second dots, following the second hand (with a fading trail) */
function lightDial(prefix, sec) {
    const d = dialState[prefix];
    if (!d || d.last === sec) return;
    d.lit.forEach(o => o.el.classList.remove('lit' + o.k));
    d.lit = [];
    for (let k = 0; k < 5; k++) {
        const el = d.dots[(sec - k + 60) % 60];
        if (el) { el.classList.add('lit' + k); d.lit.push({ el, k }); }
    }
    d.last = sec;
}

function buildAnalogDial() {
    buildDial('an', 'an-dial', true);
    buildDial('tm', 'tm-dial', false);
    buildDial('sw', 'sw-dial', false);
}

/* ================= LIVE CLOCK & ALARM ENGINE ================= */
let use24Hour = true;
let lastTriggeredMinuteKey = '';
let alarms = [];
let modalHour = 7;
let modalMinute = 0;

function toggleTimeFormat() {
    use24Hour = !use24Hour;
    $('format-toggle-btn').textContent = use24Hour ? '24H' : '12H';
    updateLiveClock(true);
    renderAlarms();
    if ($('alarm-modal').classList.contains('open')) refreshModalTime();
}

function formatTwoDigits(num) {
    return String(num).padStart(2, '0');
}

let lastDateStr = '';
function updateLiveClock(noAnim) {
    const now = new Date();
    const rawHours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const period = rawHours >= 12 ? 'PM' : 'AM';

    let displayHours = rawHours;
    let badge;
    if (!use24Hour) {
        displayHours = rawHours % 12 || 12;
        badge = period;
    } else {
        badge = '24H';
    }

    const hStr = formatTwoDigits(displayHours);
    const mStr = formatTwoDigits(minutes);
    const sStr = formatTwoDigits(seconds);

    if (clockMode === 'digital') {
        setText('dg-h', hStr);
        setText('dg-m', mStr);
        setText('dg-s', sStr);
        setText('dg-ampm', badge);
    } else {
        /* analog: always shows AM / PM */
        setHands('an', (rawHours % 12) * 30 + minutes * 0.5, minutes * 6 + seconds * 0.1, seconds * 6);
        setText('an-ampm', period);
        lightDial('an', seconds);
    }

    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
    if (dateStr !== lastDateStr) { lastDateStr = dateStr; $('clock-date').textContent = dateStr; }

    const currentKey = `${now.toDateString()} ${rawHours}:${minutes}`;
    if (lastTriggeredMinuteKey !== currentKey) {
        alarms.forEach(alarm => {
            if (alarm.enabled && alarm.hour === rawHours && alarm.minute === minutes) {
                lastTriggeredMinuteKey = currentKey;
                triggerAlert('Alarm', `${formatAlarmTimeDisplay(alarm.hour, alarm.minute)} — ${alarm.label}`);
            }
        });
    }
}

function formatAlarmTimeDisplay(h, m) {
    if (use24Hour) {
        return `${formatTwoDigits(h)}:${formatTwoDigits(m)}`;
    }
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${formatTwoDigits(h12)}:${formatTwoDigits(m)} ${period}`;
}

function updateNextAlarmSummary() {
    const active = alarms.filter(a => a.enabled);
    if (active.length === 0) {
        setText('next-alarm-text', 'No active alarms');
        setText('alarm-sub', 'No active alarms');
        return;
    }
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    let closest = active[0];
    let minDiff = Infinity;
    active.forEach(a => {
        let diff = a.hour * 60 + a.minute - nowMinutes;
        if (diff <= 0) diff += 1440;
        if (diff < minDiff) { minDiff = diff; closest = a; }
    });
    const hrsLeft = Math.floor(minDiff / 60);
    const minsLeft = minDiff % 60;
    const nextTxt = `Next: ${formatAlarmTimeDisplay(closest.hour, closest.minute)} (${hrsLeft}h ${minsLeft}m)`;
    setText('next-alarm-text', nextTxt);
    setText('alarm-sub', nextTxt);
}

function miniAnalogSVG(h, m) {
    const ha = (h % 12) * 30 + m * 0.5, ma = m * 6;
    let ticks = '';
    for (let i = 0; i < 12; i++) {
        const a = i * 30 * Math.PI / 180;
        ticks += `<line class="an-tick hr" x1="${(50 + 38 * Math.sin(a)).toFixed(1)}" y1="${(50 - 38 * Math.cos(a)).toFixed(1)}" x2="${(50 + 43 * Math.sin(a)).toFixed(1)}" y2="${(50 - 43 * Math.cos(a)).toFixed(1)}" style="stroke-width:3"></line>`;
    }
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="an-face" cx="50" cy="50" r="47" style="stroke-width:3"></circle>${ticks}` +
        `<line class="an-hand" x1="50" y1="52" x2="50" y2="28" stroke-width="5" transform="rotate(${ha} 50 50)"></line>` +
        `<line class="an-hand" x1="50" y1="54" x2="50" y2="16" stroke-width="3.6" transform="rotate(${ma} 50 50)"></line>` +
        `<circle class="an-hub" cx="50" cy="50" r="4"></circle></svg>`;
}

function alarmTimeHTML(a) {
    const text = formatAlarmTimeDisplay(a.hour, a.minute);
    if (clockMode === 'analog') {
        return `<div class="al-analog">${miniAnalogSVG(a.hour, a.minute)}<span class="al-text">${text}</span></div>`;
    }
    return `<div class="alarm-time">${text}</div>`;
}

function renderAlarms() {
    saveState();
    updateNextAlarmSummary();
    renderAlarmList();
}

function renderAlarmList() {
    const container = $('alarm-list');
    if (!container) return;

    if (alarms.length === 0) {
        container.innerHTML = `<div class="empty">No alarms yet.<br>Tap + to add one, and write why you are setting it.</div>`;
        return;
    }

    container.innerHTML = alarms.map(alarm => `
        <div class="alarm-item ${alarm.enabled ? '' : 'off'}">
            <div style="min-width:0">
                ${alarmTimeHTML(alarm)}
                <div class="alarm-label">${esc(alarm.label)}</div>
            </div>
            <div class="alarm-ctrl">
                <button onclick="toggleAlarm(${alarm.id})" class="switch ${alarm.enabled ? 'on' : ''}" aria-label="Toggle Alarm"><div class="knob"></div></button>
                <button onclick="deleteAlarm(${alarm.id})" class="del-btn" title="Delete Alarm">
                    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
            </div>
        </div>
    `).join('');
}

function toggleAlarm(id) {
    alarms = alarms.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
    renderAlarms();
}

function deleteAlarm(id) {
    alarms = alarms.filter(a => a.id !== id);
    renderAlarms();
}

function refreshModalTime() {
    const h = use24Hour ? modalHour : (modalHour % 12 || 12);
    $('modal-hour').textContent = formatTwoDigits(h);
    $('modal-minute').textContent = formatTwoDigits(modalMinute);
    setHidden('modal-ampm', use24Hour);
    $('ap-am').classList.toggle('on', modalHour < 12);
    $('ap-pm').classList.toggle('on', modalHour >= 12);
}

function openAlarmModal() {
    const now = new Date();
    modalHour = (now.getHours() + 1) % 24;
    modalMinute = 0;
    refreshModalTime();
    $('modal-label').value = '';
    $('alarm-modal').classList.add('open');
}

function closeAlarmModal() {
    $('alarm-modal').classList.remove('open');
    const input = $('modal-label');
    if (input) input.blur();
}

function stepModalTime(unit, delta) {
    if (unit === 'h') {
        if (use24Hour) {
            modalHour = (modalHour + delta + 24) % 24;
        } else {
            const pm = modalHour >= 12;
            const h12 = ((((modalHour % 12) || 12) - 1 + delta + 12) % 12) + 1;
            modalHour = (h12 % 12) + (pm ? 12 : 0);
        }
    } else {
        modalMinute = (modalMinute + delta + 60) % 60;
    }
    refreshModalTime();
}

function setModalPeriod(period) {
    const h = modalHour % 12;
    modalHour = period === 'PM' ? h + 12 : h;
    refreshModalTime();
}

/* ================= INFO POPUP ================= */
function openInfo() { $('info-modal').classList.add('open'); refreshBgStatus(); }
function closeInfo() { $('info-modal').classList.remove('open'); }

function saveNewAlarm() {
    const labelInput = $('modal-label').value.trim();
    alarms.push({ id: Date.now(), hour: modalHour, minute: modalMinute, label: labelInput || 'Alarm', enabled: true });
    alarms.sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));
    renderAlarms();
    closeAlarmModal();
    maybeAdviseBackground();
}

/* ================= COUNTDOWN TIMER ENGINE (timestamp based, survives reloads) ================= */
let timerTotalSeconds = 300;
let timerRemainingSeconds = 300;
let timerRunning = false;
let timerInterval = null;
let timerEndAt = 0;
let timerFinishedAt = 0;

function setTimerUI(state) {
    const labels = { ready: ['Start', 'Ready'], running: ['Pause', 'Running'], paused: ['Resume', 'Paused'], done: ['Start', 'Completed'] };
    $('timer-toggle-btn').textContent = labels[state][0];
    $('timer-status-badge').textContent = labels[state][1];
    $('timer-setup-controls').classList.toggle('dim', state === 'running');
}

function renderTimerDisplay(animate = true) {
    const hStr = formatTwoDigits(Math.floor(timerRemainingSeconds / 3600));
    const mStr = formatTwoDigits(Math.floor((timerRemainingSeconds % 3600) / 60));
    const sStr = formatTwoDigits(timerRemainingSeconds % 60);
    setText('td-h', hStr);
    setText('td-m', mStr);
    setText('td-s', sStr);
    if (clockMode === 'analog') {
        const rem = timerRemainingSeconds;
        const hrs = Math.floor(rem / 3600), mins = Math.floor((rem % 3600) / 60), secs = rem % 60;
        setHands('tm', (hrs % 12) * 30 + mins * 0.5, mins * 6 + secs * 0.1, secs * 6);
        lightDial('tm', secs);
        setText('tm-readout', (hrs > 0 ? hStr + ':' : '') + mStr + ':' + sStr);
    }
    updateDock();
}

function adjustTimer(unitMultiplier, step) {
    if (timerRunning) return;
    timerRemainingSeconds = Math.max(0, Math.min(359999, timerRemainingSeconds + unitMultiplier * step));
    timerTotalSeconds = timerRemainingSeconds;
    renderTimerDisplay(true);
    saveState();
}

function setTimerPreset(seconds) {
    if (timerRunning) return;
    timerRemainingSeconds = seconds;
    timerTotalSeconds = seconds;
    renderTimerDisplay(true);
    saveState();
}

function timerTick() {
    const left = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
    if (left !== timerRemainingSeconds) {
        timerRemainingSeconds = left;
        renderTimerDisplay(true);
    }
    if (left <= 0) {
        clearInterval(timerInterval);
        timerRunning = false;
        timerEndAt = 0;
        timerFinishedAt = Date.now();
        setTimerUI('done');
        saveState();
        triggerAlert('Timer Complete', 'Your countdown has finished');
    }
}

function toggleTimer() {
    ensureAudioContext();
    if (timerRunning) {
        clearInterval(timerInterval);
        timerRemainingSeconds = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
        timerRunning = false;
        timerEndAt = 0;
        setTimerUI('paused');
        renderTimerDisplay(true);
    } else {
        if (timerRemainingSeconds <= 0) return;
        timerRunning = true;
        timerEndAt = Date.now() + timerRemainingSeconds * 1000;
        setTimerUI('running');
        timerInterval = setInterval(timerTick, 250);
    }
    updateDock();
    saveState();
    if (timerRunning) maybeAdviseBackground();
}

function resetTimer() {
    clearInterval(timerInterval);
    timerRunning = false;
    timerEndAt = 0;
    timerRemainingSeconds = timerTotalSeconds || 300;
    setTimerUI('ready');
    renderTimerDisplay(true);
    saveState();
}

/* ================= STOPWATCH & LAP COUNTER ENGINE ================= */
let swRunning = false;
let swStartTime = 0;
let swElapsedMs = 0;
let swRafId = null;
let swLaps = [];
let lastLapTotalMs = 0;

function renderStopwatchDisplay(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60) % 100;
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((ms % 1000) / 10);

    const mStr = formatTwoDigits(minutes);
    const sStr = formatTwoDigits(seconds);
    const csStr = formatTwoDigits(centiseconds);

    if (clockMode === 'digital') {
        setText('sd-m', mStr);
        setText('sd-s', sStr);
        setText('sd-c', csStr);
    } else {
        const ts = ms / 1000, hrs = Math.floor(ts / 3600), mins = Math.floor(ts / 60) % 60, secf = ts % 60;
        setHands('sw', (hrs % 12) * 30 + mins * 0.5, mins * 6 + secf * 0.1, secf * 6);
        lightDial('sw', Math.floor(secf));
        setText('sw-readout', mStr + ':' + sStr + '.' + csStr);
    }
}

function formatStopwatchString(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${formatTwoDigits(minutes)}:${formatTwoDigits(seconds)}.${formatTwoDigits(centiseconds)}`;
}

function currentStopwatchMs() {
    return swRunning ? swElapsedMs + (performance.now() - swStartTime) : swElapsedMs;
}

function tickStopwatch() {
    if (!swRunning) return;
    renderStopwatchDisplay(swElapsedMs + (performance.now() - swStartTime));
    if (currentTab !== 'stopwatch') updateDock();
    swRafId = requestAnimationFrame(tickStopwatch);
}

function toggleStopwatch() {
    ensureAudioContext();
    const primaryBtn = $('sw-primary-btn');
    const secondaryBtn = $('sw-secondary-btn');

    if (swRunning) {
        swElapsedMs += performance.now() - swStartTime;
        swRunning = false;
        cancelAnimationFrame(swRafId);
        primaryBtn.textContent = 'Resume';
        secondaryBtn.textContent = 'Reset';
        secondaryBtn.disabled = false;
    } else {
        swStartTime = performance.now();
        swRunning = true;
        primaryBtn.textContent = 'Stop';
        secondaryBtn.textContent = 'Lap';
        secondaryBtn.disabled = false;
        swRafId = requestAnimationFrame(tickStopwatch);
    }
    updateDock();
}

function lapOrResetStopwatch() {
    const primaryBtn = $('sw-primary-btn');
    const secondaryBtn = $('sw-secondary-btn');

    if (swRunning) {
        const totalMs = swElapsedMs + (performance.now() - swStartTime);
        const splitMs = totalMs - lastLapTotalMs;
        lastLapTotalMs = totalMs;
        swLaps.unshift({ number: swLaps.length + 1, split: splitMs, total: totalMs });
        renderLaps();
    } else {
        swElapsedMs = 0;
        lastLapTotalMs = 0;
        swLaps = [];
        primaryBtn.textContent = 'Start';
        secondaryBtn.textContent = 'Lap';
        secondaryBtn.disabled = true;
        renderStopwatchDisplay(0);
        renderLaps();
    }
}

function renderLaps() {
    const listEl = $('lap-list');
    setHidden('lap-head', swLaps.length === 0);
    if (swLaps.length === 0) {
        listEl.innerHTML = `<div class="lap-empty">No laps recorded</div>`;
        return;
    }

    let fastestSplit = Infinity;
    let slowestSplit = -Infinity;
    if (swLaps.length >= 2) {
        swLaps.forEach(l => {
            if (l.split < fastestSplit) fastestSplit = l.split;
            if (l.split > slowestSplit) slowestSplit = l.split;
        });
    }

    listEl.innerHTML = swLaps.map(lap => {
        let badge = '';
        if (swLaps.length >= 2) {
            if (lap.split === fastestSplit) badge = '<span class="tag best">BEST</span>';
            else if (lap.split === slowestSplit) badge = '<span class="tag slow">SLOW</span>';
        }
        return `
            <div class="lap-row">
                <span style="color:var(--muted);display:flex;align-items:center">#${formatTwoDigits(lap.number)}${badge}</span>
                <span style="font-weight:600">${formatStopwatchString(lap.split)}</span>
                <span style="color:var(--text-2)">${formatStopwatchString(lap.total)}</span>
            </div>
        `;
    }).join('');
}

/* ================= NATIVE ANDROID: REAL ALARM-CLOCK BEHAVIOUR =================
   Alarms and the timer are registered with Android's AlarmManager (setAlarmClock) through the
   AlarmRinger plugin written by native.py. When the time comes a foreground service rings the
   alarm sound in a loop, vibrates and shows a full-screen notification - even if the app is
   closed, swiped away, or the phone is locked / asleep. */
function nativePlugin(name) {
    try {
        const C = window.Capacitor;
        if (C && typeof C.registerPlugin === 'function') return C.registerPlugin(name);
        return C && C.Plugins ? C.Plugins[name] : null;
    } catch (e) { return null; }
}
const AR = isNativeApp ? nativePlugin('AlarmRinger') : null;
const LN = isNativeApp ? nativePlugin('LocalNotifications') : null;   // only used to ask for the notification permission
let nativeOK = false;      // true => the Android service provides the ring
let nativeError = '';
let nativeAsked = false;
let nativeSyncTimer = null;
let nativeSyncing = false;
let nativeSyncAgain = false;

function scheduleNativeSync() {
    if (!AR) return;
    clearTimeout(nativeSyncTimer);
    nativeSyncTimer = setTimeout(nativeSync, 150);
}

/* Registers every enabled alarm + the running timer with Android. It never waits on a permission prompt. */
async function nativeSync() {
    if (nativeSyncing) { nativeSyncAgain = true; return; }
    nativeSyncing = true;
    try {
        const items = [];
        alarms.filter(a => a.enabled).forEach(a => items.push({
            id: (a.id % 2000000000) + 10,
            kind: 'alarm',
            hour: a.hour,
            minute: a.minute,
            title: a.label || 'Alarm',
            body: formatAlarmTimeDisplay(a.hour, a.minute)
        }));
        if (timerRunning && timerEndAt > Date.now() + 500) {
            items.push({ id: 1, kind: 'timer', at: timerEndAt, title: 'Timer Complete', body: 'Your countdown has finished' });
        }
        await AR.sync({ muted: isMuted, items });
        nativeOK = true;
        nativeError = '';
    } catch (e) {
        nativeOK = false;
        nativeError = String((e && e.message) || e);
        console.error('native sync failed', e);
    } finally {
        nativeSyncing = false;
        if (nativeSyncAgain) { nativeSyncAgain = false; scheduleNativeSync(); }
    }
}

/* asks for the notification permission in the background (Android 13+) - separate from scheduling */
function requestNativePermissions() {
    if (!LN || nativeAsked) return;
    nativeAsked = true;
    setTimeout(async () => {
        try {
            const p = await LN.checkPermissions();
            if (p.display !== 'granted') await LN.requestPermissions();
        } catch (e) {}
        refreshBgStatus();
    }, 1200);
}

async function refreshBgStatus() {
    const box = $('bg-card');
    if (!box || !AR) return;
    box.hidden = false;
    let st = null;
    try { st = await AR.status(); } catch (e) { nativeError = String((e && e.message) || e); }
    const pill = (ok, t) => `<span class="bg-pill ${ok ? 'ok' : ''}">${ok ? '&#10003;' : '!'} ${t}</span>`;
    box.innerHTML = `<h4>Background ringing</h4>
        <div class="bg-status">${pill(nativeOK, 'Alarm service')}${st ? pill(st.notifications, 'Notifications') + pill(st.battery, 'Battery unrestricted') : ''}</div>
        <div class="bg-btns">
            <button class="btn btn-primary full" onclick="testRing()">Test ring in 10 seconds</button>
            <button class="btn btn-outline" onclick="openBgSetting('notifications')">Notifications</button>
            <button class="btn btn-outline" onclick="openBgSetting('battery')">Battery: Unrestricted</button>
            <button class="btn btn-outline full" onclick="openBgSetting('autostart')">Autostart / background apps (Xiaomi, Oppo, Vivo, Huawei, Samsung)</button>
        </div>
        <p class="bg-note">${nativeOK ? '' : 'Alarm service not connected yet. ' + esc(nativeError) + ' '}Press Test, then lock the phone. If it does not ring, switch on every item above for this app.</p>`;
}

function testRing() {
    if (!AR) return;
    AR.testRing({ delay: 10 }).then(() => {
        closeInfo();
        showToast('Lock your phone now - it rings in 10 seconds');
    }).catch(e => showToast('Test failed: ' + ((e && e.message) || e)));
}

function openBgSetting(type) {
    if (!AR) return;
    AR.openSettings({ type }).catch(() => showToast('Could not open that settings page'));
}

/* one-time nudge the first time an alarm / timer is created on Android */
function maybeAdviseBackground() {
    if (!AR) return;
    let done = false;
    try { done = localStorage.getItem('flipclock.bgAdvised') === '1'; } catch (e) {}
    if (done) return;
    try { localStorage.setItem('flipclock.bgAdvised', '1'); } catch (e) {}
    setTimeout(() => { showToast('Check Background ringing so alarms ring when the app is closed'); openInfo(); }, 700);
}

function stopNativeRinging() {
    if (!AR) return;
    try { AR.stop().catch(() => {}); } catch (e) {}
}

/* ================= ELASTIC BOUNCE (rubber-band at the ends of lists and pages) ================= */
function enableBounce(scroller, target) {
    if (!scroller) return;
    target = target || scroller;
    target.classList.add('bounce');
    let lastY = 0, pull = 0, active = false;
    const MAX = 110;
    scroller.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        active = true; pull = 0; lastY = e.touches[0].clientY;
        target.style.transition = 'none';
    }, { passive: true });
    scroller.addEventListener('touchmove', (e) => {
        if (!active) return;
        const y = e.touches[0].clientY, d = y - lastY;
        lastY = y;
        const atTop = scroller.scrollTop <= 0;
        const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
        if (pull === 0) {
            if (!((d > 0 && atTop) || (d < 0 && atBottom))) return;   // normal scrolling
        }
        pull += d * (1 - Math.min(0.85, Math.abs(pull) / MAX));      // resistance grows as you pull
        if ((pull > 0 && !atTop) || (pull < 0 && !atBottom)) pull = 0;
        pull = Math.max(-MAX, Math.min(MAX, pull));
        target.style.transform = `translate3d(0,${pull.toFixed(1)}px,0)`;
    }, { passive: true });
    const release = () => {
        if (!active) return;
        active = false;
        if (pull !== 0) {
            target.style.transition = 'transform .6s cubic-bezier(.34,1.7,.5,1)';
            target.style.transform = 'translate3d(0,0,0)';
            pull = 0;
        }
    };
    scroller.addEventListener('touchend', release, { passive: true });
    scroller.addEventListener('touchcancel', release, { passive: true });
}

/* ================= INITIALIZATION ================= */
function init() {
    const s = loadState();
    if (Array.isArray(s.alarms)) alarms = s.alarms;
    use24Hour = s.use24Hour !== false;
    isMuted = !!s.isMuted;
    theme = window.THEME_BY_ID[s.themeId] ? s.themeId : 'midnight';
    clockMode = clockModes.indexOf(s.clockMode) > -1 ? s.clockMode : 'digital';
    setTheme(theme);

    $('format-toggle-btn').textContent = use24Hour ? '24H' : '12H';
    applyMuteUI();

    buildAnalogDial();

    let finishedWhileAway = false;
    if (s.timer) {
        timerTotalSeconds = s.timer.total ?? 300;
        timerRemainingSeconds = s.timer.remaining ?? timerTotalSeconds;
        if (s.timer.running && s.timer.endAt) {
            timerEndAt = s.timer.endAt;
            timerRemainingSeconds = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
            if (timerRemainingSeconds > 0) {
                timerRunning = true;
                setTimerUI('running');
                timerInterval = setInterval(timerTick, 250);
            } else {
                timerEndAt = 0;
                setTimerUI('done');
                finishedWhileAway = true;
            }
        }
    }

    setClockMode(clockMode, false);
    renderAlarms();
    requestNativePermissions();
    renderTimerDisplay(false);
    renderStopwatchDisplay(0);
    if (finishedWhileAway) triggerAlert('Timer Complete', 'Your countdown finished while the app was closed');

    setInterval(updateDock, 250);

    // Tick aligned to the real second boundary so the clock never lags
    (function loop() {
        updateLiveClock();
        updateNextAlarmSummary();
        setTimeout(loop, 1000 - (Date.now() % 1000) + 5);
    })();

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            updateLiveClock();
            if (timerRunning) timerTick();
            requestWakeLock();
        }
    });
    document.addEventListener('pointerdown', () => { ensureAudioContext(); requestWakeLock(); }, { passive: true });
    requestWakeLock();

    updateInstallUI();

    enableBounce($('alarm-list'));
    enableBounce($('lap-list'));
    enableBounce($('view-timer'), document.querySelector('#view-timer .timer-center'));

    [['alarm-modal', closeAlarmModal], ['info-modal', closeInfo], ['theme-modal', closeThemePicker]].forEach(([id, fn]) => {
        $(id).addEventListener('click', (e) => { if (e.target === $(id)) fn(); });
    });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
