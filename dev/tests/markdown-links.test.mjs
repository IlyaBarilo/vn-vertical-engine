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

// Маскирует встроенный код одного абзаца; незакрытые и экранированные кавычки остаются текстом.
function maskInlineCode(text) {
  const parts = [];
  const openingPattern = /\\[\s\S]|`+/g;
  let copiedUntil = 0;
  let opening;

  while ((opening = openingPattern.exec(text)) !== null) {
    if (opening[0].startsWith('\\')) continue;
    const closingPattern = /`+/g;
    closingPattern.lastIndex = openingPattern.lastIndex;
    let closing;

    while ((closing = closingPattern.exec(text)) !== null) {
      // Внутри кода кавычки другой длины и обратная косая черта не закрывают фрагмент.
      if (closing[0].length !== opening[0].length) continue;
      const end = closingPattern.lastIndex;
      parts.push(text.slice(copiedUntil, opening.index));
      parts.push(text.slice(opening.index, end).replace(/[^\r\n]/g, ' '));
      copiedUntil = end;
      openingPattern.lastIndex = end;
      break;
    }
  }

  return parts.join('') + text.slice(copiedUntil);
}

// Скрывает ограждённые блоки и встроенный код, сохраняя позиции символов и границы абзацев.
function maskMarkdownCode(markdownText) {
  const lines = [];
  let fence = null;

  for (const line of markdownText.split(/(?<=\n)/)) {
    const content = line.replace(/\r?\n$/, '');
    if (fence) {
      const closing = /^ {0,3}(`{3,}|~{3,})[\t ]*$/.exec(content);
      if (closing && closing[1][0] === fence[0] && closing[1].length >= fence.length) {
        fence = null;
      }
      lines.push(line.replace(/[^\r\n]/g, ' '));
      continue;
    }

    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(content);
    // Обратные кавычки в описании языка не допускают открытия ограждённого блока.
    if (opening && (opening[1][0] === '~' || !opening[2].includes('`'))) {
      fence = opening[1];
      lines.push(line.replace(/[^\r\n]/g, ' '));
    } else {
      lines.push(line);
    }
  }

  // Пустая строка завершает абзац: кавычки из разных абзацев не должны скрывать ссылки.
  return lines.join('').split(/(\r?\n[\t ]*\r?\n)/).map(maskInlineCode).join('');
}

// Извлекает назначения обычных Markdown-ссылок, не включая изображения и примеры кода.
function extractMarkdownLinks(markdownText) {
  const visibleText = maskMarkdownCode(markdownText);
  const links = [];
  const linkPattern = /\[[^\]]*\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+[^)]*)?\)/g;
  let match;

  while ((match = linkPattern.exec(visibleText)) !== null) {
    if (match.index > 0 && visibleText.charAt(match.index - 1) === '!') continue;
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

// Воспроизводит ложное срабатывание на JavaScript, сохраняя ссылки по обе стороны примера.
test('извлечение ссылок пропускает JavaScript во встроенном коде', function() {
  const markdown = "[До](before.md) `self['loc' + 'ation']['re' + 'place'](...)` [После](after.md)";
  assert.deepEqual(extractMarkdownLinks(markdown), ['before.md', 'after.md']);
});

// Проверяет точную длину разделителей и перенос строки внутри одного фрагмента кода.
test('встроенный код поддерживает несколько обратных кавычек и перенос строки', function() {
  const markdown = '``[Пример](fake.md) `текст`\n[Другой](fake2.md)`` [Ссылка](real.md)';
  assert.deepEqual(extractMarkdownLinks(markdown), ['real.md']);
});

// Незакрытые и экранированные разделители не должны скрывать настоящие ссылки.
test('обычные обратные кавычки не отключают проверку ссылок', function() {
  const examples = [
    '`[Ссылка](real.md)',
    '\\`[Ссылка](real.md)\\`',
    '`начало\n\n[Ссылка](real.md) конец`',
    '``[Ссылка](real.md)`'
  ];
  for (const markdown of examples) {
    assert.deepEqual(extractMarkdownLinks(markdown), ['real.md'], markdown);
  }
});

// Закрывающая ограда должна иметь тот же символ и не быть короче открывающей.
test('ссылки внутри ограждённых блоков кода не проверяются', function() {
  for (const newline of ['\n', '\r\n']) {
    const markdown = [
      '[До](before.md)',
      '   ````js',
      '[Пример](fake.md)',
      '```',
      '[Короткая ограда](fake2.md)',
      '~~~~',
      '[Другой символ](fake3.md)',
      '`````',
      '[После](after.md)',
      '~~~text',
      '[Пример](fake4.md)',
      '~~~~',
      '[Конец](end.md)'
    ].join(newline);
    assert.deepEqual(extractMarkdownLinks(markdown), ['before.md', 'after.md', 'end.md']);
  }
});

// Незакрытый блок остаётся кодом до конца документа, но не затрагивает предыдущие ссылки.
test('незакрытая ограда скрывает только оставшийся блок кода', function() {
  const markdown = '[До](real.md)\n```js\n[Пример](fake.md)';
  assert.deepEqual(extractMarkdownLinks(markdown), ['real.md']);
});

// Маскирование кода в подписи не должно терять назначения ссылок или включать изображения.
test('настоящие ссылки сохраняют назначения и проверку отсутствующих файлов', function() {
  const markdown = '[`Код`](real.md) [Документ](<with spaces.md> "Описание") ' +
    '![Картинка](image.png) `[Пример](fake.md)` [Нет файла](missing.md)';
  const links = extractMarkdownLinks(markdown);
  assert.deepEqual(links, ['real.md', '<with spaces.md>', 'missing.md']);
  const resolved = resolveLocalLink('docs/README.md', links[2]);
  assert.deepEqual(resolved, { path: 'docs/missing.md' });
  assert.equal(trackedTargetExists(resolved.path, new Set(['docs/real.md'])), false);
});

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
