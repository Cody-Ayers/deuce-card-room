// Builds the native app's web bundle in www/ from the same files GitHub Pages serves.
// Differences from the website:
//  - fonts are bundled (fonts/), so the app looks right with no connection
//  - the Supabase library is bundled from node_modules when installed
//  - no service worker (the native app ships its files already), and the
//    status bar is set to light text on the dark header
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const out = 'www';
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ['cloud.js', 'manifest.webmanifest']) cpSync(f, `${out}/${f}`);
for (const d of ['icons', 'fonts']) cpSync(d, `${out}/${d}`, { recursive: true });

const fontsLink = /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n(?:<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\n)?<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2[^"]*">/;
function localFonts(html, file) {
  if (!fontsLink.test(html)) throw new Error(`Google Fonts link not found in ${file}`);
  return html.replace(fontsLink, '<link rel="stylesheet" href="fonts/fonts.css">');
}

let index = localFonts(readFileSync('index.html', 'utf8'), 'index.html');

const vendored = 'node_modules/@supabase/supabase-js/dist/umd/supabase.js';
if (existsSync(vendored)) {
  mkdirSync(`${out}/vendor`);
  cpSync(vendored, `${out}/vendor/supabase.js`);
  index = index.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^"]+"><\/script>/, '<script src="vendor/supabase.js"></script>');
} else {
  console.warn('! @supabase/supabase-js not installed; the app will load it from the CDN when online. Run npm install to bundle it.');
}

const swBlock = /<script>\nif\('serviceWorker' in navigator\)[\s\S]*?<\/script>/;
if (!swBlock.test(index)) throw new Error('service worker registration block not found');
index = index.replace(swBlock, `<script>
(function(){
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  document.documentElement.classList.add('native');
  var SB = C.Plugins && C.Plugins.StatusBar;
  if (SB) SB.setStyle({ style: 'DARK' }).catch(function(){});
})();
</script>`);
writeFileSync(`${out}/index.html`, index);
writeFileSync(`${out}/privacy.html`, localFonts(readFileSync('privacy.html', 'utf8'), 'privacy.html'));
console.log('Built www/ for the native app.');
