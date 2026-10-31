'use strict';

/* ================= ENVIRONMENT & NATIVE BRIDGE ================= */
const cap = window.Capacitor || null;
const isNativeApp = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = (n) => String(n).padStart(2, '0');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function setText(el, v) { if (el && el.textContent !== v) el.textContent = v; }

/*
 * Calls a native Android plugin through the Capacitor bridge itself (cap.nativePromise).
 * It always exists inside the app - unlike Capacitor.Plugins.<Name>, which is NOT created for apps
 * without a JavaScript bundler (that was why background alarms never got scheduled before).
 */
function nativeCall(plugin, method, options) {
    try {
        if (cap && typeof cap.nativePromise === 'function') return cap.nativePromise(plugin, method, options || {});
        const p = cap && cap.Plugins && cap.Plugins[plugin];
        if (p && typeof p[method] === 'function') return p[method](options || {});
    } catch (e) { return Promise.reject(e); }
    return Promise.reject(new Error('native bridge unavailable'));
}

/* ================= LANGUAGE: English / Amharic ================= */
const I18N = {
    en: {
        t_clock: 'Clock', t_alarm: 'Alarms', t_timer: 'Timer', t_sw: 'Stopwatch',
        n_clock: 'Clock', n_alarm: 'Alarm', n_timer: 'Timer', n_sw: 'Stopwatch',
        settings: 'Settings', dismiss: 'Dismiss', snooze: 'Snooze', undo: 'Undo', save: 'Save', cancel: 'Cancel', delete: 'Delete', ok: 'OK', fix: 'Fix', open: 'Open',
        bedside: 'Bedside mode', install: 'Install App', dim: 'Dim',
        next_none: 'No active alarms', next: 'Next: {t} (in {h}h {m}m)',
        wake: 'Wake & Reminders', new_alarm: 'New Alarm', set_alarm: 'Set new alarm', edit_alarm: 'Edit alarm', none_alarms: 'No alarms yet', default_label: 'Alarm',
        repeat: 'Repeat', once: 'Once', everyday: 'Every day', weekdays: 'Weekdays', weekends: 'Weekends', label: 'Label', ph_label: 'Morning Workout',
        skip_next: 'Skip next', skipping: 'Skipping next', alarm_deleted: 'Alarm deleted', invalid_time: 'Enter a valid time',
        am: 'AM', pm: 'PM', p_day: 'Day', p_night: 'Night', p_m: 'Morning', p_a: 'Afternoon', p_e: 'Evening', p_n: 'Night',
        wd0: 'Sunday', wd1: 'Monday', wd2: 'Tuesday', wd3: 'Wednesday', wd4: 'Thursday', wd5: 'Friday', wd6: 'Saturday',
        wds0: 'Sun', wds1: 'Mon', wds2: 'Tue', wds3: 'Wed', wds4: 'Thu', wds5: 'Fri', wds6: 'Sat',
        ready: 'Ready', running: 'Running', paused: 'Paused', completed: 'Completed', start: 'Start', pause: 'Pause', resume: 'Resume', reset: 'Reset', stop: 'Stop', lap: 'Lap',
        hrs: 'HRS', min: 'MIN', sec: 'SEC', n_min: '{n} min',
        timer_n: 'Timer {n}', edit_timer: 'Edit timer', name: 'Name', rounds: 'Rounds', rest: 'Rest', round_of: 'Round {a}/{b}', phase_rest: 'Rest',
        timer_done: 'Timer Complete', timer_done_text: 'Your countdown has finished', delete_timer: 'Delete timer',
        interval_hint: 'Rounds above 1 make an interval timer (work, rest, repeat).',
        lap_no: 'Lap #', split: 'Split', total: 'Total', no_laps: 'No laps recorded', best: 'BEST', slow: 'SLOW',
        appearance: 'Appearance', accent: 'Accent colour', lang_time: 'Language & time', language: 'Language', calendar: 'Calendar',
        greg: 'Gregorian', eth: 'Ethiopian', time_format: 'Time format', h24: '24-hour', h12: '12-hour', ethtime: 'Ethiopian',
        alarms_s: 'Alarms', snooze_len: 'Snooze length (minutes)', gradual: 'Gradually louder', vibrate: 'Vibrate', challenge: 'Wake-up challenge', off: 'Off', math: 'Maths',
        challenge_hint: 'Solve a maths question to switch the alarm off.', inapp_sound: 'Sounds inside the app', reliability_btn: 'Alarm reliability',
        rel_title_ok: 'Alarms are set to ring when the app is closed', rel_title_fix: 'Fix settings so alarms always ring',
        rel_sub_ok: 'Tap to send a test alarm', rel_sub_fix: 'Tap to check notifications and battery',
        rel_intro: "Alarms are set with the phone's own alarm clock, so they ring when the app is closed or the phone is locked. Some phones also need these switches:",
        rel_notif: 'Notifications', rel_notif_s: 'Needed to show the alarm screen', rel_batt: 'Battery: no restrictions', rel_batt_s: 'Stops the phone from stopping alarms',
        rel_auto: 'Autostart / background (Xiaomi, Oppo, Vivo, Huawei)', rel_auto_s: 'Turn ON for Flip Clock if your phone has this page',
        rel_test: 'Send a test alarm in 10 seconds', rel_test_s: 'Tap it, then lock your phone and wait.',
        test_set: 'Test alarm is set', test_sub: 'Lock your phone now - it will ring in 10 seconds.', test_fail: 'Could not start the test', test_fail_s: 'Open the app again and retry.',
        solve: 'Solve to dismiss'
    },
    am: {
        t_clock: 'ሰዓት', t_alarm: 'ማንቂያዎች', t_timer: 'ቆጣሪ', t_sw: 'የሩጫ ሰዓት',
        n_clock: 'ሰዓት', n_alarm: 'ማንቂያ', n_timer: 'ቆጣሪ', n_sw: 'የሩጫ ሰዓት',
        settings: 'ቅንብሮች', dismiss: 'አጥፋ', snooze: 'አሸልብ', undo: 'መልስ', save: 'አስቀምጥ', cancel: 'ተው', delete: 'ሰርዝ', ok: 'እሺ', fix: 'አስተካክል', open: 'ክፈት',
        bedside: 'የአልጋ ዳር ሰዓት', install: 'መተግበሪያውን ጫን', dim: 'ደብዛዛ',
        next_none: 'ንቁ ማንቂያ የለም', next: 'ቀጣይ: {t} (በ{h}ሰ {m}ደ ውስጥ)',
        wake: 'መንቂያና ማስታወሻ', new_alarm: 'አዲስ ማንቂያ', set_alarm: 'አዲስ ማንቂያ አዘጋጅ', edit_alarm: 'ማንቂያ አርም', none_alarms: 'እስካሁን ማንቂያ የለም', default_label: 'ማንቂያ',
        repeat: 'ድገም', once: 'አንድ ጊዜ', everyday: 'በየቀኑ', weekdays: 'የሥራ ቀናት', weekends: 'ቅዳሜና እሑድ', label: 'መለያ', ph_label: 'የጠዋት ስፖርት',
        skip_next: 'ቀጣዩን ዝለል', skipping: 'ቀጣዩ ይዘለላል', alarm_deleted: 'ማንቂያ ተሰርዟል', invalid_time: 'ትክክለኛ ሰዓት ያስገቡ',
        am: 'ጠዋት', pm: 'ከሰዓት', p_day: 'ቀን', p_night: 'ሌሊት', p_m: 'ጠዋት', p_a: 'ከሰዓት', p_e: 'ማታ', p_n: 'ሌሊት',
        wd0: 'እሑድ', wd1: 'ሰኞ', wd2: 'ማክሰኞ', wd3: 'ረቡዕ', wd4: 'ሐሙስ', wd5: 'ዓርብ', wd6: 'ቅዳሜ',
        wds0: 'እሑ', wds1: 'ሰኞ', wds2: 'ማክ', wds3: 'ረቡ', wds4: 'ሐሙ', wds5: 'ዓር', wds6: 'ቅዳ',
        ready: 'ዝግጁ', running: 'እየሄደ', paused: 'ቆሟል', completed: 'ተጠናቀቀ', start: 'ጀምር', pause: 'አቁም', resume: 'ቀጥል', reset: 'ዳግም', stop: 'አቁም', lap: 'ዙር',
        hrs: 'ሰዓት', min: 'ደቂቃ', sec: 'ሰከንድ', n_min: '{n} ደቂቃ',
        timer_n: 'ቆጣሪ {n}', edit_timer: 'ቆጣሪ አርም', name: 'ስም', rounds: 'ዙሮች', rest: 'ዕረፍት', round_of: 'ዙር {a}/{b}', phase_rest: 'ዕረፍት',
        timer_done: 'ቆጣሪ ተጠናቀቀ', timer_done_text: 'ቆጠራው ተጠናቋል', delete_timer: 'ቆጣሪ ሰርዝ',
        interval_hint: 'ከ1 በላይ ዙር የክፍለ ጊዜ ቆጣሪ ያደርገዋል (ሥራ፣ ዕረፍት፣ ድገም)።',
        lap_no: 'ዙር #', split: 'ክፍል', total: 'ድምር', no_laps: 'ምንም ዙር አልተመዘገበም', best: 'ምርጥ', slow: 'ዝግተኛ',
        appearance: 'መልክ', accent: 'የአነጋገር ቀለም', lang_time: 'ቋንቋና ሰዓት', language: 'ቋንቋ', calendar: 'የቀን መቁጠሪያ',
        greg: 'ግሪጎሪያን', eth: 'ኢትዮጵያዊ', time_format: 'የሰዓት ቅርጸት', h24: '24 ሰዓት', h12: '12 ሰዓት', ethtime: 'ኢትዮጵያ ሰዓት',
        alarms_s: 'ማንቂያዎች', snooze_len: 'የማሸለቢያ ጊዜ (ደቂቃ)', gradual: 'ቀስ በቀስ ድምፅ ጨምር', vibrate: 'ንዝረት', challenge: 'የመንቂያ ፈተና', off: 'አጥፋ', math: 'ሒሳብ',
        challenge_hint: 'ማንቂያውን ለማጥፋት የሒሳብ ጥያቄ ይፍቱ።', inapp_sound: 'በመተግበሪያ ውስጥ ድምፅ', reliability_btn: 'የማንቂያ አስተማማኝነት',
        rel_title_ok: 'መተግበሪያው ሲዘጋ ማንቂያዎች ይደውላሉ', rel_title_fix: 'ማንቂያዎች እንዲደውሉ ቅንብሮችን ያስተካክሉ',
        rel_sub_ok: 'የሙከራ ማንቂያ ለመላክ ይንኩ', rel_sub_fix: 'ማሳወቂያና ባትሪ ለመፈተሽ ይንኩ',
        rel_intro: 'ማንቂያዎች በስልኩ የራሱ ማንቂያ ሰዓት ስለሚዘጋጁ መተግበሪያው ሲዘጋ ወይም ስልኩ ሲቆለፍ ይደውላሉ። አንዳንድ ስልኮች እነዚህንም ይፈልጋሉ፦',
        rel_notif: 'ማሳወቂያዎች', rel_notif_s: 'የማንቂያ ማያ ለማሳየት ያስፈልጋል', rel_batt: 'ባትሪ፦ ገደብ የለም', rel_batt_s: 'ስልኩ ማንቂያዎችን እንዳያቆም ይከላከላል',
        rel_auto: 'ራስ-ሰር ጅምር / ዳራ (ሺያዮሚ፣ ኦፖ፣ ቪቮ፣ ሁዋዌ)', rel_auto_s: 'ስልክዎ ይህ ገጽ ካለው ለFlip Clock ያብሩት',
        rel_test: 'በ10 ሰከንድ የሙከራ ማንቂያ ላክ', rel_test_s: 'ይንኩት፣ ከዚያ ስልክዎን ቆልፈው ይጠብቁ።',
        test_set: 'የሙከራ ማንቂያ ተቀምጧል', test_sub: 'ስልክዎን አሁን ይቆልፉ - በ10 ሰከንድ ውስጥ ይደውላል።', test_fail: 'ሙከራውን መጀመር አልተቻለም', test_fail_s: 'መተግበሪያውን እንደገና ከፍተው ይሞክሩ።',
        solve: 'ለማጥፋት ይፍቱ'
    }
};
const ETH_MONTHS = ['መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት', 'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜን'];

/* ================= STATE ================= */
const STORE_KEY = 'flipclock.v1';            // same key as before -> saved alarms keep working
const DEFAULTS = { lang: 'en', cal: 'greg', timeFmt: 'h24', snoozeMin: 10, gradual: true, vibrate: true, challenge: 'off', sound: true, accent: 'classic' };
const BAR_COLORS = {
    light: { status: '#FFF0E6', nav: '#FDA481', light: true, meta: '#FFF0E6' },
    dark: { status: '#000000', nav: '#000000', light: false, meta: '#000000' }
};
let settings = Object.assign({}, DEFAULTS);
let alarms = [];
let timers = [];
let selTimerId = 1;
let nextTimerId = 2;
let theme = 'light';                         // new installs start in LIGHT mode
let themeChosen = false;                     // true once the user picks a theme themselves
let clockMode = 'flip';                      // 'flip' | 'digital' | 'analog'
let currentTab = 'clock';
let lastTriggeredMinuteKey = '';

let swRunning = false;
let swStartTime = 0;
let swElapsedMs = 0;
let swRafId = null;
let swLaps = [];
let lastLapTotalMs = 0;

const tr = (k, v) => {
    let s = (I18N[settings.lang] && I18N[settings.lang][k]);
    if (s === undefined) s = I18N.en[k];
    if (s === undefined) s = k;
    if (v) for (const x in v) s = s.split('{' + x + '}').join(v[x]);
    return s;
};

function saveState() {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ settings, alarms, timers, selTimerId, nextTimerId, theme, themeChosen, clockMode }));
    } catch (e) {}
    scheduleNativeSync();
}
function loadState() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
}

function normAlarm(a, i) {
    return {
        id: +a.id || Date.now() + i, hour: clamp(+a.hour || 0, 0, 23), minute: clamp(+a.minute || 0, 0, 59),
        label: String(a.label == null ? '' : a.label), enabled: a.enabled !== false,
        days: Array.isArray(a.days) ? a.days.filter((d) => d >= 0 && d <= 6) : [0, 1, 2, 3, 4, 5, 6],   // old alarms repeat every day
        skip: +a.skip || 0
    };
}
function normTimer(t, i) {
    const total = t.total != null ? Math.max(0, +t.total) : 300;
    return {
        id: +t.id || i + 1, name: String(t.name || 'Timer'), total, rest: Math.max(0, +t.rest || 0), rounds: clamp(+t.rounds || 1, 1, 99),
        phase: Math.max(0, +t.phase || 0), remaining: t.remaining != null ? Math.max(0, +t.remaining) : total,
        running: !!t.running, endAt: +t.endAt || 0, done: !!t.done
    };
}

/* ================= TIME FORMATS (24h / 12h / Ethiopian) & CALENDARS ================= */
/* Ethiopian time: the day starts at sunrise, so 7:00 = 1 o'clock and 6:00 = 12 o'clock */
function ethHour(h24) { return ((h24 - 6 + 12) % 12) || 12; }
function ethIsDay(h24) { return h24 >= 6 && h24 < 18; }
function ethToGreg(e, day) { return day ? (e % 12) + 6 : ((e % 12) + 18) % 24; }
function periodWord(h24) { return tr(h24 >= 6 && h24 < 12 ? 'p_m' : h24 >= 12 && h24 < 18 ? 'p_a' : h24 >= 18 ? 'p_e' : 'p_n'); }
function dispHour(h24) { const f = settings.timeFmt; return f === 'h24' ? h24 : f === 'h12' ? (h24 % 12 || 12) : ethHour(h24); }
function periodTag(h24) { const f = settings.timeFmt; return f === 'h24' ? '' : f === 'h12' ? tr(h24 >= 12 ? 'pm' : 'am') : periodWord(h24); }
function fmtAlarmTime(h, m) { return `${pad2(dispHour(h))}:${pad2(m)}`; }

/* Gregorian -> Ethiopian calendar (via Julian Day Number) */
function toEth(d) {
    const y = d.getFullYear(), m = d.getMonth() + 1, dd = d.getDate(), a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
    const jdn = dd + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
    const n0 = jdn - 1723856, c = Math.floor(n0 / 1461), r = n0 % 1461;
    const n = (r % 365) + 365 * Math.floor(r / 1460);
    return { y: 4 * c + Math.floor(r / 365) - Math.floor(r / 1460), m: Math.floor(n / 30) + 1, d: (n % 30) + 1 };
}
function fmtDateLong(d) {
    if (settings.cal === 'eth') {
        const e = toEth(d);
        return `${tr('wd' + d.getDay())}, ${ETH_MONTHS[e.m - 1]} ${e.d}, ${e.y}`;
    }
    const opt = { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' };
    try { return d.toLocaleDateString(settings.lang === 'am' ? 'am-ET' : 'en-US', opt); } catch (e) { return d.toLocaleDateString('en-US', opt); }
}

function applyI18n() {
    document.documentElement.lang = settings.lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => setText(el, tr(el.dataset.i18n)));
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = tr(el.dataset.i18nPh); });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', tr(el.dataset.i18nAria)));
    document.querySelectorAll('[data-tag-i18n]').forEach((el) => { const t = el.querySelector('.tag'); if (t) setText(t, tr(el.dataset.tagI18n)); });
    setText($('header-title'), tr(TAB_TITLE[currentTab]));
}

/* ================= FIXED-WIDTH NUMBERS (digits never jitter, whatever the font) ================= */
function setNum(el, str) {
    if (!el) return;
    const sig = str.replace(/\d/g, '0');
    if (el._sig !== sig) {
        el._sig = sig;
        el.innerHTML = Array.from(str).map((ch) => `<i${/\d/.test(ch) ? '' : ' class="s"'}>${ch}</i>`).join('');
        return;
    }
    const kids = el.children;
    for (let i = 0; i < kids.length; i++) if (kids[i].textContent !== str[i]) kids[i].textContent = str[i];
}

/* ================= FLIP CARDS ================= */
const flipValues = {};
function initFlipUnits() {
    document.querySelectorAll('.fcard').forEach((unit) => {
        const id = unit.getAttribute('data-flip-id');
        flipValues[id] = '00';
        const tag = unit.hasAttribute('data-tag-i18n') ? tr(unit.getAttribute('data-tag-i18n')) : '';
        unit.innerHTML = `
            <div class="upper-card"><span>00</span></div>
            <div class="lower-card"><span>00</span></div>
            <div class="flip-leaf">
                <div class="flip-leaf-front"><span>00</span></div>
                <div class="flip-leaf-back"><span>00</span></div>
            </div>
            <i class="tag">${esc(tag)}</i>`;
    });
}
function updateFlipUnit(id, newValue, animate = true) {
    const strVal = String(newValue);
    if (flipValues[id] === strVal) return;
    const oldVal = flipValues[id] || '00';
    flipValues[id] = strVal;
    const unit = document.querySelector(`.fcard[data-flip-id="${id}"]`);
    if (!unit) return;
    const upper = unit.querySelector('.upper-card span');
    const lower = unit.querySelector('.lower-card span');
    const leafFront = unit.querySelector('.flip-leaf-front span');
    const leafBack = unit.querySelector('.flip-leaf-back span');
    if (!animate) {
        unit.classList.remove('flipping');
        upper.textContent = strVal; lower.textContent = strVal;
        leafFront.textContent = strVal; leafBack.textContent = strVal;
        return;
    }
    leafFront.textContent = oldVal;
    leafBack.textContent = strVal;
    upper.textContent = strVal;
    lower.textContent = oldVal;
    unit.classList.remove('flipping');
    void unit.offsetWidth;
    unit.classList.add('flipping');
    clearTimeout(unit._ft);
    unit._ft = setTimeout(() => {
        lower.textContent = strVal;
        leafFront.textContent = strVal;
        unit.classList.remove('flipping');
    }, 460);
}
function setFlipTag(id, txt) {
    const t = document.querySelector(`.fcard[data-flip-id="${id}"] .tag`);
    if (t) setText(t, txt);
}
/* measures the loaded font so digits always fit their card, sit centred on the fold, and counters get fixed-width cells */
function calibrateFlipFont() {
    try {
        const root = document.documentElement;
        const fam = getComputedStyle(root).getPropertyValue('--flip-font').trim() || 'sans-serif';
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.font = `400 100px ${fam}`;
        let maxAdv = 0;
        for (let d = 0; d < 10; d++) maxAdv = Math.max(maxAdv, ctx.measureText(String(d)).width);
        const m = ctx.measureText('0');
        if (!maxAdv) return;
        root.style.setProperty('--dwn', (maxAdv / 100 + 0.01).toFixed(3));
        const advEm = maxAdv / 100 + 0.03;
        let ff = 0.8 / (2 * advEm);
        const asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent;
        if (isFinite(asc) && isFinite(desc) && asc + desc > 0) ff = Math.min(ff, 0.74 / ((asc + desc) / 100));
        ff = clamp(ff, 0.45, 0.98);
        root.style.setProperty('--ff', ff.toFixed(3));
        root.style.setProperty('--dn', clamp(27 / (2 * (maxAdv / 100 + 0.01)), 16, 31).toFixed(1) + 'px');
        const fA = m.fontBoundingBoxAscent, fD = m.fontBoundingBoxDescent;
        if ([asc, desc, fA, fD].every(isFinite)) root.style.setProperty('--dy', (-((((fA - fD) - (asc - desc)) / 2) / 100)).toFixed(4));
    } catch (e) {}
}

/* ================= ANALOG DIAL ================= */
const DIALS = {};
const PI = Math.PI;
function dialMarkup() {
    const C = 120;
    let dots = '', mins = '', nums = '';
    for (let i = 0; i < 60; i++) {
        const a = (i * 6 - 90) * PI / 180, big = i % 5 === 0;
        dots += `<circle class="dt${big ? ' big' : ''}" cx="${(C + 106 * Math.cos(a)).toFixed(2)}" cy="${(C + 106 * Math.sin(a)).toFixed(2)}" r="${big ? 3 : 1.6}"/>`;
        if (big) mins += `<text class="mn" x="${(C + 89 * Math.cos(a)).toFixed(2)}" y="${(C + 89 * Math.sin(a)).toFixed(2)}">${i}</text>`;
    }
    for (let h = 1; h <= 12; h++) {
        const a = (h * 30 - 90) * PI / 180;
        nums += `<text class="hn" x="${(C + 66 * Math.cos(a)).toFixed(2)}" y="${(C + 66 * Math.sin(a)).toFixed(2)}">${h}</text>`;
    }
    return `<circle class="glass" cx="120" cy="120" r="117"/>
        <g filter="url(#shDial)">${dots}${mins}${nums}</g>
        <g class="hand h-glow"><circle cx="120" cy="14" r="19" fill="url(#halo)"/></g>
        <g filter="url(#shHM)">
            <g class="hand h-hour"><line class="hl" x1="120" y1="128" x2="120" y2="74" stroke-width="7"/></g>
            <g class="hand h-min"><line class="hl" x1="120" y1="130" x2="120" y2="48" stroke-width="5.5"/></g>
        </g>
        <g filter="url(#shSec)"><g class="hand h-sec"><line class="sl" x1="120" y1="138" x2="120" y2="14" stroke-width="1.6"/><circle class="sdot" cx="120" cy="14" r="4.8"/></g></g>
        <circle class="hub" cx="120" cy="120" r="6.5"/><circle class="hub2" cx="120" cy="120" r="2.6"/>`;
}
function initDial(id) {
    const svg = $(id);
    if (!svg) return;
    svg.innerHTML = dialMarkup();
    DIALS[id] = { svg, hour: svg.querySelector('.h-hour'), min: svg.querySelector('.h-min'), sec: svg.querySelector('.h-sec'), glow: svg.querySelector('.h-glow'),
        dots: Array.from(svg.querySelectorAll('.dt')), ah: 0, am: 0, as: 0, lit: -1, init: false };
}
function nearest(prev, target) { return prev + ((target - prev + 540) % 360) - 180; }
function setDial(id, hourDeg, minDeg, secDeg) {
    const d = DIALS[id];
    if (!d) return;
    if (!d.init) { d.ah = hourDeg; d.am = minDeg; d.as = secDeg; d.init = true; } else {
        d.ah = nearest(d.ah, hourDeg); d.am = nearest(d.am, minDeg); d.as = nearest(d.as, secDeg);
    }
    d.hour.style.transform = `rotate(${d.ah}deg)`;
    d.min.style.transform = `rotate(${d.am}deg)`;
    d.sec.style.transform = `rotate(${d.as}deg)`;
    d.glow.style.transform = `rotate(${d.as}deg)`;
    const idx = ((Math.round(d.as / 6) % 60) + 60) % 60;
    if (idx !== d.lit) {
        if (d.lit >= 0) for (let k = -2; k <= 2; k++) d.dots[(d.lit + k + 60) % 60].classList.remove('l1', 'l2', 'l3');
        for (let k = -2; k <= 2; k++) d.dots[(idx + k + 60) % 60].classList.add(k === 0 ? 'l3' : (Math.abs(k) === 1 ? 'l2' : 'l1'));
        d.lit = idx;
    }
}

/* ================= WEB AUDIO (in-app fallback ring, used only without the native alarm engine) ================= */
let audioCtx = null;
let alertInterval = null;
function ensureAudioContext() {
    if (!audioCtx) { const Ctx = window.AudioContext || window.webkitAudioContext; if (Ctx) audioCtx = new Ctx(); }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function playBeepPattern() {
    try { if (navigator.vibrate && settings.vibrate) navigator.vibrate([250, 120, 250]); } catch (e) {}
    if (!settings.sound) return;
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
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(now + idx * 0.14); osc.stop(now + idx * 0.14 + 0.26);
        });
    } catch (e) {}
}

/* ================= LAYERS: sheets / popups / bedside, closed by the phone's Back button ================= */
const layers = [];
function onSheetOpen(id) {
    if (id === 'settings-sheet') syncSettingsUI();
    if (id === 'rel-modal') { renderRel(); refreshRel(); }
    if (id === 'bedside') bedStart();
}
function onSheetClose(id) {
    if (id === 'bedside') bedStop();
}
function openSheet(id) {
    const el = $(id);
    if (!el || layers.includes(id)) return;
    layers.push(id);
    try { history.pushState({ layer: id }, ''); } catch (e) {}
    el.setAttribute('aria-hidden', 'false');
    onSheetOpen(id);
    el.classList.add('show');
}
function finishClose(id) {
    const i = layers.lastIndexOf(id);
    if (i < 0) return;
    layers.splice(i, 1);
    const el = $(id);
    el.classList.remove('show');
    el.setAttribute('aria-hidden', 'true');
    onSheetClose(id);
}
function closeSheet(id) {
    const i = layers.lastIndexOf(id);
    if (i < 0) return;
    if (i === layers.length - 1) {
        try { history.back(); } catch (e) { finishClose(id); return; }
        setTimeout(() => finishClose(id), 350);          // safety net if no popstate arrives
    } else finishClose(id);
}
window.addEventListener('popstate', () => { if (layers.length) finishClose(layers[layers.length - 1]); });

/* ================= NOTIFICATION POP-UP (slide it away) ================= */
let ringPoll = null;
let bannerKind = 'tip';
let bannerTimer = null;
function showBanner(title, subtitle, o) {
    o = o || {};
    bannerKind = o.kind || 'tip';
    const b = $('alert-banner');
    $('alert-title').textContent = title;
    $('alert-subtitle').textContent = subtitle;
    const box = $('alert-actions');
    box.innerHTML = '';
    const acts = o.actions || [{ label: tr('dismiss'), fn: () => { if (bannerKind === 'ring') requestDismiss(); else hideBanner(); } }];
    acts.forEach((a) => {
        const btn = document.createElement('button');
        btn.className = 'btn sm' + (a.ghost ? ' ghost' : '');
        btn.textContent = a.label;
        btn.onclick = a.fn;
        box.appendChild(btn);
    });
    b.style.transition = ''; b.style.transform = ''; b.style.opacity = '';
    b.classList.add('show');
    clearTimeout(bannerTimer);
    if (o.ms) bannerTimer = setTimeout(hideBanner, o.ms);
}
function hideBanner() { clearTimeout(bannerTimer); $('alert-banner').classList.remove('show'); }
function clearAlertLoop() { if (alertInterval) { clearInterval(alertInterval); alertInterval = null; } }
function stopRingPoll() { if (ringPoll) { clearInterval(ringPoll); ringPoll = null; } }
function nativeRingActive() { return isNativeApp && nativeActive; }

function startRingPoll() {
    stopRingPoll();
    const t0 = Date.now();
    let misses = 0;
    ringPoll = setInterval(async () => {
        try {
            const s = await nativeCall('ClockAlarm', 'getState');
            misses = s && s.ringing ? 0 : misses + 1;
            if (misses >= 2 && Date.now() - t0 > 4000) { hideBanner(); stopRingPoll(); }
        } catch (e) { stopRingPoll(); }
    }, 1500);
}
function triggerAlert(title, subtitle, o) {
    o = o || {};
    const dismissBtn = { label: tr('dismiss'), fn: requestDismiss };
    showBanner(title, subtitle, { kind: 'ring', actions: o.snooze ? [{ label: tr('snooze'), ghost: true, fn: () => doSnooze(title, subtitle) }, dismissBtn] : [dismissBtn] });
    clearAlertLoop();
    if (nativeRingActive()) startRingPoll();             // the phone's alarm engine is ringing (works with the app closed)
    else { playBeepPattern(); alertInterval = setInterval(playBeepPattern, 1200); }
}
function dismissAlert() {
    hideBanner();
    clearAlertLoop();
    stopRingPoll();
    if (isNativeApp) nativeCall('ClockAlarm', 'dismiss').catch(() => {});
}
function doSnooze(title, subtitle) {
    hideBanner(); clearAlertLoop(); stopRingPoll();
    if (nativeRingActive()) nativeCall('ClockAlarm', 'snooze').catch(() => {});
    else setTimeout(() => triggerAlert(title, subtitle, { snooze: true }), settings.snoozeMin * 60000);
}
/* wake-up challenge: with it on, a ringing alarm needs a maths answer before it can be dismissed */
function requestDismiss() {
    if (settings.challenge === 'math' && bannerKind === 'ring') { openChallenge(); return; }
    dismissAlert();
}
let chCorrect = 0;
function newChallenge() {
    let q, ans;
    if (Math.random() < 0.5) { const a = 12 + Math.floor(Math.random() * 78), b = 12 + Math.floor(Math.random() * 78); q = `${a} + ${b}`; ans = a + b; }
    else { const a = 3 + Math.floor(Math.random() * 10), b = 3 + Math.floor(Math.random() * 7); q = `${a} \u00D7 ${b}`; ans = a * b; }
    chCorrect = Math.floor(Math.random() * 3);
    const vals = [];
    for (let i = 0; i < 3; i++) {
        if (i === chCorrect) { vals.push(ans); continue; }
        let v;
        do { v = ans + (Math.random() < 0.5 ? 1 : -1) * (1 + Math.floor(Math.random() * 9)); } while (v === ans || v < 0 || vals.includes(v));
        vals.push(v);
    }
    $('ch-q').textContent = `${q} = ?`;
    document.querySelectorAll('.ch-opts button').forEach((b, i) => { b.textContent = vals[i]; });
}
function openChallenge() { newChallenge(); openSheet('challenge-modal'); }
function chAnswer(i) {
    if (i === chCorrect) { closeSheet('challenge-modal'); dismissAlert(); }
    else {
        const q = $('ch-q'); q.classList.remove('shake'); void q.offsetWidth; q.classList.add('shake');
        try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) {}
        newChallenge();
    }
}
async function checkNativeRinging() {
    if (!isNativeApp) return;
    try {
        const s = await nativeCall('ClockAlarm', 'getState');
        if (s && s.ringing) {
            showBanner(s.title || tr('default_label'), s.text || '', { kind: 'ring', actions: [{ label: tr('snooze'), ghost: true, fn: () => doSnooze(s.title, s.text) }, { label: tr('dismiss'), fn: requestDismiss }] });
            startRingPoll();
        }
    } catch (e) {}
}

(function setupSwipeToDismiss() {
    const b = $('alert-banner');
    let dragging = false, sx = 0, dx = 0, t0 = 0, pid = null;
    b.addEventListener('pointerdown', (e) => {
        if (!b.classList.contains('show') || e.target.closest('button')) return;
        dragging = true; sx = e.clientX; dx = 0; t0 = performance.now(); pid = e.pointerId;
        try { b.setPointerCapture(pid); } catch (err) {}
        b.classList.add('dragging');
    });
    b.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        dx = e.clientX - sx;
        b.style.transform = `translate3d(${dx}px,0,0) rotate(${dx / 60}deg)`;
        b.style.opacity = String(Math.max(0.15, 1 - Math.abs(dx) / (b.offsetWidth * 0.95)));
    });
    function springBack() {
        b.style.transition = 'transform .4s cubic-bezier(.34,1.7,.55,1), opacity .2s ease';
        b.style.transform = ''; b.style.opacity = '';
        setTimeout(() => { b.style.transition = ''; }, 420);
    }
    function end() {
        if (!dragging) return;
        dragging = false;
        b.classList.remove('dragging');
        const speed = Math.abs(dx) / Math.max(1, performance.now() - t0);
        if (Math.abs(dx) > b.offsetWidth * 0.3 || (speed > 0.55 && Math.abs(dx) > 36)) {
            if (bannerKind === 'ring' && settings.challenge === 'math') { springBack(); openChallenge(); return; }
            const dir = dx >= 0 ? 1 : -1;
            b.style.transition = 'transform .26s cubic-bezier(.4,0,1,1), opacity .26s ease';
            b.style.transform = `translate3d(${dir * (window.innerWidth + 40)}px,0,0) rotate(${dir * 12}deg)`;
            b.style.opacity = '0';
            setTimeout(() => {
                b.style.transition = 'none';
                if (bannerKind === 'ring') dismissAlert(); else hideBanner();
                b.style.transform = ''; b.style.opacity = '';
                void b.offsetWidth;
                b.style.transition = '';
            }, 250);
        } else springBack();
    }
    b.addEventListener('pointerup', end);
    b.addEventListener('pointercancel', end);
})();

/* ================= THEME (circular reveal) + ACCENT ================= */
function applyTheme(t) {
    theme = t;
    document.documentElement.dataset.theme = t;
    const c = BAR_COLORS[t];
    const m = document.querySelector('meta[name=theme-color]');
    if (m) m.content = c.meta;
    if (isNativeApp) nativeCall('ClockAlarm', 'setBars', { status: c.status, nav: c.nav, light: c.light }).catch(() => {});
}
function applyAccent() { document.documentElement.dataset.accent = settings.accent || 'classic'; }
function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    theme = next;
    themeChosen = true;
    saveState();
    const r = $('theme-btn').getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const root = document.documentElement;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !reduced) {
        root.classList.add('theme-vt');
        let vt;
        try { vt = document.startViewTransition(() => { applyTheme(next); }); }
        catch (e) { applyTheme(next); root.classList.remove('theme-vt'); return; }
        vt.ready.then(() => {
            root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
                { duration: 650, easing: 'cubic-bezier(.4,0,.15,1)', pseudoElement: '::view-transition-new(root)' });
        }).catch(() => {});
        vt.finished.then(() => root.classList.remove('theme-vt'), () => root.classList.remove('theme-vt'));
    } else {
        root.classList.add('theme-fade');
        applyTheme(next);
        setTimeout(() => root.classList.remove('theme-fade'), 600);
    }
}

/* ================= NAVIGATION + MERGED "NOW" BAR ================= */
const TABS = ['clock', 'alarm', 'timer', 'stopwatch'];
const TAB_TITLE = { clock: 't_clock', alarm: 't_alarm', timer: 't_timer', stopwatch: 't_sw' };

function enterAnim(el) {
    el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('enter'), 700);
}
function switchTab(tabName) {
    ensureAudioContext();
    const idx = TABS.indexOf(tabName);
    if (idx < 0 || tabName === currentTab) return;
    currentTab = tabName;
    setText($('header-title'), tr(TAB_TITLE[tabName]));
    TABS.forEach((t, i) => {
        const p = $('view-' + t);
        p.dataset.pos = i === idx ? 'mid' : (i < idx ? 'left' : 'right');
        p.setAttribute('aria-hidden', i === idx ? 'false' : 'true');
    });
    document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.toggle('on', btn.getAttribute('data-tab') === tabName));
    enterAnim($('view-' + tabName));
    refreshDisplays();
    updateNowBar();
    if (tabName === 'alarm') refreshRel();
    if (navigator.vibrate) { try { navigator.vibrate(6); } catch (e) {} }
}
function fmtHMS(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}
function runningTimers() { return timers.filter((t) => t.running).sort((a, b) => a.endAt - b.endAt); }
/* the now bar shows the soonest-ending running timer, or the stopwatch - never the one you are already looking at, if another is running */
function pickNow() {
    const rt = runningTimers();
    if (!rt.length && !swRunning) return null;
    if (currentTab === 'timer') {
        const others = rt.filter((t) => t.id !== selTimerId);
        if (others.length) return { kind: 'timer', id: others[0].id };
        if (swRunning) return { kind: 'sw' };
        return rt.length ? { kind: 'timer', id: rt[0].id } : null;
    }
    if (currentTab === 'stopwatch') return rt.length ? { kind: 'timer', id: rt[0].id } : { kind: 'sw' };
    return rt.length ? { kind: 'timer', id: rt[0].id } : { kind: 'sw' };
}
function updateNowBar() {
    const pick = pickNow();
    const dock = $('dock');
    if (pick) {
        const nb = $('nowbar');
        nb.dataset.kind = pick.kind;
        nb.dataset.id = pick.id || '';
        const t = pick.kind === 'timer' ? getTimer(pick.id) : null;
        setNum($('now-time'), pick.kind === 'timer' ? fmtHMS(tRemaining(t)) : fmtHMS(Math.floor(currentSwMs() / 1000)));
    }
    if (dock.classList.contains('has-now') !== !!pick) dock.classList.toggle('has-now', !!pick);
}
function goNow() {
    const nb = $('nowbar');
    if (nb.dataset.kind === 'timer') { selectTimer(+nb.dataset.id); switchTab('timer'); } else switchTab('stopwatch');
}

/* ================= CLOCK STYLES: swipe between flip / digital / analog ================= */
const MODES = ['flip', 'digital', 'analog'];
function updateDots() {
    const idx = MODES.indexOf(clockMode);
    document.querySelectorAll('[data-dots]').forEach((d) => Array.from(d.children).forEach((i, k) => i.classList.toggle('on', k === idx)));
}
function setClockMode(mode, persist = true) {
    if (!MODES.includes(mode)) mode = 'flip';
    clockMode = mode;
    document.documentElement.dataset.mode = mode;
    ['flip', 'digital', 'analog'].forEach((m) => $('clock-' + m).classList.toggle('on', m === mode));
    document.querySelectorAll('[data-show]').forEach((el) => el.classList.toggle('on', el.dataset.show.split(' ').includes(mode)));
    updateDots();
    refreshDisplays();
    if (persist) saveState();
}
function attachModeSwipe(el) {
    let x0 = 0, y0 = 0, t0 = 0, active = false;
    el.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        x0 = e.clientX; y0 = e.clientY; t0 = performance.now(); active = true;
        try { el.setPointerCapture(e.pointerId); } catch (err) {}          // the release is seen even if the finger leaves the area
    });
    el.addEventListener('pointerup', (e) => {
        if (!active) return;
        active = false;
        const dx = e.clientX - x0, dy = e.clientY - y0;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4 && performance.now() - t0 < 900) {
            const i = MODES.indexOf(clockMode) + (dx < 0 ? 1 : -1);
            if (i >= 0 && i < MODES.length) setClockMode(MODES[i]);
        }
    });
    el.addEventListener('pointercancel', () => { active = false; });
}
function refreshDisplays() {
    updateLiveClock();
    renderTimerDisplay(false);
    renderStopwatchDisplay(currentSwMs());
}

/* ================= LIVE CLOCK & ALARM ENGINE ================= */
function updateLiveClock() {
    const now = new Date();
    const h = now.getHours(), minutes = now.getMinutes(), seconds = now.getSeconds();
    const fmt = settings.timeFmt;
    const hStr = pad2(dispHour(h)), mStr = pad2(minutes), sStr = pad2(seconds);
    const tag = periodTag(h);

    ['clock', 'bed'].forEach((p) => {
        updateFlipUnit(p + '-h', hStr);
        updateFlipUnit(p + '-m', mStr);
        updateFlipUnit(p + '-s', sStr);
        setFlipTag(p + '-h', tag);                       // AM / PM (or the Ethiopian period) sits inside the hour card
    });
    setNum($('dg-hm'), hStr + ':' + mStr);
    setNum($('dg-s'), sStr);
    setText($('dg-ampm'), fmt === 'h24' ? '24H' : tag);
    setText($('an-ampm'), fmt === 'eth' ? periodWord(h) : tr(h >= 12 ? 'pm' : 'am'));
    if (clockMode === 'analog') {
        const hh = fmt === 'eth' ? ethHour(h) % 12 : h % 12;
        setDial('dial-clock', (hh + minutes / 60 + seconds / 3600) * 30, (minutes + seconds / 60) * 6, seconds * 6);
    }
    const dateText = fmtDateLong(now);
    setText($('clock-date'), dateText.toUpperCase());
    setText($('bed-date'), dateText);

    const key = `${now.toDateString()} ${h}:${minutes}`;
    if (lastTriggeredMinuteKey !== key) {
        const minuteStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, minutes, 0, 0).getTime();
        for (const a of alarms) {
            if (alarmDue(a, now, minuteStart)) { lastTriggeredMinuteKey = key; fireAlarmInApp(a); }
        }
    }
}
function alarmDue(a, now, minuteStart) {
    if (!a.enabled || a.hour !== now.getHours() || a.minute !== now.getMinutes()) return false;
    if (a.days.length && !a.days.includes(now.getDay())) return false;
    if (a.skip && Math.abs(a.skip - minuteStart) < 60000) return false;
    return true;
}
function fireAlarmInApp(a) {
    triggerAlert(a.label || tr('default_label'), timeWithPeriod(a.hour, a.minute), { snooze: true });
    if (a.days.length === 0) { a.enabled = false; renderAlarms(); saveState(); }      // one-time alarm switches itself off
}
function timeWithPeriod(h, m) { const t = periodTag(h); return fmtAlarmTime(h, m) + (t ? ' ' + t : ''); }

/* next time an alarm will ring (mirrors the phone's scheduler) */
function nextOccurrence(a, from) {
    for (let off = 0; off <= 8; off++) {
        const d = new Date(from);
        d.setDate(d.getDate() + off);
        d.setHours(a.hour, a.minute, 0, 0);
        const t = d.getTime();
        if (t <= from) continue;
        if (a.days.length && !a.days.includes(d.getDay())) continue;
        if (a.skip && Math.abs(t - a.skip) < 60000) continue;
        return t;
    }
    return 0;
}
function updateNextAlarmSummary() {
    const now = Date.now();
    let best = 0, bestA = null, skipChanged = false;
    alarms.forEach((a) => {
        if (a.skip && a.skip < now - 60000) { a.skip = 0; skipChanged = true; }
        if (!a.enabled) return;
        const t = nextOccurrence(a, now);
        if (t && (!best || t < best)) { best = t; bestA = a; }
    });
    if (skipChanged) { saveState(); renderAlarms(); }
    let text = tr('next_none');
    if (bestA) {
        const diff = best - now;
        const hh = Math.floor(diff / 3600000), mm = Math.floor((diff % 3600000) / 60000);
        const day = diff >= 86400000 ? tr('wds' + new Date(best).getDay()) + ' ' : '';
        text = tr('next', { t: day + timeWithPeriod(bestA.hour, bestA.minute), h: hh, m: mm });
    }
    setText($('next-alarm-text'), text);
    setText($('bed-next'), bestA ? text : '');
}

/* ---------- alarm list ---------- */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
function daysSummary(days) {
    if (!days.length) return tr('once');
    if (days.length === 7) return tr('everyday');
    if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return tr('weekdays');
    if (days.length === 2 && days.includes(0) && days.includes(6)) return tr('weekends');
    return DAY_ORDER.filter((d) => days.includes(d)).map((d) => tr('wds' + d)).join(' ');
}
function renderAlarms() {
    const container = $('alarm-list');
    updateNextAlarmSummary();
    if (alarms.length === 0) { container.innerHTML = `<div class="empty">${esc(tr('none_alarms'))}</div>`; return; }
    const now = Date.now();
    container.innerHTML = alarms.map((a) => {
        const skipping = a.skip && a.skip > now;
        const per = periodTag(a.hour);
        const chip = a.enabled && a.days.length
            ? `<button class="skip-chip${skipping ? ' on' : ''}" onclick="toggleSkip(${a.id})">${esc(tr(skipping ? 'skipping' : 'skip_next'))}</button>` : '';
        return `<div class="alarm-wrap"><div class="alarm-item${a.enabled ? '' : ' off'}" data-id="${a.id}">
            <div class="am">
                <div class="alarm-time">${fmtAlarmTime(a.hour, a.minute)}<span class="alarm-per">${esc(per)}</span></div>
                <div class="alarm-days">${esc(daysSummary(a.days))}${a.label ? ' · ' + esc(a.label) : ''}</div>${chip}
            </div>
            <div class="alarm-actions"><button class="switch${a.enabled ? ' on' : ''}" onclick="toggleAlarm(${a.id})" aria-label="Toggle"><i></i></button></div>
        </div></div>`;
    }).join('');
}
function toggleAlarm(id) { alarms = alarms.map((a) => a.id === id ? { ...a, enabled: !a.enabled, skip: 0 } : a); renderAlarms(); saveState(); }
function toggleSkip(id) {
    const a = alarms.find((x) => x.id === id);
    if (!a) return;
    a.skip = a.skip && a.skip > Date.now() ? 0 : nextOccurrence({ ...a, skip: 0 }, Date.now());
    renderAlarms(); saveState();
}
function removeAlarm(id) {
    const a = alarms.find((x) => x.id === id);
    if (!a) return;
    alarms = alarms.filter((x) => x.id !== id);
    renderAlarms(); saveState();
    showBanner(tr('alarm_deleted'), (a.label || timeWithPeriod(a.hour, a.minute)), { kind: 'tip', ms: 5000, actions: [{
        label: tr('undo'), fn: () => { alarms.push(a); sortAlarms(); renderAlarms(); saveState(); hideBanner(); } }] });
}
function sortAlarms() { alarms.sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute)); }

/* tap = edit, swipe left = delete */
(function setupAlarmList() {
    const list = $('alarm-list');
    let st = null;
    list.addEventListener('pointerdown', (e) => {
        const item = e.target.closest('.alarm-item');
        if (!item || e.target.closest('.switch') || e.target.closest('.skip-chip')) return;
        st = { item, id: +item.dataset.id, x: e.clientX, y: e.clientY, dx: 0, drag: false, t: performance.now(), pid: e.pointerId };
    });
    list.addEventListener('pointermove', (e) => {
        if (!st) return;
        const dx = e.clientX - st.x, dy = e.clientY - st.y;
        if (!st.drag) {
            if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) { st.drag = true; st.item.classList.add('dragging'); st.item.parentElement.classList.add('dragging'); try { list.setPointerCapture(st.pid); } catch (err) {} }
            else if (Math.abs(dy) > 10) { st = null; return; }
        }
        if (st.drag) { st.dx = Math.min(0, dx); st.item.style.transform = `translate3d(${st.dx}px,0,0)`; }
    });
    list.addEventListener('pointerup', () => {
        if (!st) return;
        const s = st; st = null;
        s.item.classList.remove('dragging');
        if (!s.drag) { openAlarmEditor(s.id); return; }
        const wrap = s.item.parentElement;
        const fast = Math.abs(s.dx) / Math.max(1, performance.now() - s.t) > 0.6 && s.dx < -40;
        if (s.dx < -Math.min(110, s.item.offsetWidth * 0.32) || fast) {
            s.item.style.transition = 'transform .22s ease-in';
            s.item.style.transform = 'translate3d(-110%,0,0)';
            setTimeout(() => removeAlarm(s.id), 200);
        } else {
            s.item.style.transition = 'transform .4s cubic-bezier(.34,1.7,.55,1)';
            s.item.style.transform = '';
            setTimeout(() => { s.item.style.transition = ''; wrap.classList.remove('dragging'); }, 420);
        }
    });
    list.addEventListener('pointercancel', () => { if (st) { st.item.classList.remove('dragging'); st.item.parentElement.classList.remove('dragging'); st.item.style.transform = ''; st = null; } });
})();

/* ---------- alarm editor (bottom sheet with a number keypad) ---------- */
let ed = null;
function edFromHour(h, m) {
    const f = settings.timeFmt;
    if (f === 'h24') { ed.digits = pad2(h) + pad2(m); ed.period = null; }
    else if (f === 'h12') { ed.digits = pad2(h % 12 || 12) + pad2(m); ed.period = h >= 12 ? 'b' : 'a'; }
    else { ed.digits = pad2(ethHour(h)) + pad2(m); ed.period = ethIsDay(h) ? 'a' : 'b'; }
}
function edToTime() {
    const d = ed.digits.padStart(4, '0'), hh = +d.slice(0, 2), mm = +d.slice(2);
    if (mm > 59) return null;
    const f = settings.timeFmt;
    if (f === 'h24') return hh <= 23 ? { h: hh, m: mm } : null;
    if (hh < 1 || hh > 12) return null;
    if (f === 'h12') return { h: (hh % 12) + (ed.period === 'b' ? 12 : 0), m: mm };
    return { h: ethToGreg(hh, ed.period === 'a'), m: mm };
}
function openAlarmEditor(id) {
    const a = id ? alarms.find((x) => x.id === id) : null;
    ed = { id: a ? a.id : null, days: a ? a.days.slice() : [0, 1, 2, 3, 4, 5, 6], digits: '', period: null, fresh: true };
    edFromHour(a ? a.hour : (new Date().getHours() + 1) % 24, a ? a.minute : 0);
    $('ae-label').value = a ? a.label : '';
    setText($('ae-title'), tr(a ? 'edit_alarm' : 'set_alarm'));
    $('ae-del').classList.toggle('hidden', !a);
    renderEditor();
    openSheet('alarm-sheet');
}
function renderEditor() {
    const d = ed.digits.padStart(4, '0');
    setText($('ae-hh'), d.slice(0, 2)); setText($('ae-mm'), d.slice(2));
    const f = settings.timeFmt, per = $('ae-period');
    per.classList.toggle('hidden', f === 'h24');
    const btns = per.querySelectorAll('.apb');
    setText(btns[0], f === 'h12' ? tr('am') : tr('p_day'));
    setText(btns[1], f === 'h12' ? tr('pm') : tr('p_night'));
    btns.forEach((b) => b.classList.toggle('on', b.dataset.p === ed.period));
    $('ae-days').innerHTML = DAY_ORDER.map((dd) => `<button class="day${ed.days.includes(dd) ? ' on' : ''}" onclick="edDay(${dd})">${esc(tr('wds' + dd))}</button>`).join('');
    const key = ed.days.length === 0 ? 'once' : ed.days.length === 7 ? 'all' : (ed.days.length === 5 && [1, 2, 3, 4, 5].every((x) => ed.days.includes(x))) ? 'week' : (ed.days.length === 2 && ed.days.includes(0) && ed.days.includes(6)) ? 'end' : '';
    document.querySelectorAll('.rp').forEach((b) => b.classList.toggle('on', b.getAttribute('onclick').includes("'" + key + "'")));
    setText($('ae-err'), '');
}
function edKey(n) { if (ed.fresh) { ed.digits = ''; ed.fresh = false; } if (ed.digits.length < 4) ed.digits += n; renderEditor(); }
function edBack() { ed.fresh = false; ed.digits = ed.digits.slice(0, -1); renderEditor(); }
function edClear() { ed.fresh = false; ed.digits = ''; renderEditor(); }
function edPeriod(p) { ed.period = p; renderEditor(); }
function edDay(d) { ed.days = ed.days.includes(d) ? ed.days.filter((x) => x !== d) : ed.days.concat(d); renderEditor(); }
function edPreset(k) { ed.days = k === 'once' ? [] : k === 'all' ? [0, 1, 2, 3, 4, 5, 6] : k === 'week' ? [1, 2, 3, 4, 5] : [0, 6]; renderEditor(); }
function saveEditing() {
    const t = edToTime();
    if (!t) {
        setText($('ae-err'), tr('invalid_time'));
        const el = document.querySelector('.ae-digits'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
        try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) {}
        return;
    }
    const label = $('ae-label').value.trim();
    const data = { hour: t.h, minute: t.m, label, days: ed.days.slice().sort((a, b) => a - b), enabled: true, skip: 0 };
    if (ed.id) alarms = alarms.map((a) => a.id === ed.id ? { ...a, ...data } : a);
    else alarms.push({ id: Date.now(), ...data });
    sortAlarms(); renderAlarms(); saveState();
    closeSheet('alarm-sheet');
}
function deleteEditing() { const id = ed && ed.id; closeSheet('alarm-sheet'); if (id) setTimeout(() => removeAlarm(id), 60); }

/* ================= TIMERS: several at once, named, with interval rounds ================= */
function getTimer(id) { return timers.find((t) => t.id === id); }
function selTimer() { return getTimer(selTimerId) || timers[0]; }
function tRemaining(t) { return t.running ? Math.max(0, Math.ceil((t.endAt - Date.now()) / 1000)) : t.remaining; }
function phasesOf(t) {
    const ph = [];
    for (let r = 1; r <= t.rounds; r++) {
        ph.push({ k: 'work', r, sec: t.total });
        if (t.rest > 0 && r < t.rounds) ph.push({ k: 'rest', r, sec: t.rest });
    }
    return ph;
}
function isInterval(t) { return t.rounds > 1 || t.rest > 0; }
function phaseTextAt(t, idx) { const p = phasesOf(t)[idx]; return p ? (p.k === 'rest' ? tr('phase_rest') : tr('round_of', { a: p.r, b: t.rounds })) : ''; }
function resetTimerState(t) { t.running = false; t.endAt = 0; t.phase = 0; t.done = false; t.remaining = phasesOf(t)[0] ? phasesOf(t)[0].sec : t.total; }
function advanceTimer(t, now) {
    const res = { phase: false, done: false };
    const ph = phasesOf(t);
    let guard = 0;
    while (t.running && now >= t.endAt && guard++ < 400) {
        if (t.phase >= ph.length - 1) { t.running = false; t.done = true; t.remaining = 0; t.endAt = 0; res.done = true; break; }
        t.phase++; const sec = ph[t.phase].sec; t.endAt += sec * 1000; t.remaining = sec; res.phase = true;
    }
    return res;
}
function timerState(t) {
    if (t.running) return 'running';
    if (t.done) return 'done';
    const ph = phasesOf(t);
    return (t.phase > 0 || (ph[0] && t.remaining < ph[t.phase].sec)) ? 'paused' : 'ready';
}
function setTimerStatus() {
    const t = selTimer();
    const st = timerState(t);
    setText($('timer-status-badge'), tr({ ready: 'ready', running: 'running', paused: 'paused', done: 'completed' }[st]));
    setText($('timer-toggle-btn'), tr(st === 'running' ? 'pause' : st === 'paused' ? 'resume' : 'start'));
    $('timer-setup-controls').classList.toggle('locked', st === 'running');
    setText($('timer-round'), isInterval(t) && st !== 'ready' && st !== 'done' ? phaseTextAt(t, t.phase) : (isInterval(t) ? `${t.rounds} × ${fmtShort(t.total)} / ${fmtShort(t.rest)}` : ''));
}
function fmtShort(sec) { return sec % 60 === 0 && sec >= 60 ? (sec / 60) + 'm' : sec + 's'; }
function renderTimerDisplay(animate = true) {
    const t = selTimer();
    const rem = tRemaining(t);
    const hStr = pad2(Math.floor(rem / 3600)), mStr = pad2(Math.floor((rem % 3600) / 60)), sStr = pad2(rem % 60);
    updateFlipUnit('timer-h', hStr, animate);
    updateFlipUnit('timer-m', mStr, animate);
    updateFlipUnit('timer-s', sStr, animate);
    setNum($('tm-h'), hStr); setNum($('tm-m'), mStr); setNum($('tm-s'), sStr);
    const colon = document.querySelectorAll('.tm-text .c'); colon.forEach((c) => setNum(c, ':'));
    if (clockMode === 'analog') {
        setDial('dial-timer', 0, ((rem % 3600) / 60) * 6, (rem % 60) * 6);
        setNum($('timer-read'), rem >= 3600 ? `${hStr}:${mStr}:${sStr}` : `${mStr}:${sStr}`);
    }
}
function renderTimerChips() {
    const box = $('timer-chips');
    box.innerHTML = timers.map((t) => `<button class="tchip${t.id === selTimerId ? ' on' : ''}" onclick="selectTimer(${t.id})">${t.running ? '<i class="rd"></i>' : ''}<span class="nmx">${esc(t.name)}</span><span class="nm" data-t="${t.id}"></span></button>`).join('')
        + (timers.length < 8 ? '<button class="tchip add" onclick="addTimer()" aria-label="+">+</button>' : '');
    updateChipTimes();
}
function updateChipTimes() {
    timers.forEach((t) => { const el = document.querySelector(`#timer-chips .nm[data-t="${t.id}"]`); if (el) setNum(el, fmtHMS(tRemaining(t))); });
}
const INTERVAL_PRESETS = [{ n: 'Pomodoro', total: 1500, rest: 300, rounds: 4 }, { n: 'HIIT', total: 40, rest: 20, rounds: 8 }];
function renderPresets() {
    $('timer-presets').innerHTML = [60, 180, 300, 600, 900, 1800].map((s) => `<button class="preset" onclick="setTimerPreset(${s})">${esc(tr('n_min', { n: s / 60 }))}</button>`).join('')
        + INTERVAL_PRESETS.map((p, i) => `<button class="preset" onclick="applyIntervalPreset(${i})">${p.n} ${fmtShort(p.total)}/${fmtShort(p.rest)} ×${p.rounds}</button>`).join('');
}
function renderTimerUI() {
    const t = selTimer();
    setText($('timer-name-text'), t.name);
    setTimerStatus();
    renderPresets();
    renderTimerChips();
    renderTimerDisplay(false);
}
function selectTimer(id) { if (!getTimer(id)) return; selTimerId = id; renderTimerUI(); updateNowBar(); saveState(); }
function addTimer() {
    if (timers.length >= 8) return;
    const t = normTimer({ id: nextTimerId++, name: tr('timer_n', { n: timers.length + 1 }), total: 300 }, 0);
    timers.push(t); selTimerId = t.id;
    renderTimerUI(); saveState();
}
function editableTimer() { const t = selTimer(); return t.running ? null : t; }
function adjustTimer(unit, step) {
    const t = editableTimer(); if (!t) return;
    t.total = clamp(t.total + unit * step, 0, 359999);
    resetTimerState(t); renderTimerUI(); saveState();
}
function setTimerPreset(sec) { const t = editableTimer(); if (!t) return; t.total = sec; resetTimerState(t); renderTimerUI(); saveState(); }
function applyIntervalPreset(i) {
    const t = editableTimer(); if (!t) return;
    const p = INTERVAL_PRESETS[i]; t.total = p.total; t.rest = p.rest; t.rounds = p.rounds;
    resetTimerState(t); renderTimerUI(); saveState();
}
function toggleTimer() {
    ensureAudioContext();
    const t = selTimer();
    if (t.running) {
        t.remaining = Math.max(0, Math.ceil((t.endAt - Date.now()) / 1000));
        t.running = false; t.endAt = 0;
    } else {
        if (t.done || t.phase >= phasesOf(t).length) resetTimerState(t);
        if (t.remaining <= 0) resetTimerState(t);
        if (t.remaining <= 0) return;
        t.running = true; t.done = false; t.endAt = Date.now() + t.remaining * 1000;
    }
    renderTimerUI(); updateNowBar(); saveState();
}
function resetTimer() { resetTimerState(selTimer()); renderTimerUI(); updateNowBar(); saveState(); }
function phaseNotice(t) {
    showBanner(t.name, phaseTextAt(t, t.phase) + ' · ' + fmtHMS(t.remaining), { kind: 'phase', ms: 2800, actions: [] });
    if (!nativeRingActive()) playBeepPattern();
}
function timersTick() {
    const now = Date.now();
    let changed = false;
    timers.forEach((t) => {
        if (!t.running) return;
        const r = advanceTimer(t, now);
        if (r.done) { changed = true; triggerAlert(t.name, tr('timer_done_text')); }
        else if (r.phase) { changed = true; phaseNotice(t); }
    });
    if (changed) { saveState(); renderTimerUI(); updateNowBar(); return; }
    if (selTimer().running) renderTimerDisplay(true);
    updateChipTimes();
}
/* the timer pop-up editor */
function openTimerEditor() {
    const t = selTimer();
    $('te-name').value = t.name;
    setNum($('te-rounds'), String(t.rounds));
    setNum($('te-rest'), `${Math.floor(t.rest / 60)}:${pad2(t.rest % 60)}`);
    openSheet('timer-sheet');
}
function teName(v) { const t = selTimer(); t.name = v.slice(0, 20); setText($('timer-name-text'), t.name || ' '); renderTimerChips(); saveState(); }
function teRounds(d) { const t = editableTimer(); if (!t) return; t.rounds = clamp(t.rounds + d, 1, 99); resetTimerState(t); setNum($('te-rounds'), String(t.rounds)); renderTimerUI(); saveState(); }
function teRest(d) { const t = editableTimer(); if (!t) return; t.rest = clamp(t.rest + d, 0, 3599); resetTimerState(t); setNum($('te-rest'), `${Math.floor(t.rest / 60)}:${pad2(t.rest % 60)}`); renderTimerUI(); saveState(); }
function deleteTimer() {
    if (timers.length <= 1) { const t = selTimer(); Object.assign(t, normTimer({ id: t.id, name: tr('timer_n', { n: 1 }), total: 300 }, 0)); }
    else { timers = timers.filter((t) => t.id !== selTimerId); selTimerId = timers[0].id; }
    closeSheet('timer-sheet'); renderTimerUI(); updateNowBar(); saveState();
}
/* every future phase end of every running timer, so the phone can ring them with the app closed */
function nativeEvents() {
    const ev = [];
    timers.forEach((t) => {
        if (!t.running) return;
        const ph = phasesOf(t);
        let at = t.endAt;
        for (let k = t.phase; k < ph.length; k++) {
            if (k > t.phase) at += ph[k].sec * 1000;
            const last = k === ph.length - 1;
            ev.push({ at, title: t.name, text: last ? tr('timer_done_text') : phaseTextAt(t, k + 1), last });
        }
    });
    ev.sort((a, b) => a.at - b.at);
    return ev.slice(0, 90);
}

/* ================= STOPWATCH & LAPS ================= */
function currentSwMs() { return swRunning ? swElapsedMs + (performance.now() - swStartTime) : swElapsedMs; }
function renderStopwatchDisplay(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const mStr = pad2(Math.floor(totalSeconds / 60) % 100);
    const sStr = pad2(totalSeconds % 60);
    const csStr = pad2(Math.floor((ms % 1000) / 10));
    if (clockMode === 'flip') {
        updateFlipUnit('sw-m', mStr, true);
        updateFlipUnit('sw-s', sStr, true);
        updateFlipUnit('sw-c', csStr, false);
    } else if (clockMode === 'digital') {
        setNum($('sw-ms'), `${mStr}:${sStr}`);
        setNum($('sw-cs'), `.${csStr}`);
    } else {
        setDial('dial-sw', 0, ((ms / 60000) % 60) * 6, ((ms / 1000) % 60) * 6);
        setNum($('sw-read'), `${mStr}:${sStr}.${csStr}`);
    }
}
function formatStopwatchString(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    return `${pad2(Math.floor(totalSeconds / 60))}:${pad2(totalSeconds % 60)}.${pad2(Math.floor((ms % 1000) / 10))}`;
}
function updateSwButtons() {
    const p = $('sw-primary-btn'), s = $('sw-secondary-btn');
    setText(p, tr(swRunning ? 'stop' : swElapsedMs > 0 ? 'resume' : 'start'));
    setText(s, tr(swRunning || swElapsedMs === 0 ? 'lap' : 'reset'));
    s.disabled = !swRunning && swElapsedMs === 0;
}
let swFrame = 0;
function tickStopwatch() {
    if (!swRunning) return;
    swFrame++;
    if (clockMode !== 'analog' || swFrame % 2 === 0) renderStopwatchDisplay(swElapsedMs + (performance.now() - swStartTime));   // dial at 30 fps keeps it light
    swRafId = requestAnimationFrame(tickStopwatch);
}
function toggleStopwatch() {
    ensureAudioContext();
    if (swRunning) {
        swElapsedMs += performance.now() - swStartTime;
        swRunning = false;
        cancelAnimationFrame(swRafId);
        renderStopwatchDisplay(swElapsedMs);
    } else {
        swStartTime = performance.now();
        swRunning = true;
        swRafId = requestAnimationFrame(tickStopwatch);
    }
    updateSwButtons(); updateNowBar();
}
function lapOrResetStopwatch() {
    if (swRunning) {
        const totalMs = swElapsedMs + (performance.now() - swStartTime);
        const splitMs = totalMs - lastLapTotalMs;
        lastLapTotalMs = totalMs;
        swLaps.unshift({ number: swLaps.length + 1, split: splitMs, total: totalMs });
        renderLaps();
    } else {
        swElapsedMs = 0; lastLapTotalMs = 0; swLaps = [];
        renderStopwatchDisplay(0);
        renderLaps();
    }
    updateSwButtons(); updateNowBar();
}
function renderLaps() {
    const listEl = $('lap-list');
    if (swLaps.length === 0) { listEl.innerHTML = `<div class="laps-empty">${esc(tr('no_laps'))}</div>`; return; }
    let fastest = Infinity, slowest = -Infinity;
    if (swLaps.length >= 2) swLaps.forEach((l) => { if (l.split < fastest) fastest = l.split; if (l.split > slowest) slowest = l.split; });
    listEl.innerHTML = swLaps.map((lap) => {
        let badge = '';
        if (swLaps.length >= 2) {
            if (lap.split === fastest) badge = `<span class="tagb best">${esc(tr('best'))}</span>`;
            else if (lap.split === slowest) badge = `<span class="tagb slow">${esc(tr('slow'))}</span>`;
        }
        return `<div class="lap"><span class="n">#${pad2(lap.number)}${badge}</span><span class="s">${formatStopwatchString(lap.split)}</span><span class="t">${formatStopwatchString(lap.total)}</span></div>`;
    }).join('');
}

/* ================= ELASTIC SCROLL BOUNCE ================= */
function attachBounce(sc) {
    const inner = sc.firstElementChild;
    if (!inner) return;
    let mode = 0, base = 0, last = 0;
    const rub = (d) => 110 * (1 - Math.exp(-d / 260));
    sc.addEventListener('touchstart', (e) => { last = e.touches[0].clientY; mode = 0; inner.style.transition = 'none'; }, { passive: true });
    sc.addEventListener('touchmove', (e) => {
        const y = e.touches[0].clientY;
        if (!mode) {
            const atTop = sc.scrollTop <= 0;
            const atBot = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1;
            if (atTop && y > last) { mode = 1; base = y; } else if (atBot && y < last) { mode = -1; base = y; }
        }
        if (mode) {
            const d = (y - base) * mode;
            if (d < 0) { mode = 0; inner.style.transform = ''; }
            else { if (e.cancelable) e.preventDefault(); inner.style.transform = `translate3d(0,${mode * rub(d)}px,0)`; }
        }
        last = y;
    }, { passive: false });
    const end = () => {
        if (!inner.style.transform) return;
        inner.style.transition = 'transform .6s cubic-bezier(.34,1.7,.55,1)';
        inner.style.transform = '';
        mode = 0;
    };
    sc.addEventListener('touchend', end, { passive: true });
    sc.addEventListener('touchcancel', end, { passive: true });
}

/* ================= NATIVE ALARM ENGINE (rings with the app closed / phone locked) ================= */
let nativeActive = false;
let nativeSyncing = false;
let nativeResync = false;
let nativeSyncTimer = null;
let relStatus = null;

function scheduleNativeSync() {
    if (!isNativeApp) return;
    clearTimeout(nativeSyncTimer);
    nativeSyncTimer = setTimeout(nativeSync, 250);
}
function nativePayload() {
    const now = Date.now();
    return {
        alarms: JSON.stringify(alarms.map((a) => ({ id: a.id, hour: a.hour, minute: a.minute, label: a.label || tr('default_label'), enabled: !!a.enabled, days: a.days, skip: a.skip > now ? a.skip : 0 }))),
        events: JSON.stringify(nativeEvents()),
        settings: JSON.stringify({ snoozeMin: settings.snoozeMin, gradual: !!settings.gradual, vibrate: !!settings.vibrate, challenge: settings.challenge })
    };
}
async function nativeSync() {
    if (!isNativeApp) return;
    if (nativeSyncing) { nativeResync = true; return; }
    nativeSyncing = true;
    try {
        await nativeCall('ClockAlarm', 'sync', nativePayload());
        nativeActive = true;
    } catch (e) {
        console.error('native alarm sync failed', e);
    } finally {
        nativeSyncing = false;
        if (nativeResync) { nativeResync = false; scheduleNativeSync(); }
    }
}
/* one-time alarms that already rang while the app was closed switch themselves off here */
async function consumeFired() {
    if (!isNativeApp) return;
    try {
        const r = await nativeCall('ClockAlarm', 'getFired');
        const ids = String((r && r.ids) || '').split(',').filter(Boolean).map(Number);
        let changed = false;
        ids.forEach((id) => { const a = alarms.find((x) => x.id === id); if (a && a.enabled && a.days.length === 0) { a.enabled = false; changed = true; } });
        if (changed) { renderAlarms(); saveState(); }
    } catch (e) {}
}
async function ensureNotificationPermission() {
    if (!isNativeApp) return;
    try {
        const p = await nativeCall('LocalNotifications', 'checkPermissions');
        if (p && p.display !== 'granted') await nativeCall('LocalNotifications', 'requestPermissions');
    } catch (e) {}
    refreshRel();
}
async function refreshRel() {
    if (!isNativeApp) return;
    try { relStatus = await nativeCall('ClockAlarm', 'getStatus'); } catch (e) { relStatus = null; }
    renderRel();
}
function renderRel() {
    const card = $('rel-card');
    if (!isNativeApp) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    const okN = !relStatus || relStatus.notifications !== false;
    const okB = !relStatus || relStatus.battery !== false;
    card.classList.toggle('ok', okN && okB);
    setText($('rel-title'), tr(okN && okB ? 'rel_title_ok' : 'rel_title_fix'));
    setText($('rel-sub'), tr(okN && okB ? 'rel_sub_ok' : 'rel_sub_fix'));
    $('rel-notif').classList.toggle('ok', okN);
    $('rel-batt').classList.toggle('ok', okB);
}
function openReliability() { openSheet('rel-modal'); }
async function relFix(page) {
    try {
        if (page === 'notifications') {
            const r = await nativeCall('LocalNotifications', 'requestPermissions');
            if (r && r.display === 'granted') { refreshRel(); return; }
        }
        await nativeCall('ClockAlarm', 'openSettings', { page });
    } catch (e) {
        try { await nativeCall('ClockAlarm', 'openSettings', { page: 'app' }); } catch (e2) {}
    }
}
async function testAlarm() {
    try {
        await nativeCall('ClockAlarm', 'test', { seconds: '10' });
        closeSheet('rel-modal');
        showBanner(tr('test_set'), tr('test_sub'), { kind: 'tip', ms: 6000 });
    } catch (e) {
        showBanner(tr('test_fail'), tr('test_fail_s'), { kind: 'tip', ms: 5000 });
    }
}

/* ================= SETTINGS ================= */
function openSettings() { openSheet('settings-sheet'); }
function syncSettingsUI() {
    document.querySelectorAll('.seg[data-set]').forEach((seg) => {
        const btns = Array.from(seg.querySelectorAll('button'));
        btns.forEach((b) => b.classList.add('seg-btn'));
        let idx = btns.findIndex((b) => b.dataset.v === String(settings[seg.dataset.set]));
        if (idx < 0) idx = 0;
        seg.style.setProperty('--si', idx);
        btns.forEach((b, i) => b.classList.toggle('on', i === idx));
    });
    document.querySelectorAll('.switch[data-set]').forEach((sw) => sw.classList.toggle('on', !!settings[sw.dataset.set]));
    document.querySelectorAll('#accents button').forEach((b) => b.classList.toggle('on', b.dataset.accent === settings.accent));
    $('rel-open-row').classList.toggle('hidden', !isNativeApp);
}
function setSetting(k, v) {
    settings[k] = v;
    if (k === 'lang') settings.cal = v === 'am' ? 'eth' : 'greg';       // Amharic comes with the Ethiopian calendar (change it below if you like)
    if (k === 'accent') applyAccent();
    saveState();
    if (k === 'lang') applyI18n();
    if (k === 'lang' || k === 'cal' || k === 'timeFmt') refreshAll();
    syncSettingsUI();
}
function toggleSetting(k) { setSetting(k, !settings[k]); }
function refreshAll() {
    updateLiveClock(); renderAlarms(); renderTimerUI(); renderStopwatchDisplay(currentSwMs()); updateSwButtons(); renderLaps(); renderRel(); updateNowBar();
}
document.addEventListener('click', (e) => {
    const b = e.target.closest('.seg[data-set] button');
    if (b) { const seg = b.closest('.seg'); setSetting(seg.dataset.set, seg.dataset.num ? +b.dataset.v : b.dataset.v); return; }
    const ac = e.target.closest('#accents button');
    if (ac) setSetting('accent', ac.dataset.accent);
});

/* ================= BEDSIDE MODE ================= */
const DIMS = [0, 0.5, 0.82];
let bedDimLevel = 0, bedCtlT = null, bedShiftT = null;
function openBedside() { openSheet('bedside'); }
function bedStart() {
    updateLiveClock(); updateNextAlarmSummary();
    $('bed-dim').style.opacity = DIMS[bedDimLevel];
    bedTap();
    requestWakeLock();
    clearInterval(bedShiftT);
    bedShiftT = setInterval(() => {                      // tiny drift every minute protects the screen from burn-in
        const el = $('bed-shift');
        el.style.setProperty('--bx', Math.round(Math.random() * 28 - 14) + 'px');
        el.style.setProperty('--by', Math.round(Math.random() * 28 - 14) + 'px');
    }, 60000);
}
function bedStop() { clearInterval(bedShiftT); clearTimeout(bedCtlT); $('bed-ctl').classList.remove('show'); }
function bedTap() {
    $('bed-ctl').classList.add('show');
    clearTimeout(bedCtlT);
    bedCtlT = setTimeout(() => $('bed-ctl').classList.remove('show'), 4000);
}
function bedDim() { bedDimLevel = (bedDimLevel + 1) % DIMS.length; $('bed-dim').style.opacity = DIMS[bedDimLevel]; bedTap(); }

/* ================= PWA (browser only - hidden inside the Android app) ================= */
if (!isNativeApp && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
let deferredPrompt = null;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standaloneQuery = window.matchMedia('(display-mode: standalone)');
const INSTALLED_KEY = 'flipclock.installed';
function isInstalledApp() { return standaloneQuery.matches || navigator.standalone === true; }
function updateInstallUI() {
    let installedFlag = false;
    try { installedFlag = localStorage.getItem(INSTALLED_KEY) === '1'; } catch (e) {}
    $('front-install-btn').classList.toggle('show', !isNativeApp && !isInstalledApp() && !installedFlag);
}
function markInstalled() { try { localStorage.setItem(INSTALLED_KEY, '1'); } catch (e) {} deferredPrompt = null; updateInstallUI(); }
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; try { localStorage.removeItem(INSTALLED_KEY); } catch (err) {} updateInstallUI(); });
window.addEventListener('appinstalled', markInstalled);
if (standaloneQuery.addEventListener) standaloneQuery.addEventListener('change', updateInstallUI);
function installPWA() {
    if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt.userChoice.then((c) => { deferredPrompt = null; if (c.outcome === 'accepted') markInstalled(); }); }
    else if (isIOS) showBanner('Install on iPhone', 'Tap Share, then "Add to Home Screen"', { ms: 6000 });
    else showBanner('Install App', 'Open the browser menu, then tap "Install app" or "Add to Home screen"', { ms: 6000 });
}
let wakeLock = null;
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator && !wakeLock) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
        }
    } catch (e) {}
}

/* ================= INITIALIZATION ================= */
function init() {
    const s = loadState();
    settings = Object.assign({}, DEFAULTS, s.settings || {});
    if (!s.settings) {                                   // upgrade from the earlier version
        if (s.use24Hour === false) settings.timeFmt = 'h12';
        if (s.isMuted) settings.sound = false;
    }
    themeChosen = !!s.themeChosen;
    theme = themeChosen && s.theme === 'dark' ? 'dark' : 'light';      // light unless the user chose dark
    clockMode = MODES.includes(s.clockMode) ? s.clockMode : 'flip';
    alarms = (Array.isArray(s.alarms) ? s.alarms : []).map(normAlarm);
    sortAlarms();
    timers = (Array.isArray(s.timers) ? s.timers : []).map(normTimer);
    if (!timers.length) {
        const old = s.timer || {};
        timers = [normTimer({ id: 1, name: tr('timer_n', { n: 1 }), total: old.total != null ? old.total : 300, remaining: old.remaining, running: old.running, endAt: old.endAt }, 0)];
    }
    selTimerId = timers.some((t) => t.id === s.selTimerId) ? s.selTimerId : timers[0].id;
    nextTimerId = Math.max(+s.nextTimerId || 2, ...timers.map((t) => t.id + 1));

    applyTheme(theme);
    applyAccent();
    applyI18n();
    initFlipUnits();
    calibrateFlipFont();
    if (document.fonts && document.fonts.load) {
        document.fonts.load('400 100px "Bebas Neue"').then(calibrateFlipFont, calibrateFlipFont);
        if (document.fonts.ready) document.fonts.ready.then(calibrateFlipFont);
    }
    ['dial-clock', 'dial-timer', 'dial-sw'].forEach(initDial);

    let finishedWhileAway = false;
    const now0 = Date.now();
    timers.forEach((t) => { if (t.running) { const r = advanceTimer(t, now0); if (r.done) finishedWhileAway = true; } });

    setClockMode(clockMode, false);
    renderAlarms();
    renderLaps();
    renderTimerUI();
    updateSwButtons();
    updateNowBar();
    renderRel();
    syncSettingsUI();
    if (finishedWhileAway) showBanner(tr('timer_done'), tr('timer_done_text'));

    (function loop() {
        updateLiveClock();
        updateNextAlarmSummary();
        setTimeout(loop, 1000 - (Date.now() % 1000) + 5);
    })();
    setInterval(timersTick, 250);
    setInterval(updateNowBar, 250);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) { updateLiveClock(); timersTick(); requestWakeLock(); checkNativeRinging(); consumeFired(); refreshRel(); }
    });
    document.addEventListener('pointerdown', () => { ensureAudioContext(); requestWakeLock(); }, { passive: true });
    requestWakeLock();

    document.querySelectorAll('.scroll').forEach(attachBounce);
    ['.clock-stack', '.tm-display', '.sw-display'].forEach((q) => { const el = document.querySelector(q); if (el) attachModeSwipe(el); });
    updateInstallUI();

    if (isNativeApp) {
        scheduleNativeSync();
        checkNativeRinging();
        consumeFired();
        setTimeout(ensureNotificationPermission, 900);
    }

    requestAnimationFrame(() => requestAnimationFrame(() => {      // transitions switch on after the first painted frame
        document.documentElement.classList.add('ready');
        enterAnim($('view-clock'));
    }));
}

init();
