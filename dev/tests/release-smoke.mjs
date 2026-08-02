import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { access, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const developerRoot = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const fixtureStoryPath = fileURLToPath(new URL('./e2e/fixtures/story-fixture.js', import.meta.url));
const reportRoot = path.join(developerRoot, '.playwright', 'release-smoke');
const optionalScriptPaths = new Set(['/license-key.js', '/story360.js']);

/**
 * Запускает системную команду без shell и добавляет её вывод в ошибку при ненулевом коде.
 */
function runProcess(command, argumentsList, additionalEnvironment = {}) {
  return new Promise(function(resolve, reject) {
    const child = spawn(command, argumentsList, {
      env: { ...process.env, ...additionalEnvironment },
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', function(chunk) {
      stdout += chunk;
    });
    child.stderr.on('data', function(chunk) {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', function(exitCode) {
      if (exitCode === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(
        `Команда распаковки завершилась с кодом ${exitCode}: ${command}\n${stderr || stdout}`
      ));
    });
  });
}

/**
 * Распаковывает ZIP штатным средством ОС, не добавляя отдельную библиотеку архивации в проект.
 */
async function extractZipArchive(archivePath, destinationPath) {
  if (process.platform === 'win32') {
    const windowsRoot = process.env.SystemRoot || 'C:\\Windows';
    const powershellPath = path.join(
      windowsRoot,
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe'
    );
    const commandSource = [
      "$ErrorActionPreference = 'Stop'",
      'Expand-Archive -LiteralPath $env:VN_RELEASE_SMOKE_ARCHIVE -DestinationPath $env:VN_RELEASE_SMOKE_DESTINATION -Force'
    ].join('; ');
    await runProcess(powershellPath, [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      commandSource
    ], {
      VN_RELEASE_SMOKE_ARCHIVE: archivePath,
      VN_RELEASE_SMOKE_DESTINATION: destinationPath
    });
    return;
  }

  await runProcess('unzip', ['-q', archivePath, '-d', destinationPath]);
}

/**
 * Находит единственный корневой каталог полного релиза и отклоняет посторонние элементы рядом с ним.
 */
async function findReleaseRoot(extractionRoot) {
  const entries = await readdir(extractionRoot, { withFileTypes: true });
  const releaseEntries = entries.filter(function(entry) {
    return entry.name !== '__MACOSX';
  });
  assert.equal(releaseEntries.length, 1, 'Полный ZIP должен содержать один корневой каталог приложения.');
  assert.equal(releaseEntries[0].isDirectory(), true, 'Корень полного ZIP должен быть каталогом.');
  return path.join(extractionRoot, releaseEntries[0].name);
}

/**
 * Возвращает MIME-тип для runtime-файлов, которые браузер может запросить при первом запуске.
 */
function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp'
  };
  return contentTypes[extension] || 'application/octet-stream';
}

/**
 * Проверяет, что URL не позволяет HTTP-серверу прочитать файл за пределами распакованного релиза.
 */
function resolveReleaseFile(releaseRoot, pathname) {
  const normalizedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(releaseRoot, `.${normalizedPath}`);
  const relativePath = path.relative(releaseRoot, filePath);
  if (
    !relativePath ||
    path.isAbsolute(relativePath) ||
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`)
  ) {
    throw new Error(`HTTP-путь выходит за распакованный релиз: ${pathname}`);
  }
  return filePath;
}

/**
 * Отправляет HTTP-ответ и не передаёт тело для HEAD-запроса.
 */
function sendResponse(request, response, statusCode, contentType, body) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': contentType
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}

/**
 * Обслуживает runtime из распакованного ZIP, подменяя только сценарий небольшим синтетическим fixture.
 */
async function handleReleaseRequest(releaseRoot, storySource, request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendResponse(request, response, 405, 'text/plain; charset=utf-8', 'Method Not Allowed');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
  } catch (error) {
    sendResponse(request, response, 400, 'text/plain; charset=utf-8', 'Bad Request');
    return;
  }

  if (pathname === '/story.js') {
    sendResponse(request, response, 200, 'text/javascript; charset=utf-8', storySource);
    return;
  }
  if (optionalScriptPaths.has(pathname)) {
    sendResponse(request, response, 200, 'text/javascript; charset=utf-8', '// optional in release smoke\n');
    return;
  }
  if (pathname === '/favicon.ico') {
    sendResponse(request, response, 204, 'image/x-icon', '');
    return;
  }

  let filePath;
  try {
    filePath = resolveReleaseFile(releaseRoot, pathname);
    const body = await readFile(filePath);
    sendResponse(request, response, 200, getContentType(filePath), body);
  } catch (error) {
    const statusCode = error && error.code === 'ENOENT' ? 404 : 403;
    sendResponse(
      request,
      response,
      statusCode,
      'text/plain; charset=utf-8',
      statusCode === 404 ? 'Not Found' : 'Forbidden'
    );
  }
}

/**
 * Запускает временный HTTP-сервер на случайном локальном порту и возвращает функцию корректной остановки.
 */
async function startReleaseServer(releaseRoot, storySource) {
  const server = createServer(function(request, response) {
    handleReleaseRequest(releaseRoot, storySource, request, response).catch(function(error) {
      sendResponse(request, response, 500, 'text/plain; charset=utf-8', error.message || 'Server Error');
    });
  });

  await new Promise(function(resolve, reject) {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object', 'Не удалось определить порт smoke-сервера.');

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: function() {
      return new Promise(function(resolve, reject) {
        server.close(function(error) {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  };
}

/**
 * Сохраняет screenshot и текст диагностики только при сбое браузерной проверки.
 */
async function saveFailureReport(page, details) {
  await mkdir(reportRoot, { recursive: true });
  if (page) {
    await page.screenshot({
      path: path.join(reportRoot, 'failure.png'),
      fullPage: true
    }).catch(function() {});
  }
  await writeFile(
    path.join(reportRoot, 'diagnostics.json'),
    `${JSON.stringify(details, null, 2)}\n`,
    'utf8'
  );
}

/**
 * Открывает распакованный runtime в Chromium и проверяет первую реплику синтетической истории.
 */
async function runBrowserSmoke(releaseRoot, baseUrl, archivePath) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  const pageErrors = [];
  const consoleErrors = [];
  const failedResponses = [];
  const externalRequests = [];

  page.on('pageerror', function(error) {
    pageErrors.push(error && error.message ? error.message : String(error));
  });
  page.on('console', function(message) {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', function(response) {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  await page.route('**/*', async function(route) {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin !== baseUrl) {
      externalRequests.push(requestUrl.href);
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function hasFirstStoryLine() {
      const textBox = document.querySelector('#textBox');
      return Boolean(textBox && textBox.textContent.trim() === 'Первый экран E2E');
    }, undefined, { timeout: 10_000 });

    assert.equal(await page.title(), 'E2E-проверка движка');
    assert.equal(await page.locator('#dialog').isVisible(), true, 'Диалог движка не отображается.');
    assert.deepEqual(pageErrors, [], 'В распакованном runtime возникли необработанные ошибки страницы.');
    assert.deepEqual(consoleErrors, [], 'В распакованном runtime возникли ошибки console.error.');
    assert.deepEqual(failedResponses, [], 'Распакованный runtime запросил отсутствующие файлы.');
    assert.deepEqual(externalRequests, [], 'Распакованный runtime попытался обратиться к внешней сети.');
  } catch (error) {
    await saveFailureReport(page, {
      archivePath,
      releaseRoot,
      pageErrors,
      consoleErrors,
      failedResponses,
      externalRequests,
      error: error && error.stack ? error.stack : String(error)
    });
    throw error;
  } finally {
    await browser.close();
  }
}

const archiveArgument = process.argv[2];

// Проверяет именно полный ZIP после распаковки; fixture заменяет пользовательский сценарий, но не runtime-файлы.
test('распакованный полный ZIP запускает движок в Chromium', { timeout: 45_000 }, async function() {
  assert.ok(
    archiveArgument,
    'Укажите путь к полному ZIP: npm run test:release:smoke -- ../имя-архива.zip'
  );
  const archivePath = path.resolve(process.cwd(), archiveArgument);
  const archiveInfo = await lstat(archivePath);
  assert.equal(archiveInfo.isFile(), true, 'Путь smoke-проверки должен указывать на ZIP-файл.');
  assert.equal(path.extname(archivePath).toLowerCase(), '.zip', 'Smoke-проверка принимает только ZIP-файл.');

  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'vn-release-smoke-'));
  const extractionRoot = path.join(temporaryRoot, 'unpacked');
  let releaseServer;
  try {
    await mkdir(extractionRoot, { recursive: true });
    await extractZipArchive(archivePath, extractionRoot);
    const releaseRoot = await findReleaseRoot(extractionRoot);
    await Promise.all([
      access(path.join(releaseRoot, 'index.html')),
      access(path.join(releaseRoot, 'engine', 'engine.css')),
      access(path.join(releaseRoot, 'engine', 'engine.js')),
      access(path.join(releaseRoot, 'engine', 'story-loader.js'))
    ]);

    const storySource = await readFile(fixtureStoryPath, 'utf8');
    releaseServer = await startReleaseServer(releaseRoot, storySource);
    await runBrowserSmoke(releaseRoot, releaseServer.baseUrl, archivePath);
  } finally {
    if (releaseServer) await releaseServer.close();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
