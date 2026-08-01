import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const enginePath = path.resolve(testsDirectory, '..', 'engine', 'engine.js');
let evaluatorPromise = null;

// Извлекает настоящий безопасный evaluator из engine.js, не запуская браузерную часть движка.
async function loadEngineExpressionEvaluator() {
  if (!evaluatorPromise) {
    evaluatorPromise = readFile(enginePath, 'utf8').then(function(source) {
      const startMarker = 'function evaluateSafeExpression(expression, vars) {';
      const endMarker = '// Проверяет грамматику безопасного выражения и собирает имена переменных без вычисления выражения.';
      const startIndex = source.indexOf(startMarker);
      const endIndex = source.indexOf(endMarker, startIndex);

      assert.ok(startIndex >= 0, 'В engine.js не найден evaluateSafeExpression.');
      assert.ok(endIndex > startIndex, 'Не удалось определить конец блока безопасного evaluator.');

      const evaluatorSource = source.slice(startIndex, endIndex);
      const context = vm.createContext({});
      const script = new vm.Script(
        evaluatorSource + '\nthis.evaluateSafeExpressionForTests = evaluateSafeExpression;',
        { filename: enginePath }
      );

      script.runInContext(context, { timeout: 5000 });
      return context.evaluateSafeExpressionForTests;
    });
  }

  return evaluatorPromise;
}

// Проверяет приоритет арифметики, скобки и унарный минус в рабочем evaluator движка.
test('runtime вычисляет арифметические выражения', async function() {
  const evaluate = await loadEngineExpressionEvaluator();

  assert.equal(evaluate('2 + 3 * 4', {}), 14);
  assert.equal(evaluate('(2 + 3) * 4', {}), 20);
  assert.equal(evaluate('-score + bonus', { score: 5, bonus: 2 }), -3);
  assert.equal(evaluate('17 % 5', {}), 2);
});

// Проверяет сравнения, литералы и логические операторы с переменными сценария.
test('runtime вычисляет условия и логические операторы', async function() {
  const evaluate = await loadEngineExpressionEvaluator();
  const vars = { score: 8, enabled: true, name: 'Анна' };

  assert.equal(evaluate('enabled && score >= 5', vars), true);
  assert.equal(evaluate('!enabled || score < 5', vars), false);
  assert.equal(evaluate('name === "Анна"', vars), true);
  assert.equal(evaluate('null == undefined', vars), true);
});

// Проверяет сложение строк и обработку экранированных символов.
test('runtime объединяет строки', async function() {
  const evaluate = await loadEngineExpressionEvaluator();

  assert.equal(evaluate('"Привет, " + player', { player: 'Анна' }), 'Привет, Анна');
  assert.equal(evaluate('"Первая\\n" + "вторая"', {}), 'Первая\nвторая');
});

// Проверяет понятную ошибку при обращении к необъявленной переменной.
test('runtime отклоняет неизвестный идентификатор', async function() {
  const evaluate = await loadEngineExpressionEvaluator();

  assert.throws(function() {
    evaluate('missing + 1', {});
  }, /Unknown identifier: missing/);
});

// Проверяет запрет глобальных и прототипных идентификаторов во время вычисления.
test('runtime отклоняет небезопасные идентификаторы', async function(t) {
  const evaluate = await loadEngineExpressionEvaluator();

  for (const identifier of ['window', 'document', 'globalThis', 'this', '__proto__', 'prototype', 'constructor']) {
    await t.test(identifier, function() {
      assert.throws(function() {
        evaluate(identifier, {});
      }, /Unsafe identifier is not allowed/);
    });
  }
});

// Проверяет явные ошибки деления и остатка от деления на ноль.
test('runtime отклоняет деление на ноль', async function() {
  const evaluate = await loadEngineExpressionEvaluator();

  assert.throws(function() {
    evaluate('10 / 0', {});
  }, /Division by zero is not allowed/);
  assert.throws(function() {
    evaluate('10 % 0', {});
  }, /Modulo by zero is not allowed/);
});

// Проверяет, что язык выражений не допускает вызовы функций и доступ к свойствам.
test('runtime не выполняет функции и обращения к свойствам', async function() {
  const evaluate = await loadEngineExpressionEvaluator();

  assert.throws(function() {
    evaluate('fn()', { fn: function() {} });
  }, /Unexpected token/);
  assert.throws(function() {
    evaluate('value.constructor', { value: 1 });
  }, /Unsupported symbol/);
});
