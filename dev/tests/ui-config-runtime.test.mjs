import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const enginePath = path.resolve(testsDirectory, '..', '..', 'engine', 'engine.js');
let uiRuntimePromise = null;

/**
 * Извлекает настоящую UI-схему и связанные функции из engine.js без запуска всего браузерного runtime.
 */
async function loadEngineUIRuntime() {
  if (!uiRuntimePromise) {
    uiRuntimePromise = readFile(enginePath, 'utf8').then(function(source) {
      const configStart = source.indexOf('const UI_STYLE_CONFIG = {');
      const configEnd = source.indexOf('const MAX_NOVEL_ASPECT_W', configStart);
      const functionsStart = source.indexOf('function applyUIStyleVariables(meta) {');
      const functionsEnd = source.indexOf('// Нормализует режим окна', functionsStart);

      assert.ok(configStart >= 0 && configEnd > configStart, 'В engine.js не найдена UI_STYLE_CONFIG.');
      assert.ok(functionsStart >= 0 && functionsEnd > functionsStart, 'В engine.js не найден блок UI-функций.');

      const inlineStyles = new Map();
      const context = vm.createContext({
        URLSearchParams,
        window: { location: { search: '' } },
        document: {
          documentElement: {
            style: {
              setProperty: function(name, value) {
                inlineStyles.set(name, value);
              },
              removeProperty: function(name) {
                inlineStyles.delete(name);
              }
            }
          }
        }
      });
      const runtimeSource = [
        source.slice(configStart, configEnd),
        source.slice(functionsStart, functionsEnd),
        'this.uiConfigForTests = UI_STYLE_CONFIG;',
        'this.isValidUIConfigValueForTests = isValidUIConfigValue;',
        'this.getUIOverridesFromQueryForTests = getUIOverridesFromQuery;',
        'this.applyUIStyleVariablesForTests = applyUIStyleVariables;'
      ].join('\n');
      const script = new vm.Script(runtimeSource, { filename: enginePath });
      script.runInContext(context, { timeout: 5000 });

      return {
        source,
        inlineStyles,
        config: context.uiConfigForTests,
        isValid: context.isValidUIConfigValueForTests,
        parseQuery: context.getUIOverridesFromQueryForTests,
        applyStyles: context.applyUIStyleVariablesForTests
      };
    });
  }
  return uiRuntimePromise;
}

/**
 * Переносит объект из VM-контекста в обычный объект Node для точного сравнения результата.
 */
function normalizeVmObject(value) {
  return JSON.parse(JSON.stringify(value));
}

// Защищает engine.js от повторного появления shadowing и отдельного неиспользуемого URL-parser.
test('runtime содержит по одной UI-валидации и URL-parser', async function() {
  const runtime = await loadEngineUIRuntime();

  assert.equal((runtime.source.match(/function isValidUIConfigValue\s*\(/g) || []).length, 1);
  assert.equal((runtime.source.match(/function getUIOverridesFromQuery\s*\(/g) || []).length, 1);
  assert.match(runtime.source, /var queryOverrides = getUIOverridesFromQuery\(\);/);
});

// Подтверждает отсутствие верхнего лимита отступов при строгой проверке типа и минимума.
test('UI-валидация принимает большие неотрицательные целые отступы', async function() {
  const runtime = await loadEngineUIRuntime();
  const spacingConfig = runtime.config.topSpacing;

  assert.equal(Object.prototype.hasOwnProperty.call(spacingConfig, 'max'), false);
  for (const value of [0, 500, 800, 5000, 20_000, 1_000_000]) {
    assert.equal(runtime.isValid(value, spacingConfig), true, `Ожидался допустимый отступ: ${value}`);
  }
  for (const value of [-1, 1.5, NaN, Infinity, -Infinity, '500']) {
    assert.equal(runtime.isValid(value, spacingConfig), false, `Ожидался недопустимый отступ: ${value}`);
  }
});

// Проверяет min/max float-параметров и дополнительное правило схемы без обхода общей валидации.
test('UI-валидация соблюдает границы float и дополнительный validate', async function() {
  const runtime = await loadEngineUIRuntime();
  const opacityConfig = runtime.config.blurOpacity;

  assert.equal(runtime.isValid(0, opacityConfig), true);
  assert.equal(runtime.isValid(1, opacityConfig), true);
  assert.equal(runtime.isValid(-0.01, opacityConfig), false);
  assert.equal(runtime.isValid(1.01, opacityConfig), false);
  assert.equal(runtime.isValid(NaN, opacityConfig), false);
  assert.equal(runtime.isValid(Infinity, opacityConfig), false);
  assert.equal(runtime.isValid(4, { type: 'float', validate: function(value) { return value % 2 === 0; } }), true);
  assert.equal(runtime.isValid(3, { type: 'float', validate: function(value) { return value % 2 === 0; } }), false);
});

// Проверяет четыре прежних URL-ключа без учёта регистра и не включает query для blur-параметров.
test('URL-parser принимает большие отступы и игнорирует неподдерживаемые UI-ключи', async function() {
  const runtime = await loadEngineUIRuntime();
  const overrides = runtime.parseQuery(
    '?TOPSPACING=5000&RightSpacing=12000&bottomspacing=8000&LEFTSPACING=25000&blurOpacity=0.2'
  );

  assert.deepEqual(normalizeVmObject(overrides), {
    topSpacing: 5000,
    rightSpacing: 12000,
    bottomSpacing: 8000,
    leftSpacing: 25000
  });
});

// Не позволяет URL обойти числовой тип и минимум UI-схемы.
test('URL-parser отклоняет отрицательные, дробные и бесконечные отступы', async function() {
  const runtime = await loadEngineUIRuntime();
  const overrides = runtime.parseQuery(
    '?topSpacing=-1&rightSpacing=1.5&bottomSpacing=Infinity&leftSpacing=12px'
  );

  assert.deepEqual(normalizeVmObject(overrides), {});
});

// Проверяет, что недопустимые meta-значения не превращаются в inline CSS даже в обход парсера истории.
test('runtime не применяет недопустимые UI-значения к CSS', async function() {
  const runtime = await loadEngineUIRuntime();
  runtime.inlineStyles.clear();

  runtime.applyStyles({
    topSpacing: 5000,
    blurStrength: -1,
    blurBrightness: 0.5,
    blurOpacity: 1.1
  });

  assert.equal(runtime.inlineStyles.get('--topSpacing'), '5000px');
  assert.equal(runtime.inlineStyles.get('--blurBrightness'), '0.5');
  assert.equal(runtime.inlineStyles.has('--blurStrength'), false);
  assert.equal(runtime.inlineStyles.has('--blurOpacity'), false);
});
