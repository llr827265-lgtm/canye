(function () { try {
/* ===== 本地新增：字卡传讯（抽字卡浮窗 + 字卡记录） =====
· 抽卡来源：字卡库（系统预设 main 全部分组 + 用户自建 text 分类）
· 浮窗：半透明磨砂白、洗牌动画、白卡无序散开、点击翻转显示字卡文本（字号自适应）
· 记录：per-contact 键 card-transmit-history（随「完整备份」一起导出，因为前缀是 xy-home-v2:）
· 自动发到聊天：沿用页面里的「抽完自动发到聊天」开关
*/
(function () {
'use strict';
var page = document.getElementById('page-divine');
if (!page) return;
var KEY = 'card-transmit-history';
function store() { try { return window.activeStore(); } catch (e) { return null; } }
function el(id) { return document.getElementById(id); }
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
var s = store();
var rawOwn = s ? s.get('cc-groups') : null;
var rawPub = window.xyStore ? window.xyStore('xy-home-v2').get('cc-groups-public') : null;
[rawOwn, rawPub].forEach(function (raw) {
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
function pickN(n) {
var copy = cardPool();
var out = [];
for (var i = 0; i < n && copy.length; i++) {
var k = Math.floor(Math.random() * copy.length);
out.push(copy[k]); copy.splice(k, 1);
}
return out;
}
var styled = false;
function injectStyle() {
if (styled) return; styled = true;
var st = document.createElement('style');
st.id = 'ct-style';
st.textContent =
'.ct-mask{position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;background:rgba(0,0,0,.26);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}' +
'.ct-mask[hidden]{display:none;}' +
'.ct-panel{position:relative;width:100%;max-width:420px;min-height:360px;max-height:86vh;overflow-y:auto;border-radius:22px;background:rgba(255,255,255,.72);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 18px 60px rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.75);padding:18px 16px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;}' +
'.ct-close{position:absolute;right:12px;top:10px;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.06);color:#555;font-size:17px;cursor:pointer;}' +
'.ct-tip{font-size:13px;color:#7a736a;margin:6px 0 10px;text-align:center;min-height:18px;}' +
'.ct-stage{position:relative;width:100%;height:200px;overflow:visible;}' +
'.ct-result{width:100%;display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:center;min-height:8px;margin-top:8px;}' +
'.ct-result .ct-card{position:relative;left:auto;top:auto;margin:0;flex:0 0 auto;}' +
'.ct-card{position:absolute;left:50%;top:50%;width:72px;height:108px;margin-left:-36px;margin-top:-54px;border-radius:10px;background:#fff;box-shadow:0 6px 18px rgba(0,0,0,.16);cursor:pointer;transform-style:preserve-3d;transition:transform .5s cubic-bezier(.2,.7,.3,1.2),box-shadow .3s;will-change:transform;}' +
'.ct-card .ct-front,.ct-card .ct-back{position:absolute;inset:0;border-radius:10px;backface-visibility:hidden;-webkit-backface-visibility:hidden;display:flex;align-items:center;justify-content:center;overflow:hidden;}' +
'.ct-card .ct-back{background:linear-gradient(160deg,#f8f5ef,#ebe6db);border:1px solid rgba(0,0,0,.06);}' +
'.ct-card .ct-back::after{content:"✦";color:#c9c0ae;font-size:22px;}' +
'.ct-card .ct-front{background:#fff;border:1px solid rgba(0,0,0,.06);transform:rotateY(180deg);padding:8px;box-sizing:border-box;text-align:center;line-height:1.5;color:#333;word-break:break-word;}' +
'.ct-card.flip{transform:rotateY(180deg) !important;}' +
'.ct-card.done{box-shadow:0 10px 28px rgba(0,0,0,.2);z-index:3;}' +
'.ct-shuffle{animation:ctShake .5s ease-in-out infinite alternate;}' +
'@keyframes ctShake{from{transform:translateY(-3px) rotate(-3deg);}to{transform:translateY(3px) rotate(3deg);}}' +
'.ct-actions{margin-top:12px;display:flex;gap:10px;min-height:34px;}' +
'.ct-btn{padding:9px 18px;border-radius:10px;border:1px solid rgba(0,0,0,.12);background:#fff;color:#444;font-size:13px;font-weight:600;cursor:pointer;}' +
'.ct-btn.primary{background:#111;color:#fff;border-color:#111;}';
document.head.appendChild(st);
}
var overlay = null;
function openOverlay(n, question, target) {
injectStyle();
if (!overlay) {
overlay = document.createElement('div');
overlay.className = 'ct-mask'; overlay.id = 'ct-mask'; overlay.hidden = true;
overlay.innerHTML = '<div class="ct-panel"><span class="ct-close" id="ct-close">×</span><div class="ct-tip" id="ct-tip">洗牌中…</div><div class="ct-stage" id="ct-stage"></div><div class="ct-result" id="ct-result"></div><div class="ct-actions" id="ct-actions"></div></div>';
document.body.appendChild(overlay);
overlay.addEventListener('click', function (e) { if (e.target === overlay) closeOverlay(); });
overlay.querySelector('#ct-close').addEventListener('click', closeOverlay);
}
overlay.hidden = false;
var stage = overlay.querySelector('#ct-stage');
var tip = overlay.querySelector('#ct-tip');
var actions = overlay.querySelector('#ct-actions');
stage.innerHTML = ''; actions.innerHTML = '';
tip.textContent = '洗牌中…';
var drawn = pickN(n);
if (!drawn.length) { tip.textContent = '字卡库还没有可用字卡，先去「字卡库」添加吧'; return; }
for (var i = 0; i < Math.min(5, n + 2); i++) {
var d = document.createElement('div');
d.className = 'ct-card ct-shuffle';
d.style.animationDelay = (i * 0.08) + 's';
stage.appendChild(d);
}
setTimeout(function () {
stage.innerHTML = '';
var result = overlay.querySelector('#ct-result');
if (result) result.innerHTML = '';
tip.textContent = '点击卡片翻开字卡（共 ' + drawn.length + ' 张）';
var rect = stage.getBoundingClientRect();
var W = Math.max(220, rect.width || 360), H = rect.height || 200;
var cw = drawn.length === 1 ? 96 : drawn.length <= 3 ? 80 : 62;
var ch = Math.round(cw * 1.5);
var picked = 0;
drawn.forEach(function (txt) {
var card = document.createElement('div');
card.className = 'ct-card';
card.style.width = cw + 'px';
card.style.height = ch + 'px';
var rot = Math.random() * 24 - 12;
var dx = (Math.random() * 0.6 - 0.3) * Math.max(0, W - cw);
var dy = (Math.random() * 0.5 - 0.25) * Math.max(0, H - ch);
card.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg)';
card.innerHTML = '<div class="ct-back"></div><div class="ct-front"></div>';
card.addEventListener('click', function () {
if (card.classList.contains('flip')) return;
var front = card.querySelector('.ct-front');
front.textContent = txt;
var len = txt.length;
var fs = len <= 8 ? 14 : len <= 16 ? 12 : len <= 30 ? 10.5 : len <= 50 ? 9 : 7.5;
front.style.fontSize = fs + 'px';
card.style.transform = '';
card.style.width = cw + 'px';
card.style.height = ch + 'px';
try { stage.removeChild(card); } catch (e) {}
if (result) result.appendChild(card); else stage.appendChild(card);
card.classList.add('done');
requestAnimationFrame(function () { card.classList.add('flip'); });
picked++;
if (picked >= drawn.length) {
tip.textContent = '抽完了 · 共 ' + drawn.length + ' 张';
actions.innerHTML = '<button class="ct-btn" id="ct-sync">同步到聊天</button><button class="ct-btn primary" id="ct-ok">收下字卡</button>';
actions.querySelector('#ct-sync').addEventListener('click', function () {
saveRecord(drawn, question, target);
if (window.chatAddIn) {
drawn.forEach(function (t, i) {
setTimeout(function () { try { window.chatAddIn(t); } catch (e2) {} }, i * 450);
});
}
try { if (window.toast) window.toast('已让 TA 把字卡发到聊天'); } catch (e3) {}
closeOverlay();
});
actions.querySelector('#ct-ok').addEventListener('click', function () {
saveRecord(drawn, question, target);
closeOverlay();
});
}
});
stage.appendChild(card);
});
actions.innerHTML = '<button class="ct-btn" id="ct-reset">重新洗牌</button>';
actions.querySelector('#ct-reset').addEventListener('click', function () { openOverlay(n, question, target); });
}, 900);
}
function closeOverlay() { if (overlay) overlay.hidden = true; }
function loadHist() {
try { var s = store(); var a = JSON.parse((s && s.get(KEY)) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}
function saveHist(arr) { try { var s = store(); if (s) s.set(KEY, JSON.stringify(arr.slice(0, 200))); } catch (e) {} }
function fmt(ts) {
var d = new Date(ts); var p = function (n) { return n < 10 ? '0' + n : n; };
return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
function saveRecord(cards, question, target) {
var list = loadHist();
list.unshift({ ts: Date.now(), cards: cards, question: String(question || ''), target: target || '' });
saveHist(list);
renderHist();
try {
var auto = el('div-auto-send') && el('div-auto-send').checked;
if (auto && window.chatAddIn) {
cards.forEach(function (t, i) { setTimeout(function () { try { window.chatAddIn(t); } catch (e) {} }, i * 500); });
}
} catch (e) {}
}
function renderHist() {
var box = el('div-history'); if (!box) return;
var list = loadHist();
var html = '<div class="div-label">字卡记录</div>';
if (!list.length) { box.innerHTML = html + '<div class="ct-hist-empty">还没有抽过字卡</div>'; return; }
html += '<div class="ct-hist">';
list.slice(0, 30).forEach(function (h) {
var cards = h.cards || [];
html += '<div class="ct-hist-item">' +
'<div class="ct-hist-top"><span>' + fmt(h.ts) + '</span><span>' + cards.length + ' 张</span></div>' +
'<div class="ct-hist-cards">' + cards.map(function (c) { return '<span class="ct-hist-chip">' + escapeHtml(c) + '</span>'; }).join('') + '</div>' +
(h.question ? '<div class="ct-hist-q">问：' + escapeHtml(h.question) + '</div>' : '') +
'</div>';
});
html += '</div>';
box.innerHTML = html;
}
function escapeHtml(s) {
return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function bindDraw() {
var old = el('div-draw');
if (!old) return;
var btn = old.cloneNode(true);
old.parentNode.replaceChild(btn, old);
btn.addEventListener('click', function () {
var sel = document.querySelector('#div-counts .div-mode.sel');
var n = parseInt((sel && sel.dataset.count) || '3', 10) || 3;
var q = (el('div-question') || {}).value || '';
var target = window.divineGetTarget ? window.divineGetTarget() : '';
openOverlay(n, q, target);
});
}
function bindChatDraw() {
var old = el('div-chat-draw');
if (!old) return;
var btn = old.cloneNode(true);
old.parentNode.replaceChild(btn, old);
btn.addEventListener('click', function () {
var sel = document.querySelector('#chat-divine-body [data-chatcount].sel');
var n = parseInt((sel && sel.dataset.chatcount) || '3', 10) || 3;
var q = (el('div-chat-question') || {}).value || '';
var target = window.divineGetTarget ? window.divineGetTarget() : '';
openOverlay(n, q, target);
});
}
function boot() {
bindDraw();
bindChatDraw();
renderHist();
new MutationObserver(function () {
if (!page.hidden) { try { renderHist(); } catch (e) {} }
}).observe(page, { attributes: true, attributeFilter: ['hidden'] });
}
if (document.body) boot();
else document.addEventListener('DOMContentLoaded', boot);
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("card-transmit.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("card-transmit.js"); try { console.error("[JS] card-transmit.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[card-transmit.js] " + String(__e && __e.message || __e)); } })();