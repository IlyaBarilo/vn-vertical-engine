import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createChecksumFiles,
  verifyChecksumFiles
} from '../scripts/release-checksums.mjs';

/**
 * Создаёт временный каталог SHA-256 fixtures и удаляет его после выполнения теста.
 */
async function createTemporaryWorkspace(testContext) {
  const workspace = await mkdtemp(path.join(tmpdir(), 'vn-release-checksums-'));
  testContext.after(async function() {
    await rm(workspace, { recursive: true, force: true });
  });
  return workspace;
}

/**
 * Вычисляет ожидаемое значение небольшого fixture независимо от проверяемого helper.
 */
function calculateFixtureChecksum(content) {
  return createHash('sha256').update(content).digest('hex');
}

// Проверяет стандартный формат, имена с пробелами и успешную сверку двух релизных архивов.
test('релизные SHA-256 создаются и проходят проверку', async function(testContext) {
  const workspace = await createTemporaryWorkspace(testContext);
  const fullArchivePath = path.join(workspace, 'engine test.zip');
  const updateArchivePath = path.join(workspace, 'engine test-update.zip');
  await writeFile(fullArchivePath, 'full archive', 'utf8');
  await writeFile(updateArchivePath, 'update archive', 'utf8');

  const checksumPaths = await createChecksumFiles([fullArchivePath, updateArchivePath]);

  assert.deepEqual(checksumPaths, [
    `${fullArchivePath}.sha256`,
    `${updateArchivePath}.sha256`
  ]);
  assert.equal(
    await readFile(checksumPaths[0], 'utf8'),
    `${calculateFixtureChecksum('full archive')}  engine test.zip\n`
  );
  assert.equal(
    await readFile(checksumPaths[1], 'utf8'),
    `${calculateFixtureChecksum('update archive')}  engine test-update.zip\n`
  );
  assert.deepEqual(
    await verifyChecksumFiles(checksumPaths),
    [fullArchivePath, updateArchivePath]
  );
});

// Подтверждает, что изменение ZIP после создания контрольной суммы останавливает проверку.
test('изменённый архив не проходит SHA-256', async function(testContext) {
  const workspace = await createTemporaryWorkspace(testContext);
  const archivePath = path.join(workspace, 'engine.zip');
  await writeFile(archivePath, 'original archive', 'utf8');
  const [checksumPath] = await createChecksumFiles([archivePath]);
  await writeFile(archivePath, 'modified archive', 'utf8');

  await assert.rejects(
    verifyChecksumFiles([checksumPath]),
    /SHA-256 не совпадает/
  );
});

// Не позволяет подменённому checksum-файлу направить проверку за пределы каталога релиза.
test('SHA-256 отклоняет небезопасное имя архива', async function(testContext) {
  const workspace = await createTemporaryWorkspace(testContext);
  const checksumPath = path.join(workspace, 'engine.zip.sha256');
  await writeFile(checksumPath, `${'0'.repeat(64)}  ../outside.zip\n`, 'utf8');

  await assert.rejects(
    verifyChecksumFiles([checksumPath]),
    /небезопасное имя архива/
  );
});
