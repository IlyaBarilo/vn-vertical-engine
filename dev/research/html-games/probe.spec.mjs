/* global window, document, VN_GAME_HOST, VN_GAME_PROTOCOL */
import { test, expect } from '@playwright/test';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadStudentAuditorCore } from '../../tests/helpers/load-student-auditor-core.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = path.join(root, 'dev/.playwright/html-game-research');
const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; worker-src 'none'; manifest-src 'none'; base-uri 'none'; form-action 'none'";
let fixture;
let report;

// Создаёт только временные текстовые файлы в отдельном каталоге исследования.
async function writeFixture(name, source) {
  await writeFile(path.join(fixture, name), source.replace(/\r?\n/g, '\r\n'), 'utf8');
}

// Записывает измерение отдельно от утверждений о гарантированной безопасности.
function record(name, result) {
  report.cases.push({ case: name, ...result });
  console.log(JSON.stringify({ case: name, ...result }));
}

// Оборачивает синтетический встроенный JS в профиль автономной игры.
function gameHtml(source, withCsp = true) {
  return '<!doctype html><head><meta charset="utf-8">' + (withCsp ? '<meta http-equiv="Content-Security-Policy" content="' + csp + '">' : '') + '<meta name="vn-game-protocol" content="2"></head><body><script>' + source + '</script>';
}

// Реальные game host и протокол копируются без изменения исходного runtime.
test.beforeAll(async function prepare({ browser }, testInfo) {
  await mkdir(output, { recursive: true });
  fixture = await mkdtemp(path.join(output, 'fixture-'));
  report = { project: testInfo.project.name, version: browser.version(), protocol: 'file:', cases: [] };
  await copyFile(path.join(root, 'engine/game-host.js'), path.join(fixture, 'host.js'));
  await copyFile(path.join(root, 'engine/game-protocol.js'), path.join(fixture, 'protocol.js'));
  const body = '<body><div id="modal" class="hidden"><iframe id="game"></iframe></div><script src="protocol.js"></script><script src="host.js"></script>';
  await writeFixture('index.html', '<!doctype html><meta charset="utf-8">' + body);
  await writeFixture('parent-csp.html', '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="frame-src file: blob: data:">' + body);
});

// Сохраняет отчёт и удаляет исключительно созданный этой проверкой каталог.
test.afterAll(async function cleanup() {
  // Метка целевого прогона не позволяет затереть результаты остальных опытов.
  const label = (process.env.VN_RESEARCH_RUN_LABEL || '').replace(/[^a-z0-9-]/gi, '');
  if (report) await writeFile(path.join(output, report.project + (label ? '-' + label : '') + '.json'), JSON.stringify(report, null, 2).replace(/\n/g, '\r\n') + '\r\n');
  if (fixture && path.dirname(fixture) === output && path.basename(fixture).startsWith('fixture-')) await rm(fixture, { recursive: true, force: true });
});

// Создаёт настоящую игровую сессию, считая повторные gameInit и принятые результаты.
async function openHost(page, game, params = {}, parentCsp = false) {
  await page.goto(pathToFileURL(path.join(fixture, parentCsp ? 'parent-csp.html' : 'index.html')).href);
  await page.evaluate(function startGame({ game, params }) {
    window.probe = { messages: [], inits: 0, results: [] };
    const frame = document.querySelector('#game');
    // Диагностика тоже принимает данные только из исследуемого iframe.
    window.addEventListener('message', function inspectMessage(event) {
      if (event.source === frame.contentWindow && event.data?.probe) window.probe.messages.push(event.data);
    });
    window.host = VN_GAME_HOST.createGameHost({
      eventTarget: window,
      protocol: VN_GAME_PROTOCOL,
      frames: { story: { frame, modal: document.querySelector('#modal') } },
      // Счётчики не влияют на служебный протокол или принятие результата.
      onInitSent: function countInit() { window.probe.inits++; },
      onResult: function captureResult(event) { window.probe.results.push(event.data.result); }
    });
    window.host.open({ frameKind: 'story', gameId: 'synthetic-game', src: game, params });
  }, { game, params });
}

// Проверяет фактические запросы игры с CSP и без него; сеть заменена локальными ответами Playwright.
test('CSP игры и изоляция DOM', async function({ page, context }) {
  const requests = [];
  await context.route('https://vn-game-probe.invalid/**', async function intercept(route) {
    requests.push(route.request().resourceType());
    await route.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: 'export const probe = true;' });
  });
  const source = `// Проверяет DOM родителя и два независимых вида сетевой загрузки.
    onmessage = function(event) {
      if (event.source !== parent || event.data.type !== 'gameInit') return;
      var parentAccess = false;
      try { parent.document.body.dataset.gameEscape = 'yes'; parentAccess = true; } catch (error) { /* Ожидаемый отказ sandbox. */ }
      fetch('https://vn-game-probe.invalid/fetch').catch(function() { /* Отказ фиксируется числом запросов. */ });
      import('https://vn-game-probe.invalid/module.mjs').catch(function() { /* Отказ фиксируется числом запросов. */ });
      parent.postMessage({ probe: true, parentAccess: parentAccess }, '*');
    };`;
  for (const withCsp of [false, true]) {
    requests.length = 0;
    await writeFixture('network.html', gameHtml(source, withCsp));
    await openHost(page, 'network.html');
    await expect.poll(async function waitForProbe() { return page.evaluate(function countMessages() { return window.probe.messages.length; }); }).toBe(1);
    await page.waitForTimeout(250);
    const result = await page.evaluate(function readProbe() { return window.probe.messages[0]; });
    record('game-network', { withCsp, ...result, requests: [...requests] });
    expect(result.parentAccess).toBe(false);
    if (withCsp) expect(requests).toEqual([]);
  }
});

// Исследует собственную навигацию игры: исходный CSP и WindowProxy могут переживать её по-разному.
test('собственная навигация iframe и повторный gameInit', async function({ page, context }) {
  const requests = [];
  // Новый документ служит только локальным получателем синтетического gameInit, внешнего сервера нет.
  const remoteHtml = gameHtml(`onmessage = function(event) {
    if (event.source !== parent || event.data.type !== 'gameInit') return;
    var data = event.data;
    parent.postMessage({ probe: true, destinationInit: true, marker: data.marker }, '*');
    parent.postMessage({ type: 'gameResult', protocolVersion: data.protocolVersion, gameId: data.gameId, sessionId: data.sessionId, result: 777 }, '*');
  };`, false);
  await context.route('https://vn-game-probe.invalid/**', async function intercept(route) {
    requests.push(route.request().resourceType());
    await route.fulfill({ status: 200, contentType: 'text/html', body: remoteHtml });
  });
  const encodedTarget = Buffer.from('https://vn-game-probe.invalid/destination?probe=synthetic').toString('base64');
  const source = `// Эквивалент location.replace проверяет предел текстового аудитора без динамического выполнения кода.
    onmessage = function(event) {
      if (event.source !== parent || event.data.type !== 'gameInit') return;
      var data = event.data;
      parent.postMessage({ probe: true, originalInit: true, protocolVersion: data.protocolVersion, gameId: data.gameId, sessionId: data.sessionId, type: 'gameResult' }, '*');
      self['loc' + 'ation']['re' + 'place'](atob('${encodedTarget}'));
    };`;
  // Маркер не должен завершить настоящую игровую сессию до навигации.
  const html = gameHtml(source.replace("type: 'gameResult'", "protocolExample: 'gameResult'"));
  await writeFixture('navigation.html', html);
  const { core } = await loadStudentAuditorCore();
  record('auditor-navigation', { issues: Array.from(core.inspectMiniGameSource('assets/games/navigation.html', html)).map(function issueCode(issue) { return issue.code; }) });
  for (const parentCsp of [false, true]) {
    requests.length = 0;
    await openHost(page, 'navigation.html', { marker: 'synthetic-only' }, parentCsp);
    await expect.poll(async function waitForProbe() { return page.evaluate(function countMessages() { return window.probe.messages.length; }); }).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    const result = await page.evaluate(function readProbe() { return window.probe; });
    record('game-navigation', { parentCsp, ...result, requests: [...requests] });
    expect(page.url()).toContain('file:');
  }
});

// Ограниченный цикл показывает, может ли таймер родителя прервать зависшую строгую HTML-игру.
test('строгий iframe и отзывчивость родителя', async function({ page }) {
  await writeFixture('cpu.html', gameHtml(`onmessage = function(event) {
    if (event.source !== parent || event.data.type !== 'gameInit') return;
    var end = Date.now() + 600; while (Date.now() < end) {}
    parent.postMessage({ probe: true, done: true }, '*');
  };`));
  await page.goto(pathToFileURL(path.join(fixture, 'index.html')).href);
  const result = await page.evaluate(async function measureCpu() {
    const frame = document.querySelector('#game');
    VN_GAME_HOST.applyGameFrameSecurity(frame);
    return new Promise(function waitForCpu(resolve) {
      let previous = performance.now();
      let maxGapMs = 0;
      // Таймер находится в родителе и измеряет задержку его потока, а не потока игры.
      const timer = setInterval(function sample() { const now = performance.now(); maxGapMs = Math.max(maxGapMs, now - previous); previous = now; }, 20);
      function finish(event) {
        if (event.source !== frame.contentWindow || !event.data?.done) return;
        setTimeout(function settle() { clearInterval(timer); window.removeEventListener('message', finish); frame.src = 'about:blank'; resolve({ maxGapMs: Math.round(maxGapMs) }); }, 50);
      }
      window.addEventListener('message', finish);
      frame.onload = function startCpu() { frame.contentWindow.postMessage({ type: 'gameInit' }, '*'); };
      frame.src = 'cpu.html';
    });
  });
  record('game-cpu', result);
});
