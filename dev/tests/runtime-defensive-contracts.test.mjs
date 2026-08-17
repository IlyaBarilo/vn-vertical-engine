import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Проверяет границу coordinator/controller для browser-методов, которые требуют сохранённого receiver.
test('runtime передаёт receiver-sensitive browser API только через bind или обёртку', async function() {
  const engineSource = await readFile(new URL('../../engine/engine.js', import.meta.url), 'utf8');
  const assignmentPattern = /^\s*(getComputedStyle|requestAnimationFrame|cancelAnimationFrame|warn|log):\s*([^\r\n]+)$/gm;
  const assignments = Array.from(engineSource.matchAll(assignmentPattern));

  assert.ok(assignments.length >= 8, 'Не найдены ожидаемые receiver-sensitive зависимости контроллеров');
  assignments.forEach(function assertBoundReceiver(match) {
    const optionName = match[1];
    const expression = match[2];
    assert.match(
      expression,
      /\.bind\s*\(|=>|function\s*\(/,
      `Зависимость ${optionName} должна явно сохранять receiver через bind или функцию-обёртку`
    );
  });
});
