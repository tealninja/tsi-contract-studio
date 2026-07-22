/* Build a single-file, offline bundle of TSI Contract Studio as a no-iframe SPA.
   studio.js + diff.js load once globally; fetch() is shimmed to an in-memory VFS;
   each page's body + init mount into one document on navigation. Avoids the
   iframe srcdoc size limit that truncated large pages.
   Outputs:
     dist/TSI-Contract-Studio.html   (standalone — double-click, offline)
     dist/artifact-shell.html        (body-only shell for hosting as an Artifact)
*/
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');  // repo root (portable: works locally and in CI)
const OUT = path.join(ROOT, 'dist');
fs.mkdirSync(OUT, { recursive: true });
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// ── VFS: every file the app fetches, keyed repo-relative ──
const VFS = {};
(function walk(dir) {
  for (const name of fs.readdirSync(path.join(ROOT, dir || '.'))) {
    if (name === '.git' || name === 'dist') continue;
    const rel = dir ? dir + '/' + name : name;
    const st = fs.statSync(path.join(ROOT, rel));
    if (st.isDirectory()) walk(rel);
    else if (/\.(html|json)$/.test(name)) VFS[rel] = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  }
})('config'); ['templates', 'stubs', 'document-library', 'projects', 'visits'].forEach(d => (function walk(dir) {
  for (const name of fs.readdirSync(path.join(ROOT, dir))) {
    const rel = dir + '/' + name;
    const st = fs.statSync(path.join(ROOT, rel));
    if (st.isDirectory()) walk(rel);
    else if (/\.(html|json)$/.test(name)) VFS[rel] = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  }
})(d));

const studioCss = read('studio/studio.css');
const studioJs = read('studio/studio.js');
const diffJs = read('studio/diff.js');
const logoDataUri = 'data:image/svg+xml;base64,' + Buffer.from(read('assets/logo-white.svg')).toString('base64');

// ── Split each page into { body, init } ──
const PAGES = ['index.html', 'assembly.html', 'stubs.html', 'tracker.html', 'visits.html'];
const prepared = {};
for (const page of PAGES) {
  const html = read('studio/' + page);
  let body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)[1];
  body = body.replace(/<script src="studio\.js"><\/script>/g, '').replace(/<script src="diff\.js"><\/script>/g, '');
  const im = body.match(/<script>([\s\S]*?)<\/script>/);
  const init = im ? im[1] : '';
  if (im) body = body.replace(im[0], '');
  body = body.split('../assets/logo-white.svg').join(logoDataUri);
  prepared[page] = { body: body, init: init };
}
// Bodies embed as JSON; inits emit as REAL functions (no eval / new Function)
// so the bundle runs under a strict Artifact CSP that forbids unsafe-eval.
const bodies = {}; PAGES.forEach(p => { bodies[p] = prepared[p].body; });
const initsBlock = 'window.__INITS = {\n' +
  PAGES.map(p => JSON.stringify(p) + ': function(){\n' + prepared[p].init + '\n}').join(',\n') + '\n};\n';

// Escape < > (and JS line separators) so embedded HTML/code in JS string
// literals can't terminate the parent <script> or break the parser.
const safeJSON = (o) => JSON.stringify(o)
  .replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
  .replace(new RegExp(String.fromCharCode(0x2028),'g'), '\\u2028')
  .replace(new RegExp(String.fromCharCode(0x2029),'g'), '\\u2029');
const ROUTER = `
window.__VFS = ${safeJSON(VFS)};
(function(){
  var VFS = window.__VFS;
  function norm(u){ u=String(u).split('#')[0].split('?')[0]; u=u.replace(/^\\.\\//,''); while(u.indexOf('../')===0)u=u.slice(3); return u.replace(/^\\//,''); }
  window.fetch = function(u){
    var k = norm(u);
    if (Object.prototype.hasOwnProperty.call(VFS,k)){
      var body = VFS[k];
      return Promise.resolve({ ok:true, status:200, url:String(u),
        text:function(){return Promise.resolve(body);}, json:function(){return Promise.resolve(JSON.parse(body));} });
    }
    return Promise.resolve({ ok:false, status:404, url:String(u),
      text:function(){return Promise.resolve('');}, json:function(){return Promise.reject(new Error('404 '+k));} });
  };
})();
// The bundle routes via hash and reads params from memory — neutralize the
// file:// warning and history API (opaque file origins reject pushState).
TSI.isFileProtocol = function(){ return false; };
try { history.replaceState = function(){}; history.pushState = function(){}; } catch(e){}
window.__pendingParams = {};
TSI.params = function(){ return window.__pendingParams || {}; };
window.__PAGES = ${safeJSON(bodies)};
${initsBlock}
var NAMES = ['index.html','assembly.html','stubs.html','tracker.html','visits.html'];
function mount(file, params){
  if(!window.__PAGES[file]) file='index.html';
  window.__pendingParams = params || {};
  window.__activePage = file;
  document.getElementById('app').innerHTML = window.__PAGES[file];
  try { window.__INITS[file](); } catch(e){ console.error('page init error ('+file+'):', e); }
  document.querySelectorAll('#app .app-nav a').forEach(function(a){ a.classList.toggle('active', a.getAttribute('href')===file); });
  try { location.hash = file + (params && Object.keys(params).length ? ('?'+Object.keys(params).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(params[k]);}).join('&')) : ''); } catch(e){}
  window.scrollTo(0,0);
}
window.__nav = function(href){
  var file = href.split('?')[0].split('/').pop() || 'index.html';
  var q = href.indexOf('?')>=0 ? href.slice(href.indexOf('?')+1) : '';
  var params = {}; if(q) q.split('&').forEach(function(kv){ var p=kv.split('='); if(p[0]) params[decodeURIComponent(p[0])]=decodeURIComponent((p[1]||'').replace(/\\+/g,' ')); });
  mount(file, params);
};
document.addEventListener('click', function(e){
  var a = e.target && e.target.closest && e.target.closest('a[href]'); if(!a) return;
  var href = a.getAttribute('href'); if(!href || /^https?:|^mailto:|^#/.test(href)) return;
  var file = href.split('?')[0].split('/').pop();
  if(NAMES.indexOf(file)!==-1){ e.preventDefault(); window.__nav(href); }
}, true);
(function(){ var h=(location.hash||'').replace(/^#/,''); window.__nav(h||'index.html'); })();`;

const shellBody =
  '<style>\n' + studioCss + '\nhtml,body{margin:0}\n</style>\n' +
  '<div id="app"></div>\n' +
  '<script>\n' + studioJs + '\n</script>\n' +
  '<script>\n' + diffJs + '\n</script>\n' +
  '<script>\n' + ROUTER + '\n</script>';

const favicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%2319446C'/%3E%3Ccircle cx='16' cy='16' r='7' fill='none' stroke='%2300929F' stroke-width='3'/%3E%3C/svg%3E";
const standalone = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>TSI Contract Studio</title>\n' +
  '<link rel="icon" href="' + favicon + '">\n</head>\n<body>\n' + shellBody + '\n</body>\n</html>\n';

fs.writeFileSync(path.join(OUT, 'TSI-Contract-Studio.html'), standalone);
fs.writeFileSync(path.join(OUT, 'artifact-shell.html'), shellBody);
const kb = (s) => Math.round(Buffer.byteLength(s) / 1024);
console.log('VFS files:', Object.keys(VFS).length, '| standalone:', kb(standalone), 'KB | artifact-shell:', kb(shellBody), 'KB');
