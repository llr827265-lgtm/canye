(function () { try {
/* ===== 本地新增：站点名字自定义（v2：只保留改名） =====
数据：全局根命名空间 xy-home-v2:site-name（跨桌面共享）
· 名字：状态栏品牌 + 网页标题
封面与桌面图标已在源文件里固定（PWA 图标 + manifest），不再提供站内上传。
入口：设置 → 通用 → 站点名字（本文件注入该行，不改 template）
*/
(function () {
'use strict';
function gs() { try { return window.xyStore('xy-home-v2'); } catch (e) { return null; } }
function get(k) { try { const s = gs(); return s ? s.get(k) : null; } catch (e) { return null; } }
function set(k, v) { try { const s = gs(); if (s) s.set(k, v); } catch (e) {} }
function el(id) { return document.getElementById(id); }
function toast(m) { try { if (window.toast) window.toast(m); } catch (e) {} }
const DEF_NAME = '灿夜小屋';
function applyBrand() {
const name = String(get('site-name') || '').trim();
const brand = document.querySelector('.statusbar .brand');
if (brand) brand.textContent = name || DEF_NAME;
try { document.title = name ? (name + ' · 字卡传讯') : (DEF_NAME + ' · 字卡传讯'); } catch (e) {}
}
let mask = null;
function ensureEditor() {
if (mask && mask.isConnected) return mask;
mask = document.createElement('div');
mask.className = 'sb-mask';
mask.id = 'sb-mask';
mask.hidden = true;
mask.innerHTML =
'<div class="sb-panel">' +
'<div class="sb-head"><b>站点名字</b><span class="sb-close" id="sb-close">×</span></div>' +
'<div class="sb-body">' +
'<label class="sb-lbl">网站名字</label>' +
'<input class="sb-inp" id="sb-name" maxlength="12" placeholder="' + DEF_NAME + '">' +
'<div class="sb-hint">用于状态栏和网页标题；留空则恢复默认「' + DEF_NAME + '」。封面与桌面图标已在源文件中固定，不再在这里修改。</div>' +
'</div>' +
'<div class="sb-foot"><button class="sb-btn primary" id="sb-save">保存</button></div>' +
'</div>';
document.body.appendChild(mask);
mask.addEventListener('click', function (e) { if (e.target === mask) closeEditor(); });
el('sb-close').addEventListener('click', closeEditor);
el('sb-save').addEventListener('click', function () {
const nm = String(el('sb-name').value || '').trim();
set('site-name', nm);
applyBrand();
toast(nm ? '已保存：' + nm : '已恢复默认名字');
closeEditor();
});
return mask;
}
function openEditor() {
const m = ensureEditor();
const nm = el('sb-name');
if (nm) nm.value = String(get('site-name') || '');
m.hidden = false;
}
function closeEditor() { if (mask) mask.hidden = true; }
function injectRow() {
const sec = document.querySelector('#page-setting .them-sec[data-sec="basic"]')
|| document.querySelector('#page-setting .them-sec[data-sec="tools"]')
|| document.querySelector('#page-setting .them-sec');
if (!sec) return;
if (document.getElementById('row-sitebrand')) return;
const grp = document.createElement('div');
grp.className = 'set-group glass';
grp.innerHTML = '<div class="set-row" id="row-sitebrand">' +
'<div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16M4 12h10M4 19h7"/></svg></div>' +
'<div class="txt">站点名字<span class="sub">改网站名字（状态栏 + 网页标题），只影响显示，不影响功能</span></div>' +
'<div class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></div>' +
'</div>';
sec.appendChild(grp);
const row = grp.querySelector('#row-sitebrand');
if (row) row.addEventListener('click', openEditor);
}
function boot() {
applyBrand();
injectRow();
setTimeout(injectRow, 1200);
setInterval(injectRow, 4000);
}
if (document.body) boot();
else document.addEventListener('DOMContentLoaded', boot);
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("site-brand.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("site-brand.js"); try { console.error("[JS] site-brand.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[site-brand.js] " + String(__e && __e.message || __e)); } })();