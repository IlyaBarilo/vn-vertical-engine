import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertUniqueDestinationPaths,
  copyReleaseAssets,
  resolvePathInside
} from '../scripts/copy-release-assets.mjs';

/**
 * Создаёт изолированную временную папку и гарантирует её удаление после завершения теста.
 */
async function createTemporaryWorkspace(testContext) {
  const workspace = await mkdtemp(path.join(tmpdir(), 'vn-release-assets-'));
  testContext.after(async function() {
    await rm(workspace, { recursive: true, force: true });
  });
  return workspace;
}

/**
 * Записывает небольшой синтетический ассет, создавая его вложенные каталоги.
 */
async function writeFixtureFile(rootPath, relativePath, content) {
  const filePath = path.join(rootPath, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

/**
 * Возвращает false только для отсутствующего пути, не скрывая остальные ошибки файловой системы.
 */
async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
}

// Подтверждает, что одинаковые имена из разных вложенных папок не заменяют друг друга в релизе.
test('релизные ассеты сохраняют вложенную структуру каталогов', async function(testContext) {
  const workspace = await createTemporaryWorkspace(testContext);
  const sourceRoot = path.join(workspace, 'assets');
  const destinationRoot = path.join(workspace, 'release-assets');

  await writeFixtureFile(sourceRoot, 'backgrounds/day/hall.jpg', 'day');
  await writeFixtureFile(sourceRoot, 'backgrounds/night/hall.JPG', 'night');
  await writeFixtureFile(sourceRoot, 'audio/music/theme.ogg', 'audio');
  await writeFixtureFile(sourceRoot, 'backgrounds/day/readme.txt', 'skip');
  await writeFixtureFile(sourceRoot, '360/hall/hall-360.css', 'panorama');
  await writeFixtureFile(sourceRoot, '360/hall/hall.jpg', 'preview');
  await writeFixtureFile(sourceRoot, '360/hall/hall-360.js', 'legacy');
  await writeFixtureFile(sourceRoot, '360/hall/unrelated.css', 'skip');

  const result = await copyReleaseAssets({ sourceRoot, destinationRoot });

  assert.deepEqual(result.copiedFiles, [
    '360/hall/hall-360.css',
    '360/hall/hall.jpg',
    'backgrounds/day/hall.jpg',
    'backgrounds/night/hall.JPG',
    'audio/music/theme.ogg'
  ]);
  assert.equal(result.skippedFiles, 3);
  assert.equal(await readFile(path.join(destinationRoot, 'backgrounds/day/hall.jpg'), 'utf8'), 'day');
  assert.equal(await readFile(path.join(destinationRoot, 'backgrounds/night/hall.JPG'), 'utf8'), 'night');
  assert.equal(await readFile(path.join(destinationRoot, 'audio/music/theme.ogg'), 'utf8'), 'audio');
  assert.equal(await readFile(path.join(destinationRoot, '360/hall/hall-360.css'), 'utf8'), 'panorama');
  assert.equal(await readFile(path.join(destinationRoot, '360/hall/hall.jpg'), 'utf8'), 'preview');
  assert.equal(await pathExists(path.join(destinationRoot, 'backgrounds/hall.jpg')), false);
  assert.equal(await pathExists(path.join(destinationRoot, 'backgrounds/day/readme.txt')), false);
  assert.equal(await pathExists(path.join(destinationRoot, '360/hall/hall-360.js')), false);
  assert.equal(await pathExists(path.join(destinationRoot, '360/hall/unrelated.css')), false);
});

// Имитирует case-sensitive репозиторий и не позволяет получить неоднозначный ZIP для Windows.
test('релизная сборка отклоняет коллизии путей без учёта регистра', function() {
  assert.throws(
    function() {
      assertUniqueDestinationPaths([
        'backgrounds/Day/Hall.jpg',
        'backgrounds/day/hall.JPG'
      ]);
    },
    /Коллизия путей релизных ассетов/
  );
});

// Проверяет защиту целевого каталога независимо от платформы, на которой выполняется workflow.
test('релизная сборка отклоняет выход за целевой каталог', function() {
  assert.throws(
    function() {
      resolvePathInside(path.join('build', 'assets'), '../engine/engine.js');
    },
    /выходит за каталог сборки/
  );
  assert.throws(
    function() {
      resolvePathInside(path.join('build', 'assets'), 'C:/Windows/system.ini');
    },
    /Недопустимый относительный путь ассета/
  );
});
