import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.dirname(fileURLToPath(new URL('../../../index.html', import.meta.url)));
const auditorPath = path.join(repositoryRoot, 'tools', 'student-project-auditor.html');

// Загружает чистое ядро аудитора из single-file HTML без выполнения DOM-интерфейса.
export async function loadStudentAuditorCore() {
  const html = await readFile(auditorPath, 'utf8');
  const match = html.match(/\/\* STUDENT_PROJECT_AUDITOR_CORE_START \*\/([\s\S]*?)\/\* STUDENT_PROJECT_AUDITOR_CORE_END \*\//);
  assert.ok(match, 'В HTML-аудиторе не найдены маркеры тестируемого ядра.');

  const context = vm.createContext({});
  vm.runInContext(match[1], context, { filename: 'student-project-auditor-core.js' });
  assert.ok(context.VNStudentProjectAuditorCore, 'Ядро аудитора не экспортировано в globalThis.');
  return { core: context.VNStudentProjectAuditorCore, html };
}
