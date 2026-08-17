import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.dirname(fileURLToPath(new URL('../../index.html', import.meta.url)));

// Читает runtime-файл относительно корня репозитория для статической проверки удалённых небезопасных веток.
function readProjectFile(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

// Закрепляет понятный отказ для IE до запуска современного runtime, не добавляя небезопасную legacy-ветку движка.
test('Internet Explorer получает сообщение о неподдерживаемом браузере', async function() {
  const indexSource = await readProjectFile('index.html');

  assert.match(indexSource, /id="unsupportedBrowser"[^>]+style="display:none;/);
  assert.match(indexSource, /Internet Explorer не поддерживается/);
  assert.match(indexSource, /if \(!document\.documentMode\) return;/);
  assert.match(indexSource, /application\.style\.display = "none"/);
  assert.match(indexSource, /warning\.style\.display = "flex"/);
});

// Фиксирует полный отказ runtime от глобальных карт и динамического подключения JS-панорам.
test('движок не содержит загрузчика JS-пакетов 360', async function() {
  const [engineSource, loaderSource, converterSource] = await Promise.all([
    readProjectFile('engine/engine.js'),
    readProjectFile('engine/story-loader.js'),
    readProjectFile('tools/convert-360-img-to-css.html')
  ]);

  assert.doesNotMatch(engineSource, /VN360_PACKS/);
  assert.doesNotMatch(engineSource, /getBg360PackScriptUrl/);
  assert.doesNotMatch(engineSource, /isBg360PackScriptPath/);
  assert.doesNotMatch(engineSource, /ensureBg360PackLoaded/);
  assert.match(loaderSource, /JavaScript panorama packages are not supported/);
  assert.doesNotMatch(converterSource, /function buildPackJs\(|<option\s+value="js"/);
  assert.doesNotMatch(converterSource, /id="packOutputFormat"|Формат сохраняемых пакетов/);
  assert.match(converterSource, /function getSelectedPackOutputFormat\(\)\s*\{\s*return "css";\s*\}/);
});

// Проверяет обязательные sandbox и Permissions Policy iframe, а также отсутствие переключателей legacy.
test('мини-игры поддерживают только strict sandbox, ограниченную Permissions Policy и протокол v2', async function() {
  const [indexSource, engineSource, protocolSource, testerSource] = await Promise.all([
    readProjectFile('index.html'),
    readProjectFile('engine/engine.js'),
    readProjectFile('engine/game-protocol.js'),
    readProjectFile('tools/game-tester.html')
  ]);

  assert.match(indexSource, /id="gameFrame"[^>]+sandbox="allow-scripts"[^>]+referrerpolicy="no-referrer"/);
  assert.match(indexSource, /id="statsGameFrame"[^>]+sandbox="allow-scripts"[^>]+referrerpolicy="no-referrer"/);
  assert.match(indexSource, /id="gameFrame"[^>]+allow="autoplay;[^\"]+camera 'none';[^\"]+microphone 'none';[^\"]+usb 'none'/);
  assert.match(indexSource, /id="statsGameFrame"[^>]+allow="autoplay;[^\"]+camera 'none';[^\"]+microphone 'none';[^\"]+usb 'none'/);
  assert.match(engineSource, /frame\.setAttribute\("allow", GAME_FRAME_PERMISSIONS_POLICY\)/);
  assert.match(engineSource, /if \(!prepareSingleGameFrameLaunch\("story"\)\) return/);
  assert.match(engineSource, /if \(!prepareSingleGameFrameLaunch\("stats"\)\) return/);
  assert.match(testerSource, /id="gameFrame"[^>]+allow="autoplay;[^\"]+camera 'none';[^\"]+microphone 'none';[^\"]+usb 'none'/);
  assert.doesNotMatch(engineSource, /resolveGameSandboxMode|allowLegacyResult/);
  assert.doesNotMatch(protocolSource, /allowLegacyResult/);
  assert.doesNotMatch(testerSource, /<option\s+value="legacy"|id="sandboxMode"|allowLegacyResult/);
});

// Запрещает возврат loose-конфигурации и прямую вставку строки SVG в DOM статистики.
test('Mermaid работает в strict и проходит отдельную очистку SVG', async function() {
  const engineSource = await readProjectFile('engine/engine.js');

  assert.match(engineSource, /securityLevel:\s*"strict"/);
  assert.match(engineSource, /function sanitizeMermaidRenderedTree\(/);
  assert.match(engineSource, /function createSafeMermaidSvgNode\(/);
  assert.match(engineSource, /mermaidGraph\.appendChild\(safeSvg\)/);
  assert.doesNotMatch(engineSource, /mermaidGraph\.innerHTML\s*=\s*result/);
  assert.doesNotMatch(engineSource, /result\.bindFunctions\(/);
});

// Закрепляет приватный канал отчётов и честное описание границ Worker, iframe, checksum и доверенного ключа.
test('политика безопасности и модель угроз соответствуют runtime-контрактам', async function() {
  const [securitySource, threatModelSource, readmeSource, englishReadmeSource] = await Promise.all([
    readProjectFile('SECURITY.md'),
    readProjectFile('docs/security/threat-model.md'),
    readProjectFile('README.md'),
    readProjectFile('README-EN.md')
  ]);
  const privateReportUrl = 'https://github.com/IlyaBarilo/vn-vertical-engine/security/advisories/new';

  assert.ok(securitySource.includes(privateReportUrl));
  assert.ok(readmeSource.includes(privateReportUrl));
  assert.ok(englishReadmeSource.includes(privateReportUrl));
  assert.match(securitySource, /Последний опубликованный непререлизный GitHub Release \| Поддерживается/);
  assert.ok(securitySource.includes('[модели угроз](docs/security/threat-model.md)'));
  assert.ok(securitySource.includes('Это не цифровая подпись'));
  assert.ok(securitySource.includes('`license-key.js` выполняется в основном окне'));

  [
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
    'EventSource',
    'WebTransport',
    'Worker',
    'SharedWorker',
    'BroadcastChannel',
    'indexedDB',
    'caches',
    'importScripts'
  ].forEach(function(apiName) {
    assert.match(threatModelSource, new RegExp('\\b' + apiName + '\\b'));
  });
  assert.ok(threatModelSource.includes('sandbox="allow-scripts"'));
  assert.ok(threatModelSource.includes("`connect-src 'none'`"));
  assert.ok(threatModelSource.includes('`event.source`'));
  assert.ok(threatModelSource.includes('`sessionId`'));
  assert.ok(threatModelSource.includes('не доказывает подлинность'));
});
