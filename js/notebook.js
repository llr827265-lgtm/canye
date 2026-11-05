(function () { try {
/* ===== 记事本（本地新增，独立模块，不影响其他功能） =====
数据：per-contact 键 notebook-entries（JSON 数组）
[{ id, date, weather, mood, text, replies:[{who,text,ts}], lastReplyText, ts }]
页面：列表页 page-notebook-list（管理/批量/三点菜单） + 书写页 page-notebook
回复：AI 模式走 window.__aiGenerate（人设+全站记忆，不写聊天）；
字卡模式【零 AI】——只从字卡库（系统自带 + 用户上传）随机抽卡 + 颜文字/表情。
保存后随机三种情形：立刻回 / 延时回（锁定当时的模式）/ 不回。
====================================================== */
(function () {
'use strict';
const G = 'xy-home-v2:';
const KEY = 'notebook-entries';
const SKIN_KEY = 'notebook-skin';
function store() { try { return window.activeStore(); } catch (e) { return null; } }
function load() {
try { const s = store(); const raw = s && s.get(KEY); const a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; } catch (e) { return []; }
}
function save(arr) {
try {
const s = store(); if (!s) return; const v = JSON.stringify(arr);
s.set(KEY, v);
try { if (window.idbSet) window.idbSet(window.activePrefix() + ':' + KEY, v); } catch (e) {}
} catch (e) {}
}
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function todayStr() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function dateToTs(s) {
const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
if (!m) return 0;
const t = new Date(+m[1], +m[2] - 1, +m[3]).getTime();
return isNaN(t) ? 0 : t;
}
function uid() { return 'nb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function toast(m) { try { if (window.toast) window.toast(m); } catch (e) {} }
function el(id) { return document.getElementById(id); }
const EMOJI = ['🌙', '☀️', '🌿', '✨', '🫶', '💛', '🌸', '🍃', '☕', '🌧️', '🍂', '🫧', '🌼', '🕯️', '📖', '🫖'];
const KAOMOJI = ['(｡･ω･｡)', '(๑•̀ㅂ•́)و✧', '(´｡• ᵕ •｡`)', '( ˘ ³˘)♥', '(*/ω＼*)', '(๑>؂<๑)', '(￣▽￣)~*', '(´▽`ʃ♡ƪ)'];
const WEATHERS = ['☀️ 晴', '⛅ 多云', '☁️ 阴', '🌧️ 雨', '⛈️ 雷雨', '❄️ 雪', '🌫️ 雾', '🌬️ 风'];
const MOODS = ['😊 开心', '😌 平静', '🥰 想你', '😪 困', '😐 一般', '😔 难过', '😤 有点烦', '✨ 充实'];
const SKINS = [
{ value: 'theme', label: '白色' },
{ value: 'green', label: '绿色' },
{ value: 'black', label: '黑色' }
];
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickMedia() {
const d = window.DEFAULT_CARD_DATA || {};
const pool = [];
[d.kaomoji, d.emoji].forEach(function (gs) {
if (!Array.isArray(gs)) return;
gs.forEach(function (g) { if (g && Array.isArray(g[1])) pool.push.apply(pool, g[1]); });
});
if (pool.length) {
const v = pool[Math.floor(Math.random() * pool.length)];
if (v) return String(v);
}
return Math.random() < 0.6 ? pick(EMOJI) : pick(KAOMOJI);
}
function pickCard() {
const pool = [];
try {
const d = window.DEFAULT_CARD_DATA || {};
(d.main || []).forEach(function (g) {
if (!g || !Array.isArray(g[1])) return;
g[1].forEach(function (c) {
if (!c) return;
try { if (window.isDefaultCardOff && window.isDefaultCardOff('main', c)) return; } catch (e) {}
pool.push(c);
});
});
} catch (e) {}
try {
const s = store();
const rawOwn = s ? s.get('cc-groups') : null;
const rawPub = window.xyStore ? window.xyStore('xy-home-v2').get('cc-groups-public') : null;
[rawOwn, rawPub].forEach(function (raw) {
if (!raw) return;
let obj;
try { obj = JSON.parse(raw); } catch (e) { return; }
(obj.text || []).forEach(function (grp) {
(grp[1] || []).forEach(function (c) {
if (typeof c !== 'string' || !c || c.indexOf('|||') >= 0 || c.indexOf('@@m:') === 0 || c.indexOf('data:') === 0 || /^https?:\/\//i.test(c)) return;
pool.push(c);
});
});
});
} catch (e) {}
return pool.length ? pick(pool) : '';
}
let curId = '';
let undoStack = [];
let lastText = '';
let batchMode = false;
let selected = {};
let pressTimer = null;
let suppressClick = false;
function ensureToday() {
const entries = load();
const today = todayStr();
let e = entries.filter(function (x) { return x && x.date === today; })[0];
if (!e) {
e = { id: uid(), date: today, weather: '☀️ 晴', mood: '😊 平静', text: '', replies: [], ts: Date.now() };
entries.push(e);
save(entries);
}
curId = e.id;
return e;
}
function curEntry() {
const entries = load();
return entries.filter(function (x) { return x && x.id === curId; })[0] || null;
}
function patchCur(patch) {
const entries = load();
const e = entries.filter(function (x) { return x && x.id === curId; })[0];
if (!e) return;
Object.keys(patch).forEach(function (k) { e[k] = patch[k]; });
save(entries);
}
function skin() { try { const s = store(); return (s && s.get(SKIN_KEY)) || 'theme'; } catch (e) { return 'theme'; } }
function applySkin() {
const s = skin();
const paper = el('nb-paper');
if (paper) {
paper.classList.remove('nb-skin-theme', 'nb-skin-green', 'nb-skin-black');
paper.classList.add('nb-skin-' + s);
}
const page = el('page-notebook');
if (page) {
page.classList.remove('nb-page-skin-theme', 'nb-page-skin-green', 'nb-page-skin-black');
page.classList.add('nb-page-skin-' + s);
}
const phone = document.querySelector('.phone');
if (phone) {
phone.classList.remove('nb-phone-skin-theme', 'nb-phone-skin-green', 'nb-phone-skin-black');
phone.classList.add('nb-phone-skin-' + s);
}
}
function clearPhoneSkin() {
const phone = document.querySelector('.phone');
if (phone) phone.classList.remove('nb-phone-skin-theme', 'nb-phone-skin-green', 'nb-phone-skin-black');
}
function whoName(who) {
try {
const s = store();
const n = s ? (s.get('cs-lbl-partner') || s.get('lbl-partner')) : '';
if (n) return n;
} catch (e) {}
return 'TA';
}
function render() {
const e = curEntry(); if (!e) return;
const lines = el('nb-lines');
if (lines) {
lines.textContent = e.text || '';
lastText = e.text || '';
undoStack = [];
}
const w = el('nb-weather'); if (w) w.textContent = e.weather || '☀️ 晴';
const m = el('nb-mood'); if (m) m.textContent = e.mood || '😊 平静';
const d = el('nb-date'); if (d) d.textContent = e.date || todayStr();
applySkin();
renderReplies(e);
checkPending();
}
function renderReplies(e) {
const box = el('nb-replies');
if (!box) return;
box.innerHTML = '';
(e.replies || []).forEach(function (r) {
const row = document.createElement('div');
row.className = 'nb-reply' + (r.typing ? ' typing' : '');
const who = document.createElement('span');
who.className = 'nb-who';
who.textContent = whoName(r.who) + '：';
const txt = document.createElement('span');
txt.className = 'nb-text';
txt.textContent = r.text || '';
row.appendChild(who); row.appendChild(txt);
box.appendChild(row);
});
}
function editWeather() {
const e = curEntry() || ensureToday();
if (!window.openModal) return;
window.openModal('天气', e.weather || '', function (v) {
const val = String(v || '').trim();
if (val) { patchCur({ weather: val }); render(); }
}, { pills: WEATHERS.map(function (x) { return { label: x, value: x }; }) });
}
function editMood() {
const e = curEntry() || ensureToday();
if (!window.openModal) return;
window.openModal('心情', e.mood || '', function (v) {
const val = String(v || '').trim();
if (val) { patchCur({ mood: val }); render(); }
}, { pills: MOODS.map(function (x) { return { label: x, value: x }; }) });
}
function editSkin() {
if (!window.openModal) return;
window.openModal('记事本皮肤', skin(), function (v) {
const val = String(v || '').trim();
if (!val) return;
try { const s = store(); if (s) s.set(SKIN_KEY, val); } catch (e) {}
applySkin();
}, { pills: SKINS, noInput: true, pillSubmit: true });
}
function editDate() {
const e = curEntry();
if (!e) return;
if (!window.openModal) return;
window.openModal('日记日期', e.date || todayStr(), function (v) {
const val = String(v || '').trim();
if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) { toast('日期格式：YYYY-MM-DD（如 2026-10-27）'); return; }
if (!dateToTs(val)) { toast('日期无效'); return; }
patchCur({ date: val });
render();
toast('日期已改为 ' + val);
}, { placeholder: '2026-10-27' });
}
function pushUndo(prev) {
if (prev === lastText) return;
undoStack.push(lastText);
if (undoStack.length > 80) undoStack.shift();
lastText = prev;
}
function undo() {
if (!undoStack.length) { toast('没有可撤回的操作'); return; }
const prev = undoStack.pop();
lastText = prev;
const lines = el('nb-lines');
if (lines) lines.textContent = prev;
patchCur({ text: prev });
toast('已撤回');
}
function appendReplyTo(id, who, text) {
const entries = load();
const e = entries.filter(function (x) { return x && x.id === id; })[0];
if (!e) return;
e.replies = e.replies || [];
e.replies.push({ who: who, text: text, ts: Date.now() });
save(entries);
if (id === curId) renderReplies(e);
}
function cardReply() { return (pickCard() || '嗯，我在听。') + ' ' + pickMedia(); }
function generateReplyFor(e, forceMode) {
if (!e || !String(e.text || '').trim()) return;
const entries = load();
const target = entries.filter(function (x) { return x && x.id === e.id; })[0];
if (!target) return;
if (target.replyDone) return; // 已经回复过（或已决定不回），永不重复
const planMode = target.replyPlan ? target.replyPlan.replyMode : null;
target.replyPlan = null;
target.replyDone = true;
save(entries);
const text = String(target.text || '');
const m = forceMode || planMode || ((window.__aiChatMode && window.__aiChatMode()) ? 'ai' : 'card');
if (m === 'ai' && window.__aiGenerate) {
const recent = load()
.filter(function (x) { return x && x.id !== target.id && String(x.text || '').trim(); })
.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); })
.slice(-3)
.map(function (x) { return '· ' + x.date + '：' + String(x.text).replace(/\s+/g, ' ').slice(0, 50); })
.join('\n');
const prompt = '我写了一篇日记，内容如下：\n「' + text + '」\n（天气：' + (target.weather || '') + '，心情：' + (target.mood || '') + '）\n'
+ (recent ? '\n（我最近几篇日记，供你参考记忆：\n' + recent + '\n）\n' : '')
+ '\n请保持你一贯的人设和说话方式，在这篇日记的末尾回复一句（1~2 句话），语气自然温柔，可以带一个 emoji 或颜文字。不要解释、不要加引号，直接给回复内容。';
window.__aiGenerate(prompt, '', false).then(function (out) {
appendReplyTo(target.id, 'ai', String(out || '').trim());
}).catch(function () {
});
return;
}
setTimeout(function () { appendReplyTo(target.id, 'card', cardReply()); }, 300);
}
function checkPending() {
const list = load();
const now = Date.now();
list.forEach(function (e) {
if (!e || e.replyDone) return;
if (!e.replyPlan || !e.replyPlan.dueAt) return;
if (e.replyPlan.dueAt > now) return;
generateReplyFor(e, e.replyPlan.replyMode);
});
}
function saveCurrent() {
const lines = el('nb-lines');
const text = lines ? String(lines.innerText || '') : '';
patchCur({ text: text, ts: Date.now() });
lastText = text;
return text;
}
function onSave() {
const text = saveCurrent();
toast('已保存');
if (!text) return;
const e = curEntry();
if (!e) return;
patchCur({ lastReplyText: text });
if (e.replyPlan || e.replyDone) return;
const dayStart = dateToTs(e.date);
const todayStart = dateToTs(todayStr());
if (!dayStart || dayStart !== todayStart) { patchCur({ replyDone: true }); return; }
const dayEnd = dayStart + 86400000; // 次日 00:00
const replyMode = (window.__aiChatMode && window.__aiChatMode()) ? 'ai' : 'card';
const roll = Math.random();
if (roll < 0.4) {
patchCur({ replyPlan: { dueAt: dayEnd + Math.floor(Math.random() * 30) * 60000, replyMode: replyMode } });
} else if (roll < 0.8) {
patchCur({ replyPlan: { dueAt: dayEnd + (8 + Math.random() * 14) * 3600000, replyMode: replyMode } });
} else {
patchCur({ replyDone: true });
}
}
function entryTitle(e) {
const first = String(e.text || '').split('\n')[0].trim();
return first ? first.slice(0, 26) : '无标题';
}
function entryPreview(e) {
const rest = String(e.text || '').replace(/\s+/g, ' ').trim();
return rest ? rest.slice(0, 60) : '（还没有写内容）';
}
function renderList() {
const box = el('nb-list'); if (!box) return;
const entries = load().slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
box.innerHTML = '';
if (!entries.length) {
const empty = document.createElement('div');
empty.className = 'nb-empty';
empty.textContent = '还没有日记\n点右下角「＋」写第一篇吧';
box.appendChild(empty);
return;
}
entries.forEach(function (e) {
const item = document.createElement('div');
item.className = 'nb-item' + (selected[e.id] ? ' sel' : '');
item.dataset.id = e.id;
item.innerHTML = '<div class="nb-item-title"></div><div class="nb-item-preview"></div><div class="nb-item-date"></div><span class="nb-check"></span>';
item.querySelector('.nb-item-title').textContent = entryTitle(e);
item.querySelector('.nb-item-preview').textContent = entryPreview(e);
item.querySelector('.nb-item-date').textContent = e.date + (e.replies && e.replies.length ? ' · 有回复' : '');
item.addEventListener('pointerdown', function () {
if (batchMode) return;
clearTimeout(pressTimer);
pressTimer = setTimeout(function () {
suppressClick = true;
enterBatch(e.id);
}, 520);
});
item.addEventListener('pointerup', function () { clearTimeout(pressTimer); });
item.addEventListener('pointerleave', function () { clearTimeout(pressTimer); });
item.addEventListener('pointercancel', function () { clearTimeout(pressTimer); });
item.addEventListener('click', function () {
if (suppressClick) { suppressClick = false; return; }
if (batchMode) { toggleSelect(e.id); return; }
openEntry(e.id);
});
box.appendChild(item);
});
}
function enterBatch(id) {
batchMode = true;
selected = {};
if (id) selected[id] = true;
const bar = el('nb-batch-bar');
if (bar) bar.hidden = false;
renderList();
updateBatchCount();
}
function exitBatch() {
batchMode = false;
selected = {};
const bar = el('nb-batch-bar');
if (bar) bar.hidden = true;
renderList();
}
function toggleSelect(id) {
if (selected[id]) delete selected[id]; else selected[id] = true;
renderList();
updateBatchCount();
if (!Object.keys(selected).length) exitBatch();
}
function updateBatchCount() {
const n = Object.keys(selected).length;
const c = el('nb-batch-count');
if (c) c.textContent = '已选 ' + n + ' 篇';
}
function deleteSelected() {
const ids = Object.keys(selected);
if (!ids.length) return;
const entries = load().filter(function (e) { return !selected[e.id]; });
save(entries);
toast('已删除 ' + ids.length + ' 篇');
exitBatch();
}
function exportSelected() {
const ids = Object.keys(selected);
const list = load().filter(function (e) { return ids.length ? selected[e.id] : true; });
doExport(list);
exitBatch();
}
function doExport(list) {
const entries = list || load();
if (!entries.length) { toast('还没有可导出的日记'); return; }
const payload = { app: 'mochi-notebook', ver: 1, exportedAt: new Date().toISOString(), entries: entries };
const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'mochi-notebook-' + todayStr() + '.json';
document.body.appendChild(a); a.click();
setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
toast('已导出 ' + entries.length + ' 篇日记');
}
function doImport() {
const inp = document.createElement('input');
inp.type = 'file'; inp.accept = '.json,application/json';
inp.addEventListener('change', function () {
const f = inp.files && inp.files[0]; if (!f) return;
const reader = new FileReader();
reader.onload = function () {
try {
const obj = JSON.parse(String(reader.result || '{}'));
const incoming = Array.isArray(obj) ? obj : (obj.entries || []);
if (!Array.isArray(incoming) || !incoming.length) { toast('文件里没有日记数据'); return; }
const cur = load();
const byId = {};
cur.forEach(function (e) { if (e && e.id) byId[e.id] = e; });
incoming.forEach(function (e) {
if (e && e.id) byId[e.id] = e;
else if (e && e.date) { e.id = uid(); byId[e.id] = e; }
});
const merged = Object.keys(byId).map(function (k) { return byId[k]; });
save(merged);
toast('已导入，共 ' + merged.length + ' 篇');
renderList();
} catch (e) { toast('导入失败：文件格式不对'); }
};
reader.readAsText(f);
});
inp.click();
}
function confirmClear() {
if (!window.openModal) { if (confirm('确定清除全部日记？')) { save([]); renderList(); } return; }
window.openModal('清除全部日记', '', function (v) {
if (v === 'ok') { save([]); toast('已清除全部日记'); renderList(); }
}, { noInput: true, lock: false, staticText: '将删除本联系人记事本里的全部日记，且无法恢复。\n\n建议先「导出备份」再清除。', pills: [{ label: '取消', value: 'cancel' }, { label: '确定清除', value: 'ok' }], pillSubmit: true, warn: true });
}
function openMore() {
if (!window.openModal) return;
window.openModal('记事本', '', function (v) {
if (v === 'export') doExport();
else if (v === 'import') doImport();
else if (v === 'clear') confirmClear();
}, { pills: [{ label: '导出备份', value: 'export' }, { label: '导入备份', value: 'import' }, { label: '清除全部日记', value: 'clear' }], noInput: true, pillSubmit: true });
}
function showPage(pid) {
document.querySelectorAll('.page').forEach(function (p) { p.hidden = true; });
const page = el(pid);
if (page) page.hidden = false;
}
function openList() {
batchMode = false; selected = {};
const bar = el('nb-batch-bar'); if (bar) bar.hidden = true;
clearPhoneSkin();
renderList();
showPage('page-notebook-list');
}
function openEntry(id) {
curId = id;
render();
showPage('page-notebook');
}
function openNew() {
const entries = load();
const e = { id: uid(), date: todayStr(), weather: '☀️ 晴', mood: '😊 平静', text: '', replies: [], ts: Date.now() };
entries.push(e); save(entries);
openEntry(e.id);
}
let saveTimer = null;
function bind() {
const app = document.querySelector('.app[data-app="notebook"]');
if (app) app.addEventListener('click', function () {
const editing = Array.from(document.querySelectorAll('.app-grid')).some(function (g) { return g.classList.contains('editing'); });
if (editing) return;
openList();
});
const lb = el('nb-list-back'); if (lb) lb.addEventListener('click', function () { clearPhoneSkin(); showPage('page-phone'); });
const more = el('nb-more-btn'); if (more) more.addEventListener('click', openMore);
const nw = el('nb-new'); if (nw) nw.addEventListener('click', openNew);
const bdel = el('nb-batch-del'); if (bdel) bdel.addEventListener('click', deleteSelected);
const bexp = el('nb-batch-exp'); if (bexp) bexp.addEventListener('click', exportSelected);
const bcancel = el('nb-batch-cancel'); if (bcancel) bcancel.addEventListener('click', exitBatch);
const back = el('notebook-back'); if (back) back.addEventListener('click', openList);
const w = el('nb-weather'); if (w) w.addEventListener('click', editWeather);
const m = el('nb-mood'); if (m) m.addEventListener('click', editMood);
const dt = el('nb-date'); if (dt) dt.addEventListener('click', editDate);
const sk = el('nb-skin'); if (sk) sk.addEventListener('click', editSkin);
const un = el('nb-undo'); if (un) un.addEventListener('click', undo);
const sv = el('nb-save'); if (sv) sv.addEventListener('click', onSave);
const lines = el('nb-lines');
if (lines) {
lines.addEventListener('input', function () {
const cur = String(lines.innerText || '');
if (cur !== lastText) { undoStack.push(lastText); if (undoStack.length > 80) undoStack.shift(); lastText = cur; }
clearTimeout(saveTimer);
saveTimer = setTimeout(function () { patchCur({ text: cur, ts: Date.now() }); }, 500);
});
}
document.addEventListener('contact-switched', function () {
if (el('page-notebook-list') && !el('page-notebook-list').hidden) renderList();
});
setInterval(function () { try { checkPending(); } catch (e) {} }, 30000);
window.addEventListener('popstate', function () {
setTimeout(function () {
const p = el('page-notebook');
if (!p || p.hidden) clearPhoneSkin();
}, 0);
});
}
if (document.body) bind();
else document.addEventListener('DOMContentLoaded', bind);
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("notebook.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("notebook.js"); try { console.error("[JS] notebook.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[notebook.js] " + String(__e && __e.message || __e)); } })();