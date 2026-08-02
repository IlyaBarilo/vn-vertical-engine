import { copyFile, lstat, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Сохраняет прежний набор допустимых форматов для каждой части assets, меняя только способ копирования путей.
export const RELEASE_ASSET_RULES = Object.freeze({
  backgrounds: Object.freeze(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif', '.mp4', '.mov']),
  characters: Object.freeze(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif', '.mp4', '.mov']),
  audio: Object.freeze(['.mp3', '.wav', '.ogg', '.m4a', '.aac']),
  games: Object.freeze(['.html', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif', '.mp4', '.mov']),
  video: Object.freeze(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif', '.mp4', '.webm', '.mov'])
});

/**
 * Преобразует системные разделители в `/`, чтобы ключи коллизий одинаково работали на Windows и Linux.
 */
function toPortablePath(filePath) {
  return String(filePath || '').replaceAll('\\', '/');
}

/**
 * Возвращает путь внутри указанного корня и отклоняет абсолютные значения или выход через `..`.
 */
export function resolvePathInside(rootPath, relativePath) {
  const resolvedRoot = path.resolve(rootPath);
  const portableRelativePath = toPortablePath(relativePath);
  // Windows-путь остаётся абсолютным и на Linux runner, где path.isAbsolute его не распознаёт.
  const hasPortableRoot = /^[a-z]:\//i.test(portableRelativePath) || portableRelativePath.startsWith('//');
  if (!portableRelativePath || path.isAbsolute(portableRelativePath) || hasPortableRoot) {
    throw new Error(`Недопустимый относительный путь ассета: ${relativePath}`);
  }

  const resolvedPath = path.resolve(resolvedRoot, portableRelativePath);
  const rootRelativePath = path.relative(resolvedRoot, resolvedPath);
  if (
    !rootRelativePath ||
    path.isAbsolute(rootRelativePath) ||
    rootRelativePath === '..' ||
    rootRelativePath.startsWith(`..${path.sep}`)
  ) {
    throw new Error(`Путь ассета выходит за каталог сборки: ${relativePath}`);
  }
  return resolvedPath;
}

/**
 * Проверяет будущие пути архива без учёта регистра и Unicode-формы, чтобы сборка не зависела от файловой системы runner.
 */
export function assertUniqueDestinationPaths(relativePaths) {
  const seenPaths = new Map();
  relativePaths.forEach(function(relativePath) {
    const portablePath = toPortablePath(relativePath);
    const collisionKey = portablePath.normalize('NFC').toLowerCase();
    const previousPath = seenPaths.get(collisionKey);
    if (previousPath) {
      throw new Error(`Коллизия путей релизных ассетов: ${previousPath} и ${portablePath}`);
    }
    seenPaths.set(collisionKey, portablePath);
  });
}

/**
 * Рекурсивно собирает разрешённые файлы одной категории, не переходя по ссылкам и не теряя вложенные каталоги.
 */
async function collectCategoryFiles(categoryRoot, currentDirectory, categoryName, allowedExtensions, result) {
  const directoryEntries = await readdir(currentDirectory, { withFileTypes: true });
  directoryEntries.sort(function(left, right) {
    return left.name.localeCompare(right.name, 'en');
  });

  for (const directoryEntry of directoryEntries) {
    const sourcePath = path.join(currentDirectory, directoryEntry.name);
    if (directoryEntry.isSymbolicLink()) {
      throw new Error(`Символические ссылки не допускаются в релизных ассетах: ${sourcePath}`);
    }
    if (directoryEntry.isDirectory()) {
      await collectCategoryFiles(categoryRoot, sourcePath, categoryName, allowedExtensions, result);
      continue;
    }
    if (!directoryEntry.isFile()) {
      throw new Error(`Неподдерживаемый тип файла в релизных ассетах: ${sourcePath}`);
    }

    const extension = path.extname(directoryEntry.name).toLowerCase();
    if (!allowedExtensions.has(extension)) {
      result.skippedFiles += 1;
      continue;
    }

    const categoryRelativePath = path.relative(categoryRoot, sourcePath);
    const releaseRelativePath = toPortablePath(path.join(categoryName, categoryRelativePath));
    result.files.push({ sourcePath, releaseRelativePath });
  }
}

/**
 * Собирает детерминированный список разрешённых ассетов из существующих категорий sourceRoot.
 */
async function collectReleaseAssetFiles(sourceRoot) {
  const result = { files: [], skippedFiles: 0 };
  for (const [categoryName, extensions] of Object.entries(RELEASE_ASSET_RULES)) {
    const categoryRoot = path.join(sourceRoot, categoryName);
    try {
      const categoryInfo = await lstat(categoryRoot);
      if (categoryInfo.isSymbolicLink() || !categoryInfo.isDirectory()) {
        throw new Error(`Категория релизных ассетов должна быть обычным каталогом: ${categoryRoot}`);
      }
    } catch (error) {
      if (error && error.code === 'ENOENT') continue;
      throw error;
    }
    await collectCategoryFiles(categoryRoot, categoryRoot, categoryName, new Set(extensions), result);
  }
  return result;
}

/**
 * Копирует разрешённые ассеты в релизный каталог, сохраняя относительные пути и отклоняя коллизии.
 */
export async function copyReleaseAssets(options) {
  const sourceRoot = path.resolve(options && options.sourceRoot ? options.sourceRoot : '');
  const destinationRoot = path.resolve(options && options.destinationRoot ? options.destinationRoot : '');
  if (!options || !options.sourceRoot || !options.destinationRoot) {
    throw new Error('Для копирования нужны sourceRoot и destinationRoot.');
  }

  const rootsOverlap = [
    path.relative(sourceRoot, destinationRoot),
    path.relative(destinationRoot, sourceRoot)
  ].some(function(relativePath) {
    return relativePath === '' || (!path.isAbsolute(relativePath) && relativePath !== '..' && !relativePath.startsWith(`..${path.sep}`));
  });
  if (rootsOverlap) {
    throw new Error('Исходный и целевой каталоги релизных ассетов не должны быть вложены друг в друга.');
  }

  const collected = await collectReleaseAssetFiles(sourceRoot);
  assertUniqueDestinationPaths(collected.files.map(function(file) {
    return file.releaseRelativePath;
  }));

  for (const file of collected.files) {
    const destinationPath = resolvePathInside(destinationRoot, file.releaseRelativePath);
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await copyFile(file.sourcePath, destinationPath);
  }

  return {
    copiedFiles: collected.files.map(function(file) {
      return file.releaseRelativePath;
    }),
    skippedFiles: collected.skippedFiles
  };
}

/**
 * Разбирает короткий CLI-контракт, используемый release workflow без зависимости от shell-особенностей копирования.
 */
function parseCommandLine(argumentsList) {
  const options = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--source') {
      options.sourceRoot = argumentsList[index + 1];
      index += 1;
    } else if (argument === '--destination') {
      options.destinationRoot = argumentsList[index + 1];
      index += 1;
    } else {
      throw new Error(`Неизвестный параметр: ${argument}`);
    }
  }
  return options;
}

/**
 * Запускает копирование из командной строки и выводит компактный итог для журнала GitHub Actions.
 */
async function runCommandLine() {
  const options = parseCommandLine(process.argv.slice(2));
  const result = await copyReleaseAssets(options);
  console.log(`Релизные ассеты: скопировано ${result.copiedFiles.length}, пропущено по расширению ${result.skippedFiles}.`);
}

const currentFilePath = path.resolve(fileURLToPath(import.meta.url));
const invokedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (currentFilePath === invokedFilePath) {
  runCommandLine().catch(function(error) {
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
  });
}
