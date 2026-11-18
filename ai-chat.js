(function () { try {
/* ===== AI 聊天模式（本地新增，独立模块，不改动原字卡逻辑） =====
模式：per-contact（当前桌面）存 chat-mode = 'card' | 'ai'，默认 card。
配置：全局 localStorage 根键 ai-endpoint / ai-key / ai-model / ai-persona。
主动发消息：per-contact 键 ai-auto / ai-auto-min / ai-auto-max（分钟），随机间隔触发。
对外：window.__aiChatMode() / window.__aiReply(text)（chat.js 的 addMsg 接线）。
====================================================== */
(function () {
'use strict';
const G = 'xy-home-v2';
const K_EP = 'ai-endpoint', K_KEY = 'ai-key', K_MODEL = 'ai-model', K_PERSONA = 'ai-persona';
const K_AUTO = 'ai-auto', K_AUTO_MIN = 'ai-auto-min', K_AUTO_MAX = 'ai-auto-max';
const DEF_EP = 'https://api.deepseek.com/chat/completions';
const DEF_MODEL = 'deepseek-chat';
const DEF_PERSONA = '你正在扮演用户的爱人「{name}」。请用温柔、亲密、自然的口语回复，像真实情侣聊天一样，通常 1~3 句话，不要长篇大论，不要解释自己是 AI 或模型。';
const AUTO_PROMPT = '（现在是空闲时间，你独自待着，想主动给爱人发一条消息。请自然地发一条简短的日常、想念或关心，1~2 句话，像真实情侣聊天，不要解释、不要加引号、不要提到 AI。）';
function gGet(k) { try { return window.localStorage.getItem(G + ':' + k); } catch (e) { return null; } }
function gSet(k, v) { try { window.localStorage.setItem(G + ':' + k, v); } catch (e) {} }
function sGet(k) { try { const s = window.activeStore ? window.activeStore() : null; return s ? s.get(k) : null; } catch (e) { return null; } }
function sSet(k, v) { try { const s = window.activeStore ? window.activeStore() : null; if (s) s.set(k, v); } catch (e) {} }
function mode() { return 'ai'; }
function setMode(m) { sSet('chat-mode', m); syncBtn(); aiAutoSchedule(); }
function partnerName() {
try {
const el = document.getElementById('chat-partner-name');
return (el && el.textContent.trim()) || 'TA';
} catch (e) { return 'TA'; }
}
function persona() {
const p = gGet(K_PERSONA) || DEF_PERSONA;
let s = String(p).replace(/\{name\}/g, partnerName());
try { const ctx = window.__aiContextString && window.__aiContextString(); if (ctx) s += '\n\n' + ctx; } catch (e) {}
return s;
}
function syncBtn() {
const b = document.getElementById('chat-mode-btn');
if (!b) return;
const m = mode();
b.textContent = m === 'ai' ? 'AI' : '字卡';
b.classList.toggle('ai-on', m === 'ai');
b.title = m === 'ai' ? '当前：AI 扮演模式（点击切回字卡）' : '当前：字卡模式（点击切换 AI）';
}
function typing(on) {
try {
const el = document.getElementById('chat-typing');
if (el) el.hidden = !on;
} catch (e) {}
}
function toast(msg) { try { if (window.toast) window.toast(msg); } catch (e) {} }
function history(n) { try { return (window.__aiChatHistory && window.__aiChatHistory(n)) || []; } catch (e) { return []; } }
function bindBtn() {
const b = document.getElementById('chat-mode-btn');
if (!b) return;
b.addEventListener('click', function () {
const next = mode() === 'ai' ? 'card' : 'ai';
setMode(next);
toast(next === 'ai' ? '已切换到 AI 模式' : '已切换到字卡模式');
});
syncBtn();
}
function requestAI(messages) {
return new Promise(function (resolve, reject) {
const key = (gGet(K_KEY) || '').trim();
const ep = (gGet(K_EP) || DEF_EP).trim();
const model = (gGet(K_MODEL) || DEF_MODEL).trim();
if (!key) { reject(new Error('未配置 API Key')); return; }
let ctrl = null;
try { if (window.AbortController) ctrl = new AbortController(); } catch (e) {}
const timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} }, 60000);
fetch(ep, {
method: 'POST',
headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
body: JSON.stringify({ model: model, messages: messages, temperature: 1.0, max_tokens: 1500 }),
signal: ctrl ? ctrl.signal : undefined
}).then(function (r) {
if (!r.ok) {
return r.text().then(function (t) { throw new Error('HTTP ' + r.status + ' ' + String(t || '').slice(0, 120)); });
}
return r.json();
}).then(function (data) {
clearTimeout(timer);
const reply = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
if (!reply || !String(reply).trim()) { reject(new Error('AI 返回为空')); return; }
resolve(String(reply).trim());
}).catch(function (err) {
clearTimeout(timer);
reject(err);
});
});
}
window.__aiChatMode = function () { return mode() === 'ai'; };
function maybeSendSticker() {
try {
if (Math.random() >= 0.3) return;
const st = (window.getMediaCards && window.getMediaCards('sticker')) || [];
if (!st.length) return;
const pic = st[Math.floor(Math.random() * st.length)];
if (!pic) return;
setTimeout(function () {
try { if (window.chatAddIn) window.chatAddIn(pic, { type: 'sticker' }); } catch (e) {}
}, 600);
} catch (e) {}
}
window.__aiReply = function (text) {
const t = String(text == null ? '' : text);
let hist = history(20);
if (hist.length && hist[hist.length - 1].role === 'user' && hist[hist.length - 1].content === t) hist = hist.slice(0, -1);
const messages = [{ role: 'system', content: persona() }]
.concat(hist)
.concat([{ role: 'user', content: t }]);
typing(true);
requestAI(messages).then(function (out) {
typing(false);
if (window.chatAddIn) {
window.chatAddIn(out);
maybeSendSticker();
}
}).catch(function (err) {
typing(false);
toast('AI 回复失败：' + (err && err.message ? err.message : err));
});
};
window.__aiSay = function (instruction, extraSystem) {
const sys = persona() + (extraSystem ? '\n\n' + extraSystem : '');
const messages = [{ role: 'system', content: sys }]
.concat(history(20))
.concat([{ role: 'user', content: String(instruction == null ? '' : instruction) }]);
return requestAI(messages).then(function (out) {
if (mode() !== 'ai') return;
if (window.chatAddIn) window.chatAddIn(out);
}).catch(function () { /* 联动失败静默 */ });
};
window.__aiGenerate = function (prompt, extraSystem, noHistory) {
const sys = persona() + (extraSystem ? '\n\n' + extraSystem : '');
const base = [{ role: 'system', content: sys }];
const userMsg = { role: 'user', content: String(prompt == null ? '' : prompt) };
const messages = base.concat(noHistory ? [] : history(20)).concat([userMsg]);
return requestAI(messages).catch(function () {
return requestAI(base.concat([userMsg]));
});
};
function autoOn() { return sGet(K_AUTO) === '1'; }
function autoMinMs() { return Math.max(1, Number(sGet(K_AUTO_MIN) || 30)) * 60000; }
function autoMaxMs() { return Math.max(autoMinMs(), Number(sGet(K_AUTO_MAX) || 90) * 60000); }
let autoTimer = null;
function aiAutoSend() {
if (!(gGet(K_KEY) || '').trim()) return; // 没配 Key 就静默跳过，不刷提示
const messages = [{ role: 'system', content: persona() }]
.concat(history(20))
.concat([{ role: 'user', content: AUTO_PROMPT }]);
requestAI(messages).then(function (out) {
if (mode() !== 'ai') return;
if (window.chatAddIn) window.chatAddIn(out);
}).catch(function () { /* 后台失败静默 */ });
}
function aiAutoSchedule() {
clearTimeout(autoTimer);
if (mode() !== 'ai' || !autoOn()) return;
const min = autoMinMs(), max = autoMaxMs();
const delay = min + Math.random() * Math.max(1, max - min);
autoTimer = setTimeout(function () {
if (mode() === 'ai' && autoOn()) aiAutoSend();
aiAutoSchedule();
}, delay);
}
function bindInput(id, key, def) {
const el = document.getElementById(id);
if (!el) return;
el.value = gGet(key) || def || '';
el.addEventListener('change', function () { gSet(key, el.value.trim()); });
}
function bindAutoSettings() {
const tg = document.getElementById('ai-auto');
if (tg) {
tg.checked = autoOn();
tg.addEventListener('change', function () {
sSet(K_AUTO, tg.checked ? '1' : '0');
aiAutoSchedule();
toast(tg.checked ? '已开启：AI 会在随机时间主动发消息' : '已关闭 AI 主动发消息');
});
}
const mn = document.getElementById('ai-auto-min');
const mx = document.getElementById('ai-auto-max');
if (mn) {
mn.value = sGet(K_AUTO_MIN) || 30;
mn.addEventListener('change', function () { sSet(K_AUTO_MIN, String(Math.max(1, Number(mn.value) || 30))); aiAutoSchedule(); });
}
if (mx) {
mx.value = sGet(K_AUTO_MAX) || 90;
mx.addEventListener('change', function () { sSet(K_AUTO_MAX, String(Math.max(1, Number(mx.value) || 90))); aiAutoSchedule(); });
}
}
function bindSettings() {
bindInput('ai-ep', K_EP, DEF_EP);
bindInput('ai-key', K_KEY, '');
bindInput('ai-model', K_MODEL, DEF_MODEL);
const p = document.getElementById('ai-persona');
if (p) {
p.value = gGet(K_PERSONA) || DEF_PERSONA;
p.addEventListener('change', function () { gSet(K_PERSONA, p.value); });
}
bindAutoSettings();
}
function resyncSettings() {
const pairs = [['ai-ep', K_EP, DEF_EP], ['ai-key', K_KEY, ''], ['ai-model', K_MODEL, DEF_MODEL]];
pairs.forEach(function (p) {
const el = document.getElementById(p[0]);
if (el) el.value = gGet(p[1]) || p[2] || '';
});
const pe = document.getElementById('ai-persona');
if (pe) pe.value = gGet(K_PERSONA) || DEF_PERSONA;
const tg = document.getElementById('ai-auto');
if (tg) tg.checked = autoOn();
const mn = document.getElementById('ai-auto-min');
if (mn) mn.value = sGet(K_AUTO_MIN) || 30;
const mx = document.getElementById('ai-auto-max');
if (mx) mx.value = sGet(K_AUTO_MAX) || 90;
}
function init() {
bindBtn();
bindSettings();
aiAutoSchedule();
document.addEventListener('contact-switched', function () { syncBtn(); aiAutoSchedule(); });
document.addEventListener('mochi-restore-done', resyncSettings);
}
if (document.body) init();
else document.addEventListener('DOMContentLoaded', init);
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("ai-chat.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("ai-chat.js"); try { console.error("[JS] ai-chat.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[ai-chat.js] " + String(__e && __e.message || __e)); } })();