/* global window, document, location, VNStorySandboxLoader, Worker, showDirectoryPicker, isSecureContext */
import { test, expect } from '@playwright/test';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = path.join(root, 'dev/.playwright/story-worker-research');
const markerSource = 'window.STORY_TEXT = "worker-probe";';
// Nonce разрешает доверенный loader даже при file:// origin; политика Worker ограничивает отдельные категории запросов.
const cspHtml = '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'nonce-researchOnly123\' data:; worker-src blob:; connect-src \'none\'; base-uri \'none\'"><body><script nonce="researchOnly123" src="loader.js"></script>';
let fixture;
let results;

// Все создаваемые текстовые fixtures используют CRLF; исходные файлы движка не меняются.
async function writeFixture(name, source) {
  await writeFile(path.join(fixture, name), source.replace(/\r?\n/g, '\r\n'), 'utf8');
}

// Записывает наблюдение без ожидания заранее выбранного результата совместимости.
function record(name, result) {
  results.cases.push({ case: name, ...result });
  console.log(JSON.stringify({ case: name, ...result }));
}

// Каждый браузер получает собственную локальную копию с настоящим загрузчиком и синтетическими сценариями.
test.beforeAll(async function prepareProbe({ browser }, testInfo) {
  await mkdir(output, { recursive: true });
  fixture = await mkdtemp(path.join(output, 'fixture-'));
  results = { project: testInfo.project.name, version: browser.version(), protocol: 'file:', strictFilePolicy: true, cases: [] };
  await copyFile(path.join(root, 'engine/story-sandbox-loader.js'), path.join(fixture, 'loader.js'));
  await writeFixture('story.js', markerSource);
  await writeFixture('story.txt', markerSource);
  await writeFixture('story.mjs', markerSource);
  await writeFixture('index.html', '<!doctype html><meta charset="utf-8"><body><input type="file" id="files" multiple><script src="loader.js"></script>');
});

// Сохраняет машиночитаемый отчёт отдельно от Git и удаляет только собственный временный каталог.
test.afterAll(async function saveProbe() {
  // Имя отдельного прогона сохраняет полный отчёт при целевом повторе нескольких проверок.
  const label = (process.env.VN_RESEARCH_RUN_LABEL || '').replace(/[^a-z0-9-]/gi, '');
  if (results) await writeFile(path.join(output, results.project + (label ? '-' + label : '') + '.json'), JSON.stringify(results, null, 2).replace(/\n/g, '\r\n') + '\r\n');
  if (fixture && path.dirname(fixture) === output && path.basename(fixture).startsWith('fixture-')) await rm(fixture, { recursive: true, force: true });
});

// Возвращает изолированную страницу без сервера и без подмены file:// запросов.
test.beforeEach(async function openProbe({ page }) {
  await page.goto(pathToFileURL(path.join(fixture, 'index.html')).href);
});

// Проверяет отдельно создание Worker, транспорт импорта, MIME и видимый origin; каждый Worker завершается извне.
test('транспорты Worker и чтение локального JS', async function({ page }) {
  const workerProgram = `self.onmessage = async function(event) {
    var input = event.data;
    self.window = {};
    var info = { origin: self.origin, locationOrigin: location.origin };
    try {
      if (input.operation === 'fetch') {
        var response = await fetch(input.source, { mode: input.mode || 'cors' });
        info.responseType = response.type;
        info.text = await response.text();
      } else if (input.operation === 'module') {
        await import(input.source);
      } else {
        importScripts(input.source);
      }
      postMessage({ status: 'loaded', value: window.STORY_TEXT, ...info });
    } catch (error) { postMessage({ status: 'error', name: error.name, message: error.message, ...info }); }
  };`;
  await writeFixture('worker.js', workerProgram);
  const rows = await page.evaluate(async function probeWorkerTransports({ workerProgram, markerSource }) {
    // Дожидается результата либо таймаута и всегда освобождает поток и Blob URL.
    async function run(entry, sourceKind, operation = 'classic', extension = 'js', credentials = 'same-origin') {
      const blobUrls = [];
      // Создаёт URL с явным JavaScript MIME, чтобы отделить тип содержимого от политики origin.
      function blob(text, type = 'text/javascript') { const url = URL.createObjectURL(new Blob([text], { type })); blobUrls.push(url); return url; }
      const source = sourceKind === 'file' ? new URL('story.' + extension, location.href).href
        : sourceKind === 'blob' ? blob(markerSource)
          : 'data:text/javascript;charset=utf-8,' + encodeURIComponent(markerSource);
      const url = entry === 'file' ? new URL('worker.js', location.href).href
        : entry === 'blob' ? blob(workerProgram)
          : 'data:text/javascript;charset=utf-8,' + encodeURIComponent(workerProgram);
      return new Promise(function waitForWorker(resolve) {
        let worker;
        let timer;
        // Даже ошибка конструктора не оставляет созданных для опыта URL.
        function finish(result) { clearTimeout(timer); if (worker) worker.terminate(); for (const item of blobUrls) URL.revokeObjectURL(item); resolve({ entry, source: sourceKind, operation, extension, credentials, ...result }); }
        try {
          worker = new Worker(url, { type: operation === 'module' ? 'module' : 'classic', credentials });
          timer = setTimeout(function timeout() { finish({ status: 'timeout' }); }, 3000);
          worker.onmessage = function received(event) { finish(event.data); };
          worker.onerror = function failed(event) { event.preventDefault(); finish({ status: 'worker-error', message: event.message }); };
          worker.postMessage({ source, operation, mode: operation === 'fetch' ? 'no-cors' : undefined });
        } catch (error) { finish({ status: 'constructor-error', name: error.name, message: error.message }); }
      });
    }
    const rows = [];
    for (const entry of ['blob', 'data', 'file']) {
      for (const sourceKind of ['file', 'blob', 'data']) rows.push(await run(entry, sourceKind));
    }
    for (const extension of ['mjs', 'txt']) rows.push(await run('blob', 'file', 'classic', extension));
    rows.push(await run('blob', 'file', 'classic', 'js', 'omit'));
    rows.push(await run('blob', 'file', 'module'));
    rows.push(await run('blob', 'data', 'module'));
    rows.push(await run('data', 'file', 'module'));
    rows.push(await run('data', 'data', 'module'));
    rows.push(await run('blob', 'file', 'fetch'));
    // Нельзя считать успешный opaque response доступом к исходному тексту.
    try { const response = await fetch(new URL('story.js', location.href), { mode: 'no-cors' }); rows.push({ entry: 'page-fetch', status: 'loaded', responseType: response.type, text: await response.text() }); }
    catch (error) { rows.push({ entry: 'page-fetch', status: 'error', name: error.name, message: error.message }); }
    return rows;
  }, { workerProgram, markerSource });
  for (const row of rows) record('transport', row);
  expect(rows.some(function controlSucceeded(row) { return row.entry === 'blob' && row.source === 'data' && row.status === 'loaded'; })).toBe(true);
});

// Проверяет реальный сохранённый sandbox с файловым источником и с текстом, уже разрешённо полученным через File API.
test('сохранённый загрузчик и выбранные файлы', async function({ page }) {
  record('loader-file', await page.evaluate(async function loadFile() { const r = await VNStorySandboxLoader.loadStoryText('story.js'); return { status: r.status, message: r.message, value: r.value }; }));
  await page.locator('#files').setInputFiles(path.join(fixture, 'story.js'));
  const selected = await page.evaluate(async function loadSelectedFile() {
    const text = await document.querySelector('#files').files[0].text();
    const r = await VNStorySandboxLoader.loadStoryText('data:text/javascript;charset=utf-8,' + encodeURIComponent(text));
    return { status: r.status, value: r.value };
  });
  record('loader-selected-data', selected);
  expect(selected).toEqual({ status: 'loaded', value: 'worker-probe' });
  await page.reload();
  record('selection-after-reload', await page.evaluate(function readFileSelection() { return { files: document.querySelector('#files').files.length, directoryPicker: typeof showDirectoryPicker, secureContext: isSecureContext }; }));
});

// Испытывает iframe со строгим sandbox и контрольным ослабленным режимом, проверяя доступ к родителю.
test('iframe: загрузка и доступ авторского JS к странице', async function({ page }) {
  const userCode = `window.STORY_TEXT = 'worker-probe';
    try { parent.document.body.dataset.probeEscape = 'yes'; window.parentAccess = true; } catch (error) { window.parentAccess = false; }`;
  await writeFixture('frame-story.js', userCode);
  const frameHtml = '<!doctype html><meta charset="utf-8"><script src="frame-story.js"></script><script>parent.postMessage({ probeFrame: true, value: window.STORY_TEXT, parentAccess: window.parentAccess, origin: self.origin }, "*");</script>';
  await writeFixture('frame.html', frameHtml);
  for (const sandbox of ['allow-scripts', 'allow-scripts allow-same-origin']) {
    for (const kind of ['srcdoc', 'file']) {
      const row = await page.evaluate(async function runFrame({ sandbox, kind, frameHtml }) {
        delete document.body.dataset.probeEscape;
        return new Promise(function waitForFrame(resolve) {
          const frame = document.createElement('iframe');
          let timer;
          // Принимает ответ только от созданного iframe, затем удаляет его и подписку.
          function finish(result) { clearTimeout(timer); window.removeEventListener('message', receive); frame.remove(); resolve({ ...result, parentChanged: document.body.dataset.probeEscape === 'yes' }); }
          function receive(event) { if (event.source === frame.contentWindow && event.data?.probeFrame) finish({ status: 'reported', ...event.data }); }
          window.addEventListener('message', receive);
          frame.setAttribute('sandbox', sandbox);
          if (kind === 'file') frame.src = new URL('frame.html', location.href).href;
          else frame.srcdoc = frameHtml.replace('src="frame-story.js"', 'src="' + new URL('frame-story.js', location.href).href + '"');
          timer = setTimeout(function timeout() { finish({ status: 'timeout' }); }, 3000);
          document.body.appendChild(frame);
        });
      }, { sandbox, kind, frameHtml });
      record('frame', { sandbox, kind, ...row });
    }
  }
});

// Подмена fetch не должна ошибочно считаться запретом синтаксического import(); запросы поглощает локальный перехват Playwright.
test('Worker: DOM, сетевые API и динамический import', async function({ page, context }) {
  const attempted = [];
  await context.route('https://vn-worker-probe.invalid/**', async function interceptProbe(route) {
    attempted.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: 'export const probe = true;' });
  });
  const source = `var snapshot = { document: typeof document, fetch: typeof fetch, xhr: typeof XMLHttpRequest, nestedWorker: typeof Worker, parent: typeof window.parent };
    import('https://vn-worker-probe.invalid/module.mjs?probe=synthetic-canary').catch(function() {});
    var until = Date.now() + 250; while (Date.now() < until) {}
    window.STORY_TEXT = JSON.stringify(snapshot);`;
  const result = await page.evaluate(async function inspectWorker(source) {
    const r = await VNStorySandboxLoader.loadStoryText('data:text/javascript;charset=utf-8,' + encodeURIComponent(source));
    return { status: r.status, snapshot: r.status === 'loaded' ? JSON.parse(r.value) : null, message: r.message };
  }, source);
  await page.waitForTimeout(300);
  record('sandbox-network', { ...result, attemptedRequests: attempted.length });
  expect(result.status).toBe('loaded');
  expect(result.snapshot.document).toBe('undefined');
});

// Проверяет усиление Worker через унаследованный CSP: разрешены локальный загрузчик и data-код, сеть и внешние модули запрещены.
test('Worker с CSP блокирует динамический import', async function({ page, context }) {
  const attempted = [];
  await context.route('https://vn-worker-probe.invalid/**', async function interceptProbe(route) {
    attempted.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: 'export const probe = true;' });
  });
  await writeFixture('csp.html', cspHtml);
  await page.goto(pathToFileURL(path.join(fixture, 'csp.html')).href);
  const source = "import('https://vn-worker-probe.invalid/module.mjs?probe=csp-canary').catch(function() {}); var until = Date.now() + 250; while(Date.now() < until) {} window.STORY_TEXT = 'worker-probe';";
  const result = await page.evaluate(async function inspectCspWorker(source) {
    const r = await VNStorySandboxLoader.loadStoryText('data:text/javascript;charset=utf-8,' + encodeURIComponent(source));
    return { status: r.status, value: r.value, message: r.message };
  }, source);
  await page.waitForTimeout(300);
  record('sandbox-csp-network', { ...result, attemptedRequests: attempted.length });
  expect(result.status).toBe('loaded');
  expect(attempted).toEqual([]);
});

// Проверяет, остаются ли исходные API в цепочке прототипов после подмены собственных свойств self.
test('Worker: восстановление API через прототипы', async function({ page, context }) {
  const attempted = [];
  await context.route('https://vn-worker-probe.invalid/**', async function interceptProbe(route) {
    attempted.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'text/plain', headers: { 'Access-Control-Allow-Origin': '*' }, body: 'synthetic-response' });
  });
  const source = `var snapshot = {};
    var names = ['fetch', 'importScripts', 'Worker', 'indexedDB', 'caches'];
    var originals = {};
    for (var name of names) {
      var proto = Object.getPrototypeOf(self);
      while (proto) {
        var descriptor = Object.getOwnPropertyDescriptor(proto, name);
        if (descriptor) { originals[name] = descriptor.value || descriptor.get; break; }
        proto = Object.getPrototypeOf(proto);
      }
      snapshot[name] = typeof originals[name];
    }
    if (originals.fetch) originals.fetch.call(self, 'https://vn-worker-probe.invalid/prototype?probe=synthetic-canary').catch(function() {});
    if (originals.importScripts) {
      try { originals.importScripts.call(self, 'data:text/javascript,self.prototypeImportMarker=true'); snapshot.nestedImport = self.prototypeImportMarker === true; }
      catch (error) { snapshot.importError = error.name; }
    }
    var until = Date.now() + 250; while (Date.now() < until) {}
    window.STORY_TEXT = JSON.stringify(snapshot);`;
  for (const policy of ['none', 'csp']) {
    attempted.length = 0;
    if (policy === 'csp') {
      await writeFixture('prototype-csp.html', cspHtml);
      await page.goto(pathToFileURL(path.join(fixture, 'prototype-csp.html')).href);
    }
    const result = await page.evaluate(async function inspectPrototype(source) {
      const r = await VNStorySandboxLoader.loadStoryText('data:text/javascript;charset=utf-8,' + encodeURIComponent(source));
      return { status: r.status, snapshot: r.status === 'loaded' ? JSON.parse(r.value) : null, message: r.message };
    }, source);
    await page.waitForTimeout(300);
    record('sandbox-prototype', { policy, ...result, attemptedRequests: attempted.length });
    expect(result.status).toBe('loaded');
    if (policy === 'csp') expect(attempted).toEqual([]);
  }
});

// Сравнивает задержку таймера родителя при ограниченном цикле в локальном iframe и отдельном Worker.
test('iframe и Worker: отзывчивость страницы', async function({ page }) {
  await writeFixture('cpu-frame.html', '<!doctype html><body><script>parent.postMessage({ probeCpu: true, phase: "ready" }, "*"); onmessage = function() { var end = Date.now() + 600; while (Date.now() < end) {} parent.postMessage({ probeCpu: true, phase: "done" }, "*"); };</script>');
  for (const kind of ['iframe', 'worker']) {
    const result = await page.evaluate(async function measureParentTimer(kind) {
      let previous = performance.now();
      let maxGapMs = 0;
      let ticks = 0;
      // Частый таймер принадлежит родителю, поэтому фиксирует блокировку его собственного потока.
      const ticker = setInterval(function sampleTimer() { const now = performance.now(); maxGapMs = Math.max(maxGapMs, now - previous); previous = now; ticks++; }, 20);
      let status;
      try {
        if (kind === 'worker') {
          const source = 'var end = Date.now() + 600; while (Date.now() < end) {} window.STORY_TEXT = "worker-probe";';
          status = (await VNStorySandboxLoader.loadStoryText('data:text/javascript,' + encodeURIComponent(source))).status;
        } else {
          status = await new Promise(function waitForFrame(resolve) {
            const frame = document.createElement('iframe');
            let timer;
            // Ограниченный цикл в fixture всегда заканчивается, даже если таймаут родителя задержан.
            function finish(value) { clearTimeout(timer); window.removeEventListener('message', receive); frame.remove(); resolve(value); }
            function receive(event) {
              if (event.source !== frame.contentWindow || !event.data?.probeCpu) return;
              if (event.data.phase === 'ready') frame.contentWindow.postMessage('start', '*');
              else finish('loaded');
            }
            window.addEventListener('message', receive);
            frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
            frame.src = new URL('cpu-frame.html', location.href).href;
            timer = setTimeout(function timeout() { finish('timeout'); }, 3000);
            document.body.appendChild(frame);
          });
        }
        await new Promise(function settle(resolve) { setTimeout(resolve, 50); });
        return { status, maxGapMs: Math.round(maxGapMs), ticks };
      } finally { clearInterval(ticker); }
    }, kind);
    record('parent-responsiveness', { kind, ...result });
    expect(result.status).toBe('loaded');
  }
});

// Проверяет внешнее завершение зависшего Worker и отклонение поддельного сообщения без приватного порта.
test('Worker: таймаут и поддельный ответ', async function({ page }) {
  const result = await page.evaluate(async function inspectWorkerTermination() {
    const started = performance.now();
    const forged = 'self.postMessage({ status: "loaded", value: "forged" }); window.STORY_TEXT = "real";';
    const regular = await VNStorySandboxLoader.loadStoryText('data:text/javascript,' + encodeURIComponent(forged));
    const loop = await VNStorySandboxLoader.loadStoryText('data:text/javascript,' + encodeURIComponent('while (true) {}'));
    const recovered = await VNStorySandboxLoader.loadStoryText('data:text/javascript,' + encodeURIComponent('window.STORY_TEXT = "after-timeout";'));
    return { forgedResult: regular.value, loopStatus: loop.status, loopMessage: loop.message, elapsedMs: Math.round(performance.now() - started), recovered: recovered.value };
  });
  record('sandbox-termination', result);
  expect(result.forgedResult).toBe('real');
  expect(result.loopStatus).not.toBe('loaded');
  expect(result.recovered).toBe('after-timeout');
});
