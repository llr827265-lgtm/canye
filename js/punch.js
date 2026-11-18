(function () { try {
/* ===== 本地新增：打卡（punch） =====
数据（全局根命名空间，随「完整备份」自动导出）：xy-home-v2:punch-goals / xy-home-v2:punch-logs
页面与弹层全部由本文件动态创建（不改 template），风格跟随站点主题色 + 纸面质感。
入口：桌面第二页「打卡」图标（替代原番茄钟位置）。
*/
(function () {
'use strict';
var G = 'xy-home-v2';
var KEY_GOALS = 'punch-goals';
var KEY_LOGS = 'punch-logs';
function store() { try { return window.xyStore ? window.xyStore(G) : null; } catch (e) { return null; } }
function readJSON(k, def) {
try { var s = store(); var raw = s ? s.get(k) : null; if (!raw) return def; var v = JSON.parse(raw); return v == null ? def : v; } catch (e) { return def; }
}
function writeJSON(k, v) { try { var s = store(); if (s) s.set(k, JSON.stringify(v)); } catch (e) {} }
function toast(m) { try { if (window.toast) window.toast(m); } catch (e) {} }
function el(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
var PRESETS = [
{ icon: '🌅', name: '早起' }, { icon: '📖', name: '阅读' }, { icon: '🏃', name: '运动' },
{ icon: '💧', name: '喝水' }, { icon: '🌙', name: '早睡' }, { icon: '🧘', name: '冥想' },
{ icon: '✏️', name: '学习' }, { icon: '😊', name: '开心' }, { icon: '🥗', name: '健康饮食' },
{ icon: '🎧', name: '专注' }, { icon: '🧹', name: '整理' }, { icon: '💤', name: '午休' }
];
function goals() { var a = readJSON(KEY_GOALS, null); if (!Array.isArray(a)) { a = []; } return a; }
function saveGoals(a) { writeJSON(KEY_GOALS, a); }
function logs() { var a = readJSON(KEY_LOGS, null); if (!Array.isArray(a)) { a = []; } return a; }
function saveLogs(a) { writeJSON(KEY_LOGS, a); }
function todayKey() {
var d = new Date();
return d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
}
function daysOf(goalId) {
var seen = {}, n = 0;
logs().forEach(function (l) { if (l && l.goalId === goalId && l.date && !seen[l.date]) { seen[l.date] = 1; n++; } });
return n;
}
function doneToday(goalId) {
var t = todayKey();
return logs().some(function (l) { return l && l.goalId === goalId && l.date === t; });
}
var page = null;
function ensurePage() {
if (page && page.isConnected) return page;
page = document.createElement('div');
page.className = 'page';
page.id = 'page-punch';
page.hidden = true;
page.innerHTML =
'<div class="chat-head">' +
'<span class="ch-back" id="punch-back"><svg viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></span>' +
'<span class="ch-name">打卡</span>' +
'<button class="ch-more" id="punch-add" title="添加打卡目标"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg></button>' +
'</div>' +
'<div class="punch-body">' +
'<div class="punch-quote"><span class="punch-quote-lbl">今日鼓励：</span><span class="punch-quote-txt" id="punch-quote">—</span></div>' +
'<div class="punch-empty" id="punch-empty">还没有打卡目标<br>点右上角「＋」添加一个吧</div>' +
'<div class="punch-grid" id="punch-grid"></div>' +
'</div>' +
'<button class="punch-diary-btn" id="punch-diary">📔 打卡日记</button>';
(document.querySelector('.phone') || document.body).appendChild(page);
el('punch-back').addEventListener('click', function () { hide(); });
el('punch-add').addEventListener('click', openAdd);
el('punch-diary').addEventListener('click', openDiary);
return page;
}
function show() {
var p = ensurePage();
Array.prototype.forEach.call(document.querySelectorAll('.page'), function (x) { if (x !== p) x.hidden = true; });
p.hidden = false;
if (window.exitDecor) { try { window.exitDecor(); } catch (e) {} }
renderQuote();
renderGrid();
}
function hide() {
if (page) page.hidden = true;
var home = document.getElementById('page-phone');
if (home) home.hidden = false;
}
function cardPool() {
var pool = [];
try {
var d = window.DEFAULT_CARD_DATA || {};
(d.main || []).forEach(function (g) {
if (!g || !Array.isArray(g[1])) return;
g[1].forEach(function (c) { if (typeof c === 'string' && c.trim()) pool.push(c.trim()); });
});
} catch (e) {}
try {
var s = window.xyStore ? window.xyStore(G) : null;
var raws = [s ? s.get('cc-groups') : null, s ? s.get('cc-groups-public') : null];
raws.forEach(function (raw) {
if (!raw) return;
var obj; try { obj = JSON.parse(raw); } catch (e) { return; }
(obj.text || []).forEach(function (grp) {
(grp[1] || []).forEach(function (c) {
if (typeof c !== 'string' || !c.trim()) return;
if (c.indexOf('|||') >= 0 || c.indexOf('@@m:') === 0 || c.indexOf('data:') === 0 || /^https?:\/\//i.test(c)) return;
pool.push(c.trim());
});
});
});
} catch (e) {}
return pool;
}
function dailyQuote() {
var key = 'punch-daily-quote', today = todayKey(), s = store(), rec = null;
try { rec = s ? JSON.parse(s.get(key) || 'null') : null; } catch (e) { rec = null; }
if (rec && rec.date === today && rec.text) return rec.text;
var pool = cardPool();
var text = pool.length ? pool[Math.floor(Math.random() * pool.length)] : '今天也要好好记录呀';
try { if (s) s.set(key, JSON.stringify({ date: today, text: text })); } catch (e) {}
return text;
}
function renderQuote() {
var q = el('punch-quote');
if (q) q.textContent = dailyQuote();
}
function renderGrid() {
var g = goals(), grid = el('punch-grid'), empty = el('punch-empty');
if (!grid) return;
if (!g.length) { grid.innerHTML = ''; if (empty) empty.style.display = 'block'; return; }
if (empty) empty.style.display = 'none';
grid.innerHTML = g.map(function (it) {
var n = daysOf(it.id), ok = doneToday(it.id);
return '<button class="punch-card' + (ok ? ' done' : '') + '" data-gid="' + esc(it.id) + '">' +
'<span class="punch-card-ico">' + esc(it.icon || '⭐') + '</span>' +
'<span class="punch-card-name">' + esc(it.name) + '</span>' +
'<span class="punch-card-days">' + (ok ? '今天已打卡' : '已坚持 ' + n + ' 天') + '</span>' +
'</button>';
}).join('');
Array.prototype.forEach.call(grid.querySelectorAll('.punch-card'), function (b) {
b.addEventListener('click', function () { onCardClick(b.getAttribute('data-gid')); });
});
}
function onCardClick(gid) {
var g = goals().filter(function (x) { return x.id === gid; })[0];
if (!g) return;
if (doneToday(gid)) { toast('今天已经打卡过啦'); return; }
var lg = { id: 'pl_' + Date.now(), goalId: gid, date: todayKey(), note: '', img: '', ts: Date.now() };
var all = logs(); all.unshift(lg); saveLogs(all);
renderGrid();
openDone(g, lg);
}
function maybeAiEncourage(g, days) {
try {
if (!(window.__aiChatMode && window.__aiChatMode()) || !window.__aiGenerate) return;
var s = store();
var today = todayKey();
if (s && s.get('punch-ai-last') === today) return; // 同一天最多一次
if (Math.random() >= 0.25) return;                 // 25% 概率触发
if (s) { try { s.set('punch-ai-last', today); } catch (e) {} }
var prompt = '（打卡鼓励）对方正在坚持「' + g.name + '」打卡，今天已经是第 ' + days + ' 天了。\n' +
'请以恋人的身份，在聊天里发一句简短的鼓励（1~2 句话，自然口语，可以带一个 emoji）。' +
'不要提「打卡系统」「概率」「数据」这类词，像日常随口说的那种。';
window.__aiGenerate(prompt, '', false).then(function (out) {
var t = String(out || '').trim();
if (t && window.chatAddIn) { try { window.chatAddIn(t); } catch (e2) {} }
}).catch(function () {});
} catch (e) {}
}
function openDone(g, lg) {
var mask = document.createElement('div');
mask.className = 'punch-mask';
mask.id = 'punch-mask';
mask.innerHTML =
'<div class="punch-panel punch-paper">' +
'<div class="punch-done-head"><span class="punch-done-ico">' + esc(g.icon || '⭐') + '</span>' +
'<div><b>打卡成功</b><span class="punch-done-sub">' + esc(g.name) + ' · 第 ' + daysOf(g.id) + ' 次</span></div></div>' +
'<div class="punch-log-lbl">记录成长日志</div>' +
'<textarea class="punch-note" id="punch-note" maxlength="250" placeholder="输入心得，记录你的成长（最多 250 字）"></textarea>' +
'<div class="punch-log-actions">' +
'<button class="punch-btn ghost" id="punch-img">＋ 添加图片</button>' +
'<button class="punch-btn primary" id="punch-done-ok">完成</button>' +
'</div>' +
'</div>';
document.body.appendChild(mask);
var note = mask.querySelector('#punch-note');
mask.querySelector('#punch-img').addEventListener('click', function () {
var inp = document.createElement('input');
inp.type = 'file'; inp.accept = 'image/*';
inp.addEventListener('change', function () {
var f = inp.files && inp.files[0]; if (!f) return;
var r = new FileReader();
r.onload = function () {
var img = new Image();
img.onload = function () {
try {
var c = document.createElement('canvas');
var sc = Math.min(1, 720 / Math.max(img.width, img.height));
c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
lg.img = c.toDataURL('image/jpeg', 0.8);
toast('图片已添加');
} catch (e) { toast('图片处理失败'); }
};
img.src = String(r.result || '');
};
r.readAsDataURL(f);
});
inp.click();
});
function close() {
lg.note = note ? String(note.value || '').slice(0, 250) : '';
var all = logs();
for (var i = 0; i < all.length; i++) { if (all[i].id === lg.id) { all[i] = lg; break; } }
saveLogs(all);
if (mask.parentNode) mask.parentNode.removeChild(mask);
renderGrid();
maybeAiEncourage(g, daysOf(g.id));
}
mask.querySelector('#punch-done-ok').addEventListener('click', close);
mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
if (note) note.focus();
}
function openAdd() {
var mask = document.createElement('div');
mask.className = 'punch-mask';
mask.id = 'punch-mask';
mask.innerHTML =
'<div class="punch-panel punch-paper">' +
'<div class="punch-add-head"><b>选择目标</b><button class="punch-btn primary" id="punch-add-ok">确定</button></div>' +
'<div class="punch-presets">' +
PRESETS.map(function (p, i) {
return '<button class="punch-preset" data-i="' + i + '"><span class="punch-preset-ico">' + p.icon + '</span><span>' + esc(p.name) + '</span></button>';
}).join('') +
'</div>' +
'<div class="punch-custom-row">' +
'<input class="punch-input" id="punch-custom-name" maxlength="12" placeholder="自定义目标（输入名称）">' +
'<button class="punch-btn ghost" id="punch-custom-ico">😊</button>' +
'</div>' +
'<div class="punch-hint">点选上面的目标，或输入自定义名称；多个目标会按添加顺序排列。</div>' +
'</div>';
document.body.appendChild(mask);
var picked = null;
var icoBtn = mask.querySelector('#punch-custom-ico');
var ICONS = ['😊', '⭐', '🌱', '🔥', '💪', '🎯', '📚', '🏃', '💧', '🌙', '🍀', '🎨', '🎵', '🧘', '☀️', '🌸'];
var icoIdx = 0;
Array.prototype.forEach.call(mask.querySelectorAll('.punch-preset'), function (b) {
b.addEventListener('click', function () {
Array.prototype.forEach.call(mask.querySelectorAll('.punch-preset'), function (x) { x.classList.remove('sel'); });
b.classList.add('sel');
var p = PRESETS[parseInt(b.getAttribute('data-i'), 10)];
picked = { icon: p.icon, name: p.name };
var nm = mask.querySelector('#punch-custom-name');
if (nm) nm.value = p.name;
});
});
icoBtn.addEventListener('click', function () {
icoIdx = (icoIdx + 1) % ICONS.length;
icoBtn.textContent = ICONS[icoIdx];
if (picked) picked.icon = ICONS[icoIdx];
});
function close() { if (mask.parentNode) mask.parentNode.removeChild(mask); }
mask.querySelector('#punch-add-ok').addEventListener('click', function () {
var nm = mask.querySelector('#punch-custom-name');
var name = nm ? String(nm.value || '').trim() : '';
var icon = picked ? picked.icon : ICONS[icoIdx];
if (!name) name = picked ? picked.name : '';
if (!name) { toast('请输入目标名称'); return; }
var g = goals();
if (g.some(function (x) { return x.name === name; })) { toast('这个目标已经有了'); return; }
g.push({ id: 'pg_' + Date.now() + '_' + g.length, icon: icon, name: name, createdAt: Date.now() });
saveGoals(g);
close();
renderGrid();
toast('已添加：' + name);
});
mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
}
var diaryPage = null, diaryView = 'list', diaryLid = null;
function ensureDiaryPage() {
if (diaryPage && diaryPage.isConnected) return diaryPage;
diaryPage = document.createElement('div');
diaryPage.className = 'page';
diaryPage.id = 'page-punch-diary';
diaryPage.hidden = true;
diaryPage.innerHTML =
'<div class="chat-head">' +
'<span class="ch-back" id="punch-diary-back"><svg viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></span>' +
'<span class="ch-name" id="punch-diary-title">打卡日记</span>' +
'<button class="ch-more" id="punch-diary-more" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg></button>' +
'</div>' +
'<div class="punch-body" id="punch-diary-body"></div>';
(document.querySelector('.phone') || document.body).appendChild(diaryPage);
el('punch-diary-back').addEventListener('click', function () {
if (diaryView === 'list') { hideDiary(); }
else { diaryView = 'list'; diaryLid = null; renderDiary(); }
});
el('punch-diary-more').addEventListener('click', function () {
var l = logs().filter(function (x) { return x.id === diaryLid; })[0];
if (l) openNoteEditor(l);
});
return diaryPage;
}
function hideDiary() {
if (diaryPage) diaryPage.hidden = true;
var pp = document.getElementById('page-punch');
if (pp) pp.hidden = false;
try { renderQuote(); renderGrid(); } catch (e) {}
}
function openDiary() {
ensureDiaryPage();
diaryView = 'list'; diaryLid = null;
Array.prototype.forEach.call(document.querySelectorAll('.page'), function (x) { if (x !== diaryPage) x.hidden = true; });
diaryPage.hidden = false;
renderDiary();
}
function renderDiary() {
var body = el('punch-diary-body');
if (!body) return;
var title = el('punch-diary-title'), more = el('punch-diary-more');
if (diaryView === 'list') {
if (title) title.textContent = '打卡日记';
if (more) more.hidden = true;
var list = logs().slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
var gs = goals();
body.innerHTML = list.length ? list.map(function (l) {
var g = gs.filter(function (x) { return x.id === l.goalId; })[0] || {};
var note = l.note ? String(l.note).replace(/\s+/g, ' ').slice(0, 40) : '本次打卡未写日志';
return '<button class="punch-diary-item" data-lid="' + esc(l.id) + '">' +
'<span class="punch-diary-ico">' + esc(g.icon || '⭐') + '</span>' +
'<span class="punch-diary-main"><span class="punch-diary-t">' + esc(g.name || '打卡') + '</span>' +
'<span class="punch-diary-s">' + esc(l.date || '') + ' · ' + esc(note) + '</span></span>' +
(l.img ? '<img class="punch-diary-thumb" src="' + esc(l.img) + '" alt="">' : '') +
'</button>';
}).join('') : '<div class="punch-hint">还没有打卡记录</div>';
Array.prototype.forEach.call(body.querySelectorAll('.punch-diary-item'), function (b) {
b.addEventListener('click', function () { diaryLid = b.getAttribute('data-lid'); diaryView = 'detail'; renderDiary(); });
});
} else {
var l = logs().filter(function (x) { return x.id === diaryLid; })[0];
if (!l) { diaryView = 'list'; renderDiary(); return; }
var g = goals().filter(function (x) { return x.id === l.goalId; })[0] || {};
if (title) title.textContent = g.name || '打卡日记';
if (more) more.hidden = false;
body.innerHTML = '<div class="punch-detail-date">' + esc(l.date || '') + ' · 第 ' + daysOf(l.goalId) + ' 次打卡</div>' +
'<div class="punch-detail-note">' + (l.note ? esc(l.note) : '本次打卡未写日志') + '</div>' +
(l.img ? '<img class="punch-detail-img" src="' + esc(l.img) + '" alt="">' : '');
}
}
function openNoteEditor(l) {
var mask = document.createElement('div');
mask.className = 'punch-mask'; mask.id = 'punch-mask';
mask.innerHTML =
'<div class="punch-panel punch-paper">' +
'<div class="punch-add-head"><b>编辑日志</b><button class="punch-btn primary" id="punch-note-save">完成</button></div>' +
'<textarea class="punch-note" id="punch-note-edit" maxlength="250" placeholder="输入心得，记录你的成长（最多 250 字）"></textarea>' +
'<div class="punch-log-actions"><button class="punch-btn ghost" id="punch-note-img">＋ 添加图片</button>' +
(l.img ? '<button class="punch-btn ghost" id="punch-note-img-del">删图</button>' : '') + '</div>' +
'</div>';
document.body.appendChild(mask);
var ta = mask.querySelector('#punch-note-edit');
if (ta) ta.value = l.note || '';
mask.querySelector('#punch-note-img').addEventListener('click', function () {
var inp = document.createElement('input');
inp.type = 'file'; inp.accept = 'image/*';
inp.addEventListener('change', function () {
var f = inp.files && inp.files[0]; if (!f) return;
var r = new FileReader();
r.onload = function () {
var img = new Image();
img.onload = function () {
try {
var c = document.createElement('canvas');
var sc = Math.min(1, 720 / Math.max(img.width, img.height));
c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
l.img = c.toDataURL('image/jpeg', 0.8);
toast('图片已添加');
} catch (e) { toast('图片处理失败'); }
};
img.src = String(r.result || '');
};
r.readAsDataURL(f);
});
inp.click();
});
var del = mask.querySelector('#punch-note-img-del');
if (del) del.addEventListener('click', function () { l.img = ''; del.remove(); toast('已删除图片'); });
function close() { if (mask.parentNode) mask.parentNode.removeChild(mask); }
mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
mask.querySelector('#punch-note-save').addEventListener('click', function () {
l.note = ta ? String(ta.value || '').slice(0, 250) : '';
var all = logs();
for (var i = 0; i < all.length; i++) { if (all[i].id === l.id) { all[i] = l; break; } }
saveLogs(all);
close();
renderDiary();
renderGrid();
toast('已保存');
});
}
function mountIcon() {
var app = document.querySelector('.app[data-app="punch"]');
if (!app || app.__punchBound) return;
app.__punchBound = true;
app.addEventListener('click', function () {
if (window.editingNow && window.editingNow()) return;
show();
});
}
function boot() {
ensurePage();
mountIcon();
setTimeout(mountIcon, 800);
setTimeout(mountIcon, 2500);
}
if (document.body) boot();
else document.addEventListener('DOMContentLoaded', boot);
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("punch.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("punch.js"); try { console.error("[JS] punch.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[punch.js] " + String(__e && __e.message || __e)); } })();