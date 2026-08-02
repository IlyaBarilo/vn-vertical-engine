import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Проверяет, что путь указывает на обычный файл, а не на каталог или символическую ссылку.
 */
async function assertRegularFile(filePath, description) {
  const fileInfo = await lstat(filePath);
  if (!fileInfo.isFile() || fileInfo.isSymbolicLink()) {
    throw new Error(`${description} должен быть обычным файлом: ${filePath}`);
  }
}

/**
 * Вычисляет SHA-256 потоково, чтобы размер релизного ZIP не влиял на потребление памяти.
 */
export async function calculateSha256(filePath) {
  const resolvedPath = path.resolve(filePath);
  await assertRegularFile(resolvedPath, 'Архив');

  return new Promise(function(resolve, reject) {
    const hash = createHash('sha256');
    const input = createReadStream(resolvedPath);
    input.on('data', function(chunk) {
      hash.update(chunk);
    });
    input.once('error', reject);
    input.once('end', function() {
      resolve(hash.digest('hex'));
    });
  });
}

/**
 * Создаёт рядом с каждым архивом стандартный файл `<архив>.sha256` с хешем и именем ZIP.
 */
export async function createChecksumFiles(archivePaths) {
  if (!Array.isArray(archivePaths) || archivePaths.length === 0) {
    throw new Error('Укажите хотя бы один архив для создания SHA-256.');
  }

  const createdFiles = [];
  for (const archivePath of archivePaths) {
    const resolvedArchivePath = path.resolve(archivePath);
    const checksum = await calculateSha256(resolvedArchivePath);
    const checksumPath = `${resolvedArchivePath}.sha256`;
    await writeFile(checksumPath, `${checksum}  ${path.basename(resolvedArchivePath)}\n`, 'utf8');
    createdFiles.push(checksumPath);
  }
  return createdFiles;
}

/**
 * Разбирает одну стандартную строку SHA-256 и запрещает ссылаться из неё на соседние каталоги.
 */
function parseChecksumSource(checksumSource, checksumPath) {
  const match = String(checksumSource).match(/^([a-f0-9]{64})  ([^\r\n]+)\r?\n?$/i);
  if (!match) {
    throw new Error(`Некорректный формат файла SHA-256: ${checksumPath}`);
  }

  const archiveName = match[2];
  if (
    archiveName === '.' ||
    archiveName === '..' ||
    archiveName.includes('/') ||
    archiveName.includes('\\') ||
    path.basename(archiveName) !== archiveName
  ) {
    throw new Error(`Файл SHA-256 содержит небезопасное имя архива: ${archiveName}`);
  }
  return { expectedChecksum: match[1].toLowerCase(), archiveName };
}

/**
 * Проверяет каждый `.sha256` против соседнего ZIP и останавливает сборку при несовпадении.
 */
export async function verifyChecksumFiles(checksumPaths) {
  if (!Array.isArray(checksumPaths) || checksumPaths.length === 0) {
    throw new Error('Укажите хотя бы один файл SHA-256 для проверки.');
  }

  const verifiedFiles = [];
  for (const checksumPath of checksumPaths) {
    const resolvedChecksumPath = path.resolve(checksumPath);
    await assertRegularFile(resolvedChecksumPath, 'Файл SHA-256');
    const checksumSource = await readFile(resolvedChecksumPath, 'utf8');
    const parsed = parseChecksumSource(checksumSource, resolvedChecksumPath);
    const archivePath = path.join(path.dirname(resolvedChecksumPath), parsed.archiveName);
    const actualChecksum = await calculateSha256(archivePath);
    if (actualChecksum !== parsed.expectedChecksum) {
      throw new Error(`SHA-256 не совпадает для архива: ${archivePath}`);
    }
    verifiedFiles.push(archivePath);
  }
  return verifiedFiles;
}

/**
 * Разбирает режим create/verify и список файлов для компактного вызова из release workflow.
 */
function parseCommandLine(argumentsList) {
  const [mode, ...filePaths] = argumentsList;
  if (mode !== 'create' && mode !== 'verify') {
    throw new Error('Первым параметром укажите режим create или verify.');
  }
  if (filePaths.length === 0) {
    throw new Error(`Для режима ${mode} не указаны файлы.`);
  }
  return { mode, filePaths };
}

/**
 * Выполняет выбранную операцию и печатает краткий результат в журнал GitHub Actions.
 */
async function runCommandLine() {
  const options = parseCommandLine(process.argv.slice(2));
  const processedFiles = options.mode === 'create'
    ? await createChecksumFiles(options.filePaths)
    : await verifyChecksumFiles(options.filePaths);
  const operation = options.mode === 'create' ? 'создано' : 'проверено';
  console.log(`SHA-256: ${operation} файлов — ${processedFiles.length}.`);
}

const currentFilePath = path.resolve(fileURLToPath(import.meta.url));
const invokedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (currentFilePath === invokedFilePath) {
  runCommandLine().catch(function(error) {
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
  });
}
