(function () { try {
/* ===== AI 功能联动（本地新增，独立模块） =====
统一入口 window.mochiAiTrigger(kind, data)；上下文 window.__aiContextString()。
联动项：经期 / 纪念日 / 日历 / 心情 / 时间 / 占卜 / 朋友圈 / 久未回复。
配置（全局 localStorage）：ai-link-<kind>（'1'/'0'）、ai-link-cd（冷却分钟）、ai-link-silence-min。
====================================================== */
(function () {
'use strict';
const G = 'xy-home-v2';
const KIND = {
period: 'ai-link-period', anniv: 'ai-link-anniv', cal: 'ai-link-cal',
mood: 'ai-link-mood', time: 'ai-link-time', divine: 'ai-link-divine',
feed: 'ai-link-feed', silence: 'ai-link-silence'
};
const K_CD = 'ai-link-cd';
const K_SIL_MIN = 'ai-link-silence-min';
function gGet(k) { try { return window.localStorage.getItem(G + ':' + k); } catch (e) { return null; } }
function gSet(k, v) { try { window.localStorage.setItem(G + ':' + k, v); } catch (e) {} }
function on(kind) { return gGet(KIND[kind]) !== '0'; } // 默认全开
function cdMs() { return Math.max(1, Number(gGet(K_CD) || 30)) * 60000; }
function silMin() { return Math.max(1, Number(gGet(K_SIL_MIN) || 30)); }
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function todayStr() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function daysUntilStr(ds) {
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const d = new Date(String(ds) + 'T00:00:00');
if (isNaN(d.getTime())) return NaN;
return Math.round((d - today) / 864e5);
}
function daysUntilMD(month, day) {
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
let target = new Date(now.getFullYear(), month, day);
if (target < today) target = new Date(now.getFullYear() + 1, month, day);
return Math.round((target - today) / 864e5);
}
let lastFireAt = 0;
function canFire(kind) {
if (!window.__aiChatMode || !window.__aiChatMode()) return false;
if (!on(kind)) return false;
if (Date.now() - lastFireAt < cdMs()) return false;
if (kind === 'period' || kind === 'anniv' || kind === 'cal') {
if (gGet('ai-link-last-' + kind) === todayStr()) return false;
}
return true;
}
function fire(kind, instruction, extraSystem) {
if (!canFire(kind)) return false;
lastFireAt = Date.now();
if (kind === 'period' || kind === 'anniv' || kind === 'cal') gSet('ai-link-last-' + kind, todayStr());
try { if (window.__aiSay) window.__aiSay(instruction, extraSystem); } catch (e) {}
return true;
}
window.mochiAiTrigger = function (kind, data) {
data = data || {};
try {
if (kind === 'feed') {
const txt = String(data.text || '').slice(0, 120);
if (!txt) return;
fire('feed', '用户刚发了一条朋友圈：「' + txt + '」。请以爱人身份在聊天里自然地回应或评论一句，像日常接话，不要解释。');
}
} catch (e) {}
};
window.__aiContextString = function () {
const parts = [];
if (on('time')) {
const d = new Date(), h = d.getHours();
const label = h < 6 ? '凌晨' : h < 9 ? '清晨' : h < 12 ? '上午' : h < 14 ? '中午' : h < 18 ? '下午' : h < 23 ? '晚上' : '深夜';
const wd = '日一二三四五六'.charAt(d.getDay());
parts.push('当前时间：' + todayStr() + ' 星期' + wd + ' ' + pad(h) + ':' + pad(d.getMinutes()) + '（' + label + '）');
}
if (on('mood') && window.moodDiaryToday) {
try {
const m = window.moodDiaryToday();
if (m && m.mine) {
const n = m.mine.n || '已记录';
const note = m.mine.note ? '，备注：' + String(m.mine.note).slice(0, 60) : '';
parts.push('用户今天的心情：' + n + note);
}
} catch (e) {}
}
if (on('divine') && window.divineHistLoad) {
try {
const h = window.divineHistLoad();
if (Array.isArray(h) && h.length) {
const last = h[h.length - 1] || h[0] || {};
const txt = last.summary || last.question || last.text || last.q || last.name || '';
if (txt) parts.push('用户最近一次占卜：' + String(txt).slice(0, 120));
}
} catch (e) {}
}
try {
const raw = window.xyStore ? window.xyStore('xy-home-v2').get('feed-posts') : null;
if (raw) {
const arr = JSON.parse(raw);
if (Array.isArray(arr) && arr.length) {
const lines = arr.slice(0, 4).map(function (p) {
const who = (p && (p.role === 'me' || p.by === 'me')) ? '我' : ((p && (p.taName || p.authorName)) || 'TA');
const txt = String((p && p.content) || '').replace(/\s+/g, ' ').slice(0, 50);
return txt ? '· ' + who + '：' + txt : '';
}).filter(Boolean);
if (lines.length) parts.push('最近的动态：\n' + lines.join('\n'));
}
}
} catch (e) {}
try {
const st = window.activeStore ? window.activeStore() : null;
const raw = st ? st.get('mail-letters') : null;
if (raw) {
const arr = JSON.parse(raw);
if (Array.isArray(arr) && arr.length) {
const lines = arr.slice(0, 3).map(function (l) {
if (!l) return '';
if (l.partnerReply) return 'TA 回信：' + String(l.partnerReply.content || '').replace(/\s+/g, ' ').slice(0, 50);
if (l.type === 'sent' && l.myReply) return '我写给 TA：' + String(l.myReply.content || '').replace(/\s+/g, ' ').slice(0, 50);
if (l.type === 'received') return 'TA 来信：' + String(l.content || '').replace(/\s+/g, ' ').slice(0, 50);
return '';
}).filter(Boolean);
if (lines.length) parts.push('最近的信：\n' + lines.join('\n'));
}
}
} catch (e) {}
return parts.length ? ('【当前上下文】\n' + parts.join('\n')) : '';
};
function checkPeriod() {
if (!window.periodStatus) return;
let st;
try { st = window.periodStatus(); } catch (e) { return; }
if (!st || st.phase === 'unknown') return;
if (st.inPeriod) {
const day = Number(st.dayOfCycle) || 0;
if (day >= 1 && day <= 3) fire('period', '用户正在经期第 ' + day + ' 天。请以爱人身份温柔关心她，提醒保暖、多喝热水、别太累。');
return;
}
if (st.delayed) {
fire('period', '用户的经期已经推迟了（周期第 ' + (st.dayOfCycle || '?') + ' 天）。请以爱人身份温柔关心，问问她最近是不是太累、注意身体，不要过度催问。');
return;
}
if (st.nextStart) {
const days = daysUntilStr(st.nextStart);
if (days >= 0 && days <= 3) {
fire('period', '用户的经期大约还有 ' + days + ' 天就到了。请以爱人身份关心她，提醒注意保暖、别太累，可以提前准备。');
}
}
}
function checkAnniv() {
const s = window.activeStore ? window.activeStore() : null;
if (!s) return;
const cands = [];
try {
const start = s.get('love-start');
if (start) {
const d = new Date(String(start) + 'T00:00:00');
if (!isNaN(d.getTime())) {
const dd = daysUntilMD(d.getMonth(), d.getDate());
if (dd >= 0 && dd <= 1) cands.push({ name: '在一起纪念日', days: dd });
}
}
} catch (e) {}
try {
const extras = JSON.parse(s.get('mem-extras') || '[]');
(extras || []).forEach(it => {
if (!it || !it.date) return;
const d = new Date(String(it.date) + 'T00:00:00');
if (isNaN(d.getTime())) return;
const dd = daysUntilMD(d.getMonth(), d.getDate());
if (dd >= 0 && dd <= 1) cands.push({ name: it.name || '纪念日', days: dd });
});
} catch (e) {}
if (cands.length) {
const c = cands[0];
fire('anniv', '今天是你们的「' + c.name + '」（' + (c.days === 0 ? '就是今天' : '还有 ' + c.days + ' 天') + '）。请以爱人身份说一句纪念日的话，表达在意与陪伴。');
}
}
function checkCalendar() {
if (!window.calGetDayEntry) return;
let e;
try { e = window.calGetDayEntry(todayStr()); } catch (err) { return; }
if (!e) return;
const txt = e.title || e.text || e.note || e.name || (typeof e === 'string' ? e : '');
if (txt && String(txt).trim()) {
fire('cal', '今天是日历上的特殊日子：「' + String(txt).slice(0, 80) + '」。请以爱人身份自然地问候或提起。');
}
}
function checkSilence() {
if (!window.__aiLastMsg) return;
let last;
try { last = window.__aiLastMsg(); } catch (e) { return; }
if (!last || !last.ts) return;
if (Date.now() - last.ts < silMin() * 60000) return;
const mins = Math.round((Date.now() - last.ts) / 60000);
fire('silence', '用户已经大约 ' + mins + ' 分钟没说话了。请以爱人身份主动关心一句，问问在忙什么、累不累，语气自然，不要质问。');
}
function dailyTick() {
try { checkPeriod(); } catch (e) {}
try { checkAnniv(); } catch (e) {}
try { checkCalendar(); } catch (e) {}
}
function bindToggles() {
Object.keys(KIND).forEach(kind => {
const el = document.getElementById('ai-link-' + kind);
if (!el) return;
el.checked = on(kind);
el.addEventListener('change', function () { gSet(KIND[kind], el.checked ? '1' : '0'); });
});
const cd = document.getElementById('ai-link-cd');
if (cd) { cd.value = gGet(K_CD) || 30; cd.addEventListener('change', function () { gSet(K_CD, String(Math.max(1, Number(cd.value) || 30))); }); }
const sm = document.getElementById('ai-link-silence-min');
if (sm) { sm.value = gGet(K_SIL_MIN) || 30; sm.addEventListener('change', function () { gSet(K_SIL_MIN, String(Math.max(1, Number(sm.value) || 30))); }); }
}
function resync() {
Object.keys(KIND).forEach(kind => {
const el = document.getElementById('ai-link-' + kind);
if (el) el.checked = on(kind);
});
const cd = document.getElementById('ai-link-cd');
if (cd) cd.value = gGet(K_CD) || 30;
const sm = document.getElementById('ai-link-silence-min');
if (sm) sm.value = gGet(K_SIL_MIN) || 30;
}
function init() {
bindToggles();
setTimeout(dailyTick, 9000);
setInterval(dailyTick, 60 * 60 * 1000);
setInterval(function () { try { checkSilence(); } catch (e) {} }, 5 * 60 * 1000);
document.addEventListener('mochi-restore-done', function () { setTimeout(dailyTick, 4000); resync(); });
}
if (document.body) init();
else document.addEventListener('DOMContentLoaded', init);
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("ai-link.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("ai-link.js"); try { console.error("[JS] ai-link.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[ai-link.js] " + String(__e && __e.message || __e)); } })();