import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const assetsDir = path.join(distDir, 'assets');

const htmlTemplate = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
const assetFiles = fs.readdirSync(assetsDir);

const cssFile = assetFiles.find((f) => f.endsWith('.css'));
const jsFile = assetFiles.find((f) => f.endsWith('.js'));

if (!cssFile || !jsFile) {
  throw new Error('dist/assets 내 빌드된 CSS 또는 JS 파일을 찾을 수 없습니다.');
}

const cssContent = fs.readFileSync(path.join(assetsDir, cssFile), 'utf8');
const jsContent = fs
  .readFileSync(path.join(assetsDir, jsFile), 'utf8')
  .replace(/<\/script/gi, '<\\/script');

// 외부 모듈/스타일시트 태그를 제거하고 단일 HTML 내부에 인라인 삽입 (서버 없이 더블클릭 실행 가능)
let standaloneHtml = htmlTemplate
  .replace(/<script\b[^>]*src="[^"]*"[^>]*><\/script>/gi, '')
  .replace(/<link\b[^>]*rel="stylesheet"[^>]*href="\.\/assets\/[^"]*"[^>]*\/?>/gi, '');

standaloneHtml = standaloneHtml.replace(
  '</head>',
  () => `  <style>\n${cssContent}\n  </style>\n  </head>`
);

standaloneHtml = standaloneHtml.replace(
  '</body>',
  () => `  <script type="module">\n${jsContent}\n  </script>\n  </body>`
);

const outFile = path.join(rootDir, 'DELTA_출제스튜디오_바로열기.html');
fs.writeFileSync(outFile, standaloneHtml, 'utf8');
console.log('Standalone HTML generated:', outFile, `(${Math.round(standaloneHtml.length / 1024)} KB)`);
