import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.dirname(fileURLToPath(new URL('../../index.html', import.meta.url)));
const manifestPath = path.join(repositoryRoot, 'dev', 'dependencies.json');
const noticePath = path.join(repositoryRoot, 'NOTICE.md');
const releaseWorkflowPath = path.join(repositoryRoot, '.github', 'workflows', 'release.yml');

// Читает и проверяет общий формат manifest до проверок отдельных библиотек.
async function readDependencyManifest() {
  const source = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(source);
  assert.equal(manifest.schemaVersion, 1);
  assert.ok(Array.isArray(manifest.libraries));
  assert.ok(manifest.libraries.length > 0);
  return manifest;
}

// Вычисляет SHA-256 по исходным байтам, чтобы изменение minified-файла нельзя было скрыть перекодировкой текста.
function calculateSha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

// Фиксирует полный набор сторонних JavaScript-файлов, поставляемых runtime и релизным ZIP.
test('manifest перечисляет все bundled-библиотеки', async function() {
  const manifest = await readDependencyManifest();
  const files = manifest.libraries.map(function(library) {
    return library.file;
  }).sort();

  assert.deepEqual(files, [
    'lib/jsrsasign-all-min.js',
    'lib/mermaid.min.js',
    'lib/three.min.js'
  ]);
});

// Проверяет путь, размер и hash каждой библиотеки по фактическим байтам репозитория.
test('bundled-библиотеки соответствуют manifest', async function() {
  const manifest = await readDependencyManifest();
  const names = new Set();
  const files = new Set();

  for (const library of manifest.libraries) {
    assert.match(library.name, /\S/);
    assert.match(library.version, /\S/);
    assert.match(library.file, /^lib\/[A-Za-z0-9._-]+\.js$/);
    assert.match(library.sha256, /^[a-f0-9]{64}$/);
    assert.equal(library.license, 'MIT');
    assert.match(library.upstream, /^https:\/\/github\.com\//);
    assert.ok(Array.isArray(library.usedBy) && library.usedBy.length > 0);
    assert.equal(names.has(library.name), false, 'Повтор имени библиотеки: ' + library.name);
    assert.equal(files.has(library.file), false, 'Повтор пути библиотеки: ' + library.file);
    names.add(library.name);
    files.add(library.file);

    const bytes = await readFile(path.join(repositoryRoot, library.file));
    assert.equal(bytes.byteLength, library.bytes, 'Изменился размер ' + library.file);
    assert.equal(calculateSha256(bytes), library.sha256, 'Изменился SHA-256 ' + library.file);
  }
});

// Подтверждает, что каждый заявленный потребитель действительно ссылается на файл библиотеки.
test('manifest связывает библиотеки с runtime и релизной сборкой', async function() {
  const manifest = await readDependencyManifest();
  const releaseSource = await readFile(releaseWorkflowPath, 'utf8');

  for (const library of manifest.libraries) {
    assert.ok(releaseSource.includes(library.file), 'Release workflow не содержит ' + library.file);
    for (const consumerPath of library.usedBy) {
      const consumerSource = await readFile(path.join(repositoryRoot, consumerPath), 'utf8');
      const expectedReference = consumerPath.startsWith('tools/')
        ? '../' + library.file
        : library.file;
      assert.ok(
        consumerSource.includes(expectedReference),
        consumerPath + ' не содержит ссылку ' + expectedReference
      );
    }
  }
});

// Сверяет точные версии с поставляемыми файлами и публичным third-party notice.
test('версии bundled-библиотек подтверждены файлами и NOTICE', async function() {
  const manifest = await readDependencyManifest();
  const noticeSource = await readFile(noticePath, 'utf8');
  const versionEvidence = {
    jsrsasign: 'jsrsasign(all) 11.1.0',
    mermaid: 'version:"11.13.0"',
    'three.js': 'const e="152"'
  };

  for (const library of manifest.libraries) {
    const librarySource = await readFile(path.join(repositoryRoot, library.file), 'utf8');
    assert.ok(librarySource.includes(versionEvidence[library.name]), 'Не подтверждена версия ' + library.name);
    assert.ok(noticeSource.includes(library.version), 'NOTICE не содержит версию ' + library.version);
  }
});
