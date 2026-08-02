import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { getRepositoryRoot } from './helpers/run-story-loader.mjs';

// Получает существующие отслеживаемые Git-файлы, учитывая переносы до выполнения пользователем git add.
function listTrackedFiles(repositoryRoot) {
  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd: repositoryRoot,
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error('Не удалось получить список файлов Git: ' + String(result.stderr || '').trim());
  }

  const trackedFiles = result.stdout.split('\0').filter(Boolean);
  // Исключает старые пути перемещённых файлов, которых уже нет в рабочем дереве.
  return trackedFiles.filter(function(filePath) {
    return existsSync(path.join(repositoryRoot, filePath));
  });
}

// Извлекает назначения обычных Markdown-ссылок, не включая изображения.
function extractMarkdownLinks(markdownText) {
  const links = [];
  const linkPattern = /\[[^\]]*\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+[^)]*)?\)/g;
  let match;

  while ((match = linkPattern.exec(markdownText)) !== null) {
    if (match.index > 0 && markdownText.charAt(match.index - 1) === '!') continue;
    links.push(match[1]);
  }

  return links;
}

// Преобразует локальную Markdown-ссылку в путь Git или возвращает null для внешних адресов и якорей.
function resolveLocalLink(sourceFile, rawTarget) {
  let target = String(rawTarget || '').trim();
  if (target.startsWith('<') && target.endsWith('>')) {
    target = target.slice(1, -1);
  }

  if (!target || target.startsWith('#') || target.startsWith('/')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return null;

  target = target.split('#')[0].split('?')[0];
  if (!target) return null;

  try {
    target = decodeURIComponent(target);
  } catch (error) {
    return { error: 'некорректное URL-кодирование: ' + target };
  }

  const normalized = path.posix.normalize(
    path.posix.join(path.posix.dirname(sourceFile), target.replace(/\\/g, '/'))
  );
  if (normalized === '..' || normalized.startsWith('../')) {
    return { error: 'ссылка выходит за пределы репозитория: ' + target };
  }

  return { path: normalized };
}

// Проверяет как отдельный файл, так и каталог, содержащий отслеживаемые файлы.
function trackedTargetExists(targetPath, trackedFiles) {
  if (trackedFiles.has(targetPath)) return true;
  const directoryPrefix = targetPath.replace(/\/$/, '') + '/';
  return Array.from(trackedFiles).some(function(filePath) {
    return filePath.startsWith(directoryPrefix);
  });
}

// Проверяет точное имя каждого сегмента пути, чтобы новые ещё не отслеживаемые файлы тоже учитывались локально.
function workspaceTargetExistsWithExactCase(repositoryRoot, targetPath) {
  const segments = targetPath.split('/').filter(Boolean);
  let currentPath = repositoryRoot;

  for (const segment of segments) {
    let names;
    try {
      names = readdirSync(currentPath);
    } catch (error) {
      return false;
    }
    if (!names.includes(segment)) return false;
    currentPath = path.join(currentPath, segment);
  }

  return true;
}

// Обходит документацию как пользователь и ловит отсутствующие относительные ссылки до публикации.
test('относительные ссылки в отслеживаемой Markdown-документации существуют', function() {
  const repositoryRoot = getRepositoryRoot();
  const trackedList = listTrackedFiles(repositoryRoot);
  const trackedFiles = new Set(trackedList);
  const trackedByLowerCase = new Map(trackedList.map(function(filePath) {
    return [filePath.toLowerCase(), filePath];
  }));
  const markdownFiles = trackedList.filter(function(filePath) {
    return filePath.toLowerCase().endsWith('.md');
  });
  const problems = [];

  markdownFiles.forEach(function(markdownFile) {
    const markdownText = readFileSync(path.join(repositoryRoot, markdownFile), 'utf8');
    extractMarkdownLinks(markdownText).forEach(function(rawTarget) {
      const resolved = resolveLocalLink(markdownFile, rawTarget);
      if (!resolved) return;
      if (resolved.error) {
        problems.push(markdownFile + ': ' + resolved.error);
        return;
      }
      if (trackedTargetExists(resolved.path, trackedFiles)) return;
      if (workspaceTargetExistsWithExactCase(repositoryRoot, resolved.path)) return;

      const samePathWithOtherCase = trackedByLowerCase.get(resolved.path.toLowerCase());
      if (samePathWithOtherCase) {
        problems.push(markdownFile + ': регистр ссылки ' + resolved.path +
          ' не совпадает с ' + samePathWithOtherCase);
      } else {
        problems.push(markdownFile + ': отсутствует ' + resolved.path);
      }
    });
  });

  assert.deepEqual(problems, [], problems.join('\n'));
});
