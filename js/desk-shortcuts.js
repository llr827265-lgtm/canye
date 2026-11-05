(function () { try {
/* ===== 本地新增：桌面快捷方式（字卡库 / 设置）=====
底部导航栏移除后，字卡库与设置改为桌面一级图标；点击打开对应页面。
图标本身仍在 .app-grid 里，拖动排序 / 换图标等既有装修能力不受影响。 */
(function () {
'use strict';
function openPage(id) {
const p = document.getElementById(id);
if (!p) return;
document.querySelectorAll('.page').forEach(function (x) { x.hidden = true; });
p.hidden = false;
}
function bind(app, pageId) {
const el = document.querySelector('.app[data-app="' + app + '"]');
if (!el) return;
el.addEventListener('click', function () {
const editing = Array.from(document.querySelectorAll('.app-grid')).some(function (g) { return g.classList.contains('editing'); });
if (editing) return;
openPage(pageId);
});
}
bind('chatcard', 'page-chatcard');
bind('setting', 'page-setting');
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("desk-shortcuts.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("desk-shortcuts.js"); try { console.error("[JS] desk-shortcuts.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[desk-shortcuts.js] " + String(__e && __e.message || __e)); } })();