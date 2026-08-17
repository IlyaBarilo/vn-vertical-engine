import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RELEASE_MANIFEST_SCHEMA_VERSION = 1;
export const RELEASE_FORMAT_VERSIONS = Object.freeze({
  storyDsl: 1,
  story360: 1,
  panoramaCss: 1,
  gameProtocol: 2
});

const RELEASE_MANIFEST_FILE_NAME = 'release-manifest.json';
const RUNTIME_DIRECTORIES = Object.freeze(['engine', 'lib']);

/**
 * Преобразует системные разделители в канонический вид для одинакового манифеста на Windows и Linux.
 */
function toPortablePath(filePath) {
  return String(filePath || '').replaceAll('\\', '/');
}

/**
 * Проверяет обычный файл и запрещает символические ссылки внутри проверяемого runtime.
 */
async function assertRegularFile(filePath, description) {
  const fileInfo = await lstat(filePath);
  if (!fileInfo.isFile() || fileInfo.isSymbolicLink()) {
    throw new Error(`${description} должен быть обычным файлом: ${filePath}`);
  }
  return fileInfo;
}

/**
 * Проверяет каталог runtime перед рекурсивным обходом и не позволяет перейти по символической ссылке.
 */
async function assertRegularDirectory(directoryPath) {
  const directoryInfo = await lstat(directoryPath);
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) {
    throw new Error(`Каталог runtime должен быть обычным каталогом: ${directoryPath}`);
  }
}

/**
 * Рекурсивно собирает обычные файлы каталога в детерминированном порядке.
 */
async function collectDirectoryFiles(releaseRoot, currentDirectory, result) {
  const directoryEntries = await readdir(currentDirectory, { withFileTypes: true });
  directoryEntries.sort(function(left, right) {
    return left.name.localeCompare(right.name, 'en');
  });

  for (const directoryEntry of directoryEntries) {
    const entryPath = path.join(currentDirectory, directoryEntry.name);
    if (directoryEntry.isSymbolicLink()) {
      throw new Error(`Символическая ссылка запрещена в runtime релиза: ${entryPath}`);
    }
    if (directoryEntry.isDirectory()) {
      await collectDirectoryFiles(releaseRoot, entryPath, result);
      continue;
    }
    if (!directoryEntry.isFile()) {
      throw new Error(`Неподдерживаемый тип файла в runtime релиза: ${entryPath}`);
    }
    result.push(toPortablePath(path.relative(releaseRoot, entryPath)));
  }
}

/**
 * Возвращает полный сортированный набор runtime-файлов, общий для full, update и Pages.
 */
export async function collectReleaseRuntimePaths(releaseRoot) {
  const resolvedRoot = path.resolve(releaseRoot);
  await assertRegularFile(path.join(resolvedRoot, 'index.html'), 'Точка входа релиза');

  const runtimePaths = ['index.html'];
  for (const directoryName of RUNTIME_DIRECTORIES) {
    const directoryPath = path.join(resolvedRoot, directoryName);
    await assertRegularDirectory(directoryPath);
    await collectDirectoryFiles(resolvedRoot, directoryPath, runtimePaths);
  }

  runtimePaths.sort(function(left, right) {
    return left.localeCompare(right, 'en');
  });
  return runtimePaths;
}

/**
 * Вычисляет SHA-256 потоково и одновременно возвращает размер готового runtime-файла.
 */
async function calculateFileMetadata(filePath) {
  const fileInfo = await assertRegularFile(filePath, 'Runtime-файл');
  const sha256 = await new Promise(function(resolve, reject) {
    const hash = createHash('sha256');
    const input = createReadStream(filePath);
    input.on('data', function(chunk) {
      hash.update(chunk);
    });
    input.once('error', reject);
    input.once('end', function() {
      resolve(hash.digest('hex'));
    });
  });
  return { sha256, size: fileInfo.size };
}

/**
 * Принимает только явные true/false, чтобы строка "false" не считалась включённой проверкой.
 */
function normalizeBoolean(value, optionName) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error(`Параметр ${optionName} должен быть true или false.`);
}

/**
 * Нормализует метаданные сборки и отклоняет значения, непригодные для воспроизводимого JSON.
 */
function normalizeManifestOptions(options) {
  if (!options || !options.releaseRoot) {
    throw new Error('Для release-manifest нужен корневой каталог релиза.');
  }

  const engineVersion = String(options.engineVersion || '');
  if (
    !engineVersion ||
    engineVersion !== engineVersion.trim() ||
    engineVersion.length > 128 ||
    /[\u0000-\u001F\u007F]/.test(engineVersion)
  ) {
    throw new Error('Версия движка для release-manifest имеет недопустимый формат.');
  }

  const commit = String(options.commit || '').toLowerCase();
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit)) {
    throw new Error('Commit для release-manifest должен быть полным Git hash.');
  }

  return {
    releaseRoot: path.resolve(options.releaseRoot),
    engineVersion,
    commit,
    nodeTests: normalizeBoolean(options.nodeTests, 'node-tests'),
    windowsSmoke: normalizeBoolean(options.windowsSmoke, 'windows-smoke')
  };
}

/**
 * Строит манифест по уже подготовленному runtime после подстановки версии в engine.js.
 */
export async function buildReleaseManifest(options) {
  const normalized = normalizeManifestOptions(options);
  const runtimePaths = await collectReleaseRuntimePaths(normalized.releaseRoot);
  const files = {};

  for (const runtimePath of runtimePaths) {
    files[runtimePath] = await calculateFileMetadata(path.join(normalized.releaseRoot, runtimePath));
  }

  return {
    schemaVersion: RELEASE_MANIFEST_SCHEMA_VERSION,
    engineVersion: normalized.engineVersion,
    commit: normalized.commit,
    formats: { ...RELEASE_FORMAT_VERSIONS },
    verification: {
      nodeTests: normalized.nodeTests,
      windowsReleaseSmoke: normalized.windowsSmoke,
      browsers: normalized.windowsSmoke ? ['Microsoft Edge', 'Firefox'] : []
    },
    files
  };
}

/**
 * Записывает канонический release-manifest.json и не перезаписывает символическую ссылку.
 */
export async function createReleaseManifest(options) {
  const manifest = await buildReleaseManifest(options);
  const releaseRoot = path.resolve(options.releaseRoot);
  const manifestPath = path.join(releaseRoot, RELEASE_MANIFEST_FILE_NAME);

  try {
    await assertRegularFile(manifestPath, 'Существующий release-manifest.json');
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error;
  }

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { manifest, manifestPath };
}

/**
 * Повторно вычисляет ожидаемый манифест и отклоняет изменение метаданных, состава или SHA-256.
 */
export async function verifyReleaseManifest(options) {
  const releaseRoot = path.resolve(options && options.releaseRoot ? options.releaseRoot : '');
  const manifestPath = path.join(releaseRoot, RELEASE_MANIFEST_FILE_NAME);
  await assertRegularFile(manifestPath, 'Release-manifest');

  let actualManifest;
  try {
    actualManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Не удалось разобрать release-manifest.json: ${error && error.message ? error.message : error}`);
  }

  const expectedManifest = await buildReleaseManifest(options);
  if (JSON.stringify(actualManifest) !== JSON.stringify(expectedManifest)) {
    throw new Error('release-manifest.json не соответствует готовому runtime или параметрам сборки.');
  }
  return actualManifest;
}

/**
 * Разбирает CLI без позиционных неоднозначностей и требует полный набор параметров сборки.
 */
function parseCommandLine(argumentsList) {
  const [mode, ...optionArguments] = argumentsList;
  if (mode !== 'create' && mode !== 'verify') {
    throw new Error('Первым параметром release-manifest укажите create или verify.');
  }

  const options = {};
  for (let index = 0; index < optionArguments.length; index += 1) {
    const argument = optionArguments[index];
    const value = optionArguments[index + 1];
    if (!value) throw new Error(`Для параметра ${argument} отсутствует значение.`);

    if (argument === '--root') options.releaseRoot = value;
    else if (argument === '--version') options.engineVersion = value;
    else if (argument === '--commit') options.commit = value;
    else if (argument === '--node-tests') options.nodeTests = value;
    else if (argument === '--windows-smoke') options.windowsSmoke = value;
    else throw new Error(`Неизвестный параметр release-manifest: ${argument}`);
    index += 1;
  }
  return { mode, options };
}

/**
 * Выполняет создание или повторную проверку и выводит краткий результат для GitHub Actions.
 */
async function runCommandLine() {
  const command = parseCommandLine(process.argv.slice(2));
  const result = command.mode === 'create'
    ? (await createReleaseManifest(command.options)).manifest
    : await verifyReleaseManifest(command.options);
  console.log(`Release manifest: ${command.mode === 'create' ? 'создан' : 'проверен'}, файлов — ${Object.keys(result.files).length}.`);
}

const currentFilePath = path.resolve(fileURLToPath(import.meta.url));
const invokedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (currentFilePath === invokedFilePath) {
  runCommandLine().catch(function(error) {
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
  });
}
