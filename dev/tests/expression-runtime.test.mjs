import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testsDirectory, '..', '..');
const expressionPath = path.resolve(testsDirectory, '..', '..', 'engine', 'expression.js');
let expressionModulePromise = null;

// Загружает общий expression-модуль целиком и возвращает его публичный API из изолированного контекста.
async function loadExpressionModule() {
  if (!expressionModulePromise) {
    expressionModulePromise = readFile(expressionPath, 'utf8').then(function(source) {
      const windowObject = {};
      const context = vm.createContext({ window: windowObject });
      const script = new vm.Script(source, { filename: expressionPath });
      script.runInContext(context, { timeout: 5000 });
      assert.equal(typeof windowObject.VNExpression, 'object');
      assert.equal(typeof windowObject.VNExpression.evaluate, 'function');
      assert.equal(typeof windowObject.VNExpression.inspect, 'function');
      return windowObject.VNExpression;
    });
  }

  return expressionModulePromise;
}

// Возвращает вычисляющую функцию из общего модуля для компактных runtime-тестов.
async function loadExpressionEvaluator() {
  const expressionModule = await loadExpressionModule();
  return expressionModule.evaluate;
}

// Проверяет приоритет арифметики, скобки и унарный минус в рабочем evaluator движка.
test('runtime вычисляет арифметические выражения', async function() {
  const evaluate = await loadExpressionEvaluator();

  assert.equal(evaluate('2 + 3 * 4', {}), 14);
  assert.equal(evaluate('(2 + 3) * 4', {}), 20);
  assert.equal(evaluate('-score + bonus', { score: 5, bonus: 2 }), -3);
  assert.equal(evaluate('17 % 5', {}), 2);
});

// Проверяет сравнения, литералы и логические операторы с переменными сценария.
test('runtime вычисляет условия и логические операторы', async function() {
  const evaluate = await loadExpressionEvaluator();
  const vars = { score: 8, enabled: true, name: 'Анна' };

  assert.equal(evaluate('enabled && score >= 5', vars), true);
  assert.equal(evaluate('!enabled || score < 5', vars), false);
  assert.equal(evaluate('name === "Анна"', vars), true);
  assert.equal(evaluate('null == undefined', vars), true);
});

// Проверяет сложение строк и обработку экранированных символов.
test('runtime объединяет строки', async function() {
  const evaluate = await loadExpressionEvaluator();

  assert.equal(evaluate('"Привет, " + player', { player: 'Анна' }), 'Привет, Анна');
  assert.equal(evaluate('"Первая\\n" + "вторая"', {}), 'Первая\nвторая');
});

// Проверяет понятную ошибку при обращении к необъявленной переменной.
test('runtime отклоняет неизвестный идентификатор', async function() {
  const evaluate = await loadExpressionEvaluator();

  assert.throws(function() {
    evaluate('missing + 1', {});
  }, /Unknown identifier: missing/);
});

// Проверяет запрет глобальных и прототипных идентификаторов во время вычисления.
test('runtime отклоняет небезопасные идентификаторы', async function(t) {
  const evaluate = await loadExpressionEvaluator();

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
  const evaluate = await loadExpressionEvaluator();

  assert.throws(function() {
    evaluate('10 / 0', {});
  }, /Division by zero is not allowed/);
  assert.throws(function() {
    evaluate('10 % 0', {});
  }, /Modulo by zero is not allowed/);
});

// Проверяет, что язык выражений не допускает вызовы функций и доступ к свойствам.
test('runtime не выполняет функции и обращения к свойствам', async function() {
  const evaluate = await loadExpressionEvaluator();

  assert.throws(function() {
    evaluate('fn()', { fn: function() {} });
  }, /Unexpected token/);
  assert.throws(function() {
    evaluate('value.constructor', { value: 1 });
  }, /Unsupported symbol/);
});

// Проверяет единый инспектор грамматики и исключение служебных литералов из списка переменных.
test('общий модуль проверяет синтаксис и собирает идентификаторы', async function() {
  const expressionModule = await loadExpressionModule();
  const validResult = expressionModule.inspect('enabled && (score + bonus >= 5) && true');
  const unsafeResult = expressionModule.inspect('window || score');

  assert.equal(validResult.ok, true);
  assert.deepEqual(Array.from(validResult.identifiers), ['bonus', 'enabled', 'score']);
  assert.equal(validResult.error, '');
  assert.equal(unsafeResult.ok, false);
  assert.match(unsafeResult.error, /Unsafe identifier is not allowed/);
});

// Сохраняет прежнее вычисление обеих сторон логических операторов вместо неявного short-circuit.
test('логические операторы сохраняют legacy-проверку обеих сторон', async function() {
  const evaluate = await loadExpressionEvaluator();

  assert.throws(function() {
    evaluate('true || missing', {});
  }, /Unknown identifier: missing/);
  assert.throws(function() {
    evaluate('false && missing', {});
  }, /Unknown identifier: missing/);
});

// Закрепляет один источник грамматики и обязательную загрузку модуля до loader и runtime.
test('loader и runtime используют общий expression-модуль', async function() {
  const [indexSource, loaderSource, engineSource] = await Promise.all([
    readFile(path.join(repositoryRoot, 'index.html'), 'utf8'),
    readFile(path.join(repositoryRoot, 'engine', 'story-loader.js'), 'utf8'),
    readFile(path.join(repositoryRoot, 'engine', 'engine.js'), 'utf8')
  ]);
  const expressionPosition = indexSource.indexOf('engine/expression.js');
  const loaderPosition = indexSource.indexOf('engine/story-loader.js');
  const enginePosition = indexSource.indexOf('engine/engine.js');

  assert.ok(expressionPosition >= 0);
  assert.ok(loaderPosition > expressionPosition);
  assert.ok(enginePosition > expressionPosition);
  assert.ok(loaderSource.includes('window.VNExpression.inspect'));
  assert.ok(engineSource.includes('window.VNExpression.evaluate'));
  assert.ok(engineSource.includes('window.VNExpression.inspect'));
  assert.equal(loaderSource.includes('tokenizeSafeExpressionForValidation'), false);
  assert.equal(engineSource.includes('function tokenizeSafeExpression'), false);
});
