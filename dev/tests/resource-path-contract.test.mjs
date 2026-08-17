import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { loadStudentAuditorCore } from './helpers/load-student-auditor-core.mjs';

const require = createRequire(import.meta.url);
const runtimePolicy = require('../../engine/resource-path-policy.js');
const contractUrl = new URL('./fixtures/resource-path-contract.json', import.meta.url);
const requiredKinds = ['image', 'audio', 'video', 'background', 'game', 'panorama'];

// Применяет те же две последовательные проверки пути и расширения, которые использует ядро аудитора.
function validateWithAuditor(core, filePath, kind) {
  const pathReason = core.getUnsafePathReason(filePath);
  const extensionReason = pathReason ? '' : core.getResourceExtensionReason(filePath, kind);
  return {
    ok: !pathReason && !extensionReason,
    reason: pathReason || extensionReason
  };
}

// Проверяет версию, уникальность и покрытие всех типов ресурсов общим корпусом.
test('корпус политики путей имеет версию и покрывает все типы ресурсов', async function() {
  const contract = JSON.parse(await readFile(contractUrl, 'utf8'));
  const ids = contract.cases.map(function(item) { return item.id; });
  const kinds = new Set(contract.cases.map(function(item) { return item.kind; }));

  assert.equal(contract.version, 1);
  assert.equal(new Set(ids).size, ids.length, 'Идентификаторы contract cases должны быть уникальны');
  requiredKinds.forEach(function assertKindCovered(kind) {
    assert.equal(kinds.has(kind), true, `В корпусе отсутствует тип ресурса ${kind}`);
  });
});

// Запускает каждую fixture через реальные валидаторы runtime и аудитора и запрещает любое расхождение.
test('runtime и аудитор одинаково принимают и отклоняют пути ресурсов', async function() {
  const contract = JSON.parse(await readFile(contractUrl, 'utf8'));
  const { core } = await loadStudentAuditorCore();

  contract.cases.forEach(function assertContractCase(item) {
    const runtimeResult = runtimePolicy.validate(item.path, item.kind);
    const auditorResult = validateWithAuditor(core, item.path, item.kind);

    assert.equal(runtimeResult.ok, item.allowed, `${item.id}: неожиданный результат runtime`);
    assert.equal(auditorResult.ok, item.allowed, `${item.id}: неожиданный результат аудитора (${auditorResult.reason})`);
    assert.equal(auditorResult.ok, runtimeResult.ok, `${item.id}: runtime и аудитор разошлись`);
  });
});
