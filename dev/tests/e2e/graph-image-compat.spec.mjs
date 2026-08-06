import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.dirname(fileURLToPath(new URL('../../../index.html', import.meta.url)));
const fixturePath = path.join(repositoryRoot, 'assets/characters/ch-anna-neutral-smallresolution.png');
const fixtureUrl = 'http://127.0.0.1:41739/__graph-image-compat.png';
const crossBrowserTinyFixtureBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

// Создаёт одинаковые HTML, foreignObject и SVG-контейнеры для обычного и Blob URL.
function createCompatibilityMarkup() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; background: #20252b; color: #fff; font: 14px sans-serif; }
    .row { display: flex; gap: 12px; padding: 12px; }
    .cell { width: 120px; min-height: 150px; padding: 8px; background: #fff; color: #111; }
    img { display: block; width: 100px; height: 120px; object-fit: contain; background: #ddd; }
    svg { display: block; width: 280px; height: 320px; margin: 12px; background: #fff; }
  </style>
</head>
<body>
  <div class="row">
    <div class="cell"><b>HTML HTTP</b><img id="html-http" alt=""></div>
    <div class="cell"><b>HTML Blob</b><img id="html-blob" alt=""></div>
  </div>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 320">
    <foreignObject x="10" y="10" width="120" height="145">
      <div xmlns="http://www.w3.org/1999/xhtml" class="cell">
        <b>FO HTTP</b><img id="fo-http" alt="" />
      </div>
    </foreignObject>
    <foreignObject x="150" y="10" width="120" height="145">
      <div xmlns="http://www.w3.org/1999/xhtml" class="cell">
        <b>FO Blob</b><img id="fo-blob" alt="" />
      </div>
    </foreignObject>
    <text x="10" y="180" fill="#111">SVG HTTP</text>
    <image id="svg-http" x="10" y="190" width="120" height="120" preserveAspectRatio="xMidYMid meet" />
    <text x="150" y="180" fill="#111">SVG Blob</text>
    <image id="svg-blob" x="150" y="190" width="120" height="120" preserveAspectRatio="xMidYMid meet" />
  </svg>
</body>
</html>`;
}

// Запускает шесть загрузок и снимает состояние в событии и после двух кадров, пока Blob URL ещё действителен.
async function runCompatibilityMatrix(page, fixtureBase64) {
  return page.evaluate(async function runMatrixInBrowser(input) {
    function nextFrame() {
      return new Promise(function(resolve) {
        requestAnimationFrame(resolve);
      });
    }

    function snapshot(element) {
      var rect = element.getBoundingClientRect();
      return {
        complete: typeof element.complete === 'boolean' ? element.complete : null,
        naturalWidth: Number(element.naturalWidth || 0),
        naturalHeight: Number(element.naturalHeight || 0),
        clientWidth: Math.round(rect.width),
        clientHeight: Math.round(rect.height),
        namespace: element.namespaceURI || '',
        source: element.getAttribute('src') || element.getAttribute('href') || ''
      };
    }

    function observe(element) {
      return new Promise(function(resolve) {
        var settled = false;
        var timeoutId = setTimeout(function() {
          finish('timeout');
        }, 5000);

        function finish(eventType) {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          var atEvent = snapshot(element);
          nextFrame().then(nextFrame).then(function() {
            resolve({ event: eventType, atEvent: atEvent, afterFrames: snapshot(element) });
          });
        }

        element.addEventListener('load', function() { finish('load'); }, { once: true });
        element.addEventListener('error', function() { finish('error'); }, { once: true });
      });
    }

    var binary = atob(input.fixtureBase64);
    var bytes = new Uint8Array(binary.length);
    for (var byteIndex = 0; byteIndex < binary.length; byteIndex++) {
      bytes[byteIndex] = binary.charCodeAt(byteIndex);
    }
    var blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
    var cases = {
      htmlHttp: document.getElementById('html-http'),
      htmlBlob: document.getElementById('html-blob'),
      foreignObjectHttp: document.getElementById('fo-http'),
      foreignObjectBlob: document.getElementById('fo-blob'),
      svgHttp: document.getElementById('svg-http'),
      svgBlob: document.getElementById('svg-blob')
    };
    var pending = {};
    Object.keys(cases).forEach(function(caseName) {
      pending[caseName] = observe(cases[caseName]);
    });

    cases.htmlHttp.src = input.fixtureUrl;
    cases.htmlBlob.src = blobUrl;
    cases.foreignObjectHttp.src = input.fixtureUrl;
    cases.foreignObjectBlob.src = blobUrl;
    cases.svgHttp.setAttribute('href', input.fixtureUrl);
    cases.svgBlob.setAttribute('href', blobUrl);

    var names = Object.keys(cases);
    var values = await Promise.all(names.map(function(caseName) { return pending[caseName]; }));
    var results = {};
    names.forEach(function(caseName, index) {
      results[caseName] = values[index];
    });

    window.__graphImageCompatibility = { blobUrl: blobUrl, cases: cases };
    return results;
  }, { fixtureBase64, fixtureUrl });
}

// Освобождает Blob URL и показывает, сохраняет ли каждый контейнер уже декодированное изображение после двух кадров.
async function captureAfterBlobRevoke(page) {
  return page.evaluate(async function revokeAndCapture() {
    function nextFrame() {
      return new Promise(function(resolve) { requestAnimationFrame(resolve); });
    }

    function snapshot(element) {
      var rect = element.getBoundingClientRect();
      return {
        complete: typeof element.complete === 'boolean' ? element.complete : null,
        naturalWidth: Number(element.naturalWidth || 0),
        naturalHeight: Number(element.naturalHeight || 0),
        clientWidth: Math.round(rect.width),
        clientHeight: Math.round(rect.height)
      };
    }

    var state = window.__graphImageCompatibility;
    URL.revokeObjectURL(state.blobUrl);
    await nextFrame();
    await nextFrame();
    var output = {};
    Object.keys(state.cases).forEach(function(caseName) {
      output[caseName] = snapshot(state.cases[caseName]);
    });
    return output;
  });
}

// Матрица подтверждает, что реальное изображение одинаково работает через HTTP и Blob URL во всех контейнерах графа.
test('браузер диагностирует HTTP и Blob изображения внутри HTML, foreignObject и SVG', async function({ page }, testInfo) {
  const fixture = await readFile(fixturePath);
  await page.route(fixtureUrl, async function serveCompatibilityFixture(route) {
    await route.fulfill({ status: 200, contentType: 'image/png', body: fixture });
  });
  await page.setContent(createCompatibilityMarkup());

  const beforeRevoke = await runCompatibilityMatrix(page, fixture.toString('base64'));
  const screenshotBeforeRevoke = await page.screenshot({ fullPage: true });
  const afterRevoke = await captureAfterBlobRevoke(page);
  const report = {
    browser: testInfo.project.name,
    beforeRevoke,
    afterRevoke
  };

  await testInfo.attach('graph-image-compatibility.json', {
    body: Buffer.from(JSON.stringify(report, null, 2), 'utf8'),
    contentType: 'application/json'
  });
  await testInfo.attach('graph-image-before-revoke.png', {
    body: screenshotBeforeRevoke,
    contentType: 'image/png'
  });
  console.log(`[GRAPH IMAGE COMPAT ${testInfo.project.name}] ${JSON.stringify(report)}`);

  for (const caseName of ['htmlHttp', 'htmlBlob', 'foreignObjectHttp', 'foreignObjectBlob']) {
    expect(beforeRevoke[caseName].event).toBe('load');
    expect(beforeRevoke[caseName].afterFrames.naturalWidth).toBeGreaterThan(0);
    expect(beforeRevoke[caseName].afterFrames.naturalHeight).toBeGreaterThan(0);
  }
  expect(beforeRevoke.svgHttp.event).toBe('load');
  expect(beforeRevoke.svgBlob.event).toBe('load');
  expect(afterRevoke.htmlBlob.naturalWidth).toBeGreaterThan(0);
  expect(afterRevoke.foreignObjectBlob.naturalWidth).toBeGreaterThan(0);
});

// Проверяет компактную 1×1 fixture из CSS-пакетов E2E, чтобы оба браузера действительно декодировали её в HTML и foreignObject.
test('компактная PNG fixture декодируется в HTML и foreignObject', async function({ page }, testInfo) {
  const fixture = Buffer.from(crossBrowserTinyFixtureBase64, 'base64');
  await page.route(fixtureUrl, async function serveCrossBrowserTinyFixture(route) {
    await route.fulfill({ status: 200, contentType: 'image/png', body: fixture });
  });
  await page.setContent(createCompatibilityMarkup());

  const beforeRevoke = await runCompatibilityMatrix(page, crossBrowserTinyFixtureBase64);
  const report = {
    browser: testInfo.project.name,
    beforeRevoke
  };
  await testInfo.attach('graph-image-tiny-fixture.json', {
    body: Buffer.from(JSON.stringify(report, null, 2), 'utf8'),
    contentType: 'application/json'
  });
  console.log(`[GRAPH IMAGE TINY FIXTURE ${testInfo.project.name}] ${JSON.stringify(report)}`);

  for (const caseName of ['htmlHttp', 'htmlBlob', 'foreignObjectHttp', 'foreignObjectBlob']) {
    expect(beforeRevoke[caseName].event).toBe('load');
    expect(beforeRevoke[caseName].afterFrames.naturalWidth).toBe(1);
    expect(beforeRevoke[caseName].afterFrames.naturalHeight).toBe(1);
  }
  expect(beforeRevoke.svgHttp.event).toBe('load');
  expect(beforeRevoke.svgBlob.event).toBe('load');
});
