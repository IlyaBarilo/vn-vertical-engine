import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.dirname(fileURLToPath(new URL('../../index.html', import.meta.url)));
const categoryForms = new Map([
  ['идеи', '.github/DISCUSSION_TEMPLATE/идеи.yml'],
  ['помощь', '.github/DISCUSSION_TEMPLATE/помощь.yml'],
  ['проекты', '.github/DISCUSSION_TEMPLATE/проекты.yml']
]);

// Читает публичный файл сообщества относительно корня репозитория.
function readRepositoryFile(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

// Извлекает идентификаторы полей формы для проверки их наличия и уникальности.
function extractFieldIds(formSource) {
  const fieldIds = [];
  const idPattern = /^\s+id:\s*([a-z0-9_-]+)\s*$/gim;
  let match;

  while ((match = idPattern.exec(formSource)) !== null) {
    fieldIds.push(match[1]);
  }
  return fieldIds;
}

// Проверяет формы для всех существующих slug категорий GitHub Discussions.
test('формы Discussions соответствуют существующим категориям', async function() {
  for (const [categorySlug, relativePath] of categoryForms) {
    const formSource = await readRepositoryFile(relativePath);
    const fieldIds = extractFieldIds(formSource);

    assert.match(formSource, /^title:\s*"[^"\r\n]+"\s*$/m, categorySlug + ': отсутствует title');
    assert.match(formSource, /^body:\s*$/m, categorySlug + ': отсутствует body');
    assert.match(
      formSource,
      /^\s+- type:\s*(input|textarea|dropdown|checkboxes)\s*$/m,
      categorySlug + ': нет интерактивных полей'
    );
    assert.ok(fieldIds.length > 0, categorySlug + ': поля не имеют id');
    assert.equal(new Set(fieldIds).size, fieldIds.length, categorySlug + ': повторяются id полей');
    assert.match(formSource, /^\s+required:\s*true\s*$/m, categorySlug + ': нет обязательных полей');
  }
});

// Защищает формы от автоматических labels, которых может не быть в настройках репозитория.
test('формы Discussions не зависят от GitHub labels', async function() {
  for (const relativePath of categoryForms.values()) {
    const formSource = await readRepositoryFile(relativePath);
    assert.doesNotMatch(formSource, /^labels:/m);
  }
});

// Проверяет прямую навигацию из обоих README к каждой категории обратной связи.
test('README ведут к вопросам, идеям и showcase', async function() {
  const readmeSources = await Promise.all([
    readRepositoryFile('README.md'),
    readRepositoryFile('README-EN.md')
  ]);

  for (const readmeSource of readmeSources) {
    for (const categorySlug of categoryForms.keys()) {
      assert.ok(
        readmeSource.includes('/discussions/categories/' + categorySlug),
        'README не содержит ссылку на категорию ' + categorySlug
      );
    }
  }
});

// Напоминает авторам не передавать секреты и подтверждать права на showcase-материалы.
test('формы содержат предупреждения о публичности данных', async function() {
  const questionSource = await readRepositoryFile(categoryForms.get('помощь'));
  const showcaseSource = await readRepositoryFile(categoryForms.get('проекты'));

  assert.ok(questionSource.includes('license-key.js'));
  assert.ok(questionSource.includes('required: true'));
  assert.ok(showcaseSource.includes('Права на публикацию'));
  assert.ok(showcaseSource.includes('required: true'));
});
