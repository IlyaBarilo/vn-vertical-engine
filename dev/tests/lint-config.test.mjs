import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Закрепляет обязательный контур статической проверки, его область исходников и запуск для каждого обычного CI.
test('ESLint проверяет runtime и тестовый код в отдельной CI-задаче', async function() {
  const [packageSource, configSource, workflowSource] = await Promise.all([
    readFile(path.join(repositoryRoot, 'dev', 'package.json'), 'utf8'),
    readFile(path.join(repositoryRoot, 'eslint.config.mjs'), 'utf8'),
    readFile(path.join(repositoryRoot, '.github', 'workflows', 'tests.yml'), 'utf8')
  ]);
  const packageData = JSON.parse(packageSource);
  const lintCommand = packageData.scripts && packageData.scripts.lint;
  const qualityStart = workflowSource.indexOf('  quality:');
  const testStart = workflowSource.indexOf('  test:', qualityStart);
  const qualityJob = workflowSource.slice(qualityStart, testStart);

  assert.equal(packageData.devDependencies.eslint, '10.8.1');
  assert.equal(packageData.devDependencies.globals, '17.11.0');
  assert.match(lintCommand, /eslint/);
  assert.ok(lintCommand.includes('engine/*.js'));
  assert.ok(lintCommand.includes('dev/tests/**/*.mjs'));
  assert.ok(configSource.includes("'no-dupe-keys': 'error'"));
  assert.ok(configSource.includes("'no-undef': 'error'"));
  assert.ok(configSource.includes("'no-unused-vars': ['error'"));
  assert.ok(configSource.includes("'no-unreachable': 'error'"));
  assert.ok(configSource.includes("'no-implicit-globals': 'error'"));
  assert.ok(qualityStart >= 0, 'В tests.yml отсутствует quality job');
  assert.ok(testStart > qualityStart, 'Не удалось выделить quality job');
  assert.ok(qualityJob.includes('run: npm ci'));
  assert.ok(qualityJob.includes('run: npm run lint'));
  assert.ok(qualityJob.includes('working-directory: dev'));
});
