# Политика безопасности / Security Policy

## Русский

### Поддерживаемые версии

| Версия | Статус |
| --- | --- |
| Последний опубликованный непререлизный GitHub Release | Поддерживается |
| Ветка `main` | Разработка; не считается стабильным выпуском |
| Более ранние выпуски | Не поддерживаются |

Исправления безопасности выпускаются для последней стабильной версии. Обратный
перенос исправлений в старые выпуски обычно не выполняется, поэтому перед
сообщением об ошибке проверьте её на последнем Release.

### Как сообщить об уязвимости

Используйте только приватную форму GitHub
[Report a vulnerability](https://github.com/IlyaBarilo/vn-vertical-engine/security/advisories/new).
Private Vulnerability Reporting включён для этого репозитория и передаёт отчёт
напрямую сопровождающему без предварительной публикации деталей.

Не размещайте сведения об уязвимости, рабочий exploit или закрытые материалы в
Discussions, публичном pull request или другом открытом канале до согласованного
раскрытия. Не прикладывайте пароли, токены, реальные лицензионные ключи и чужие
пользовательские проекты.

Полезный отчёт содержит:

- затронутую версию или hash коммита;
- браузер, ОС и способ запуска (`file://` или HTTP(S));
- затронутый компонент и тип входных данных;
- минимальные шаги воспроизведения или небольшой безопасный proof of concept;
- наблюдаемое влияние и ожидаемое безопасное поведение;
- известный временный способ снизить риск, если он есть.

Проект сопровождается одним разработчиком, поэтому гарантированный срок ответа
и программа вознаграждений за найденные уязвимости не предусмотрены.
Подтверждение, проверка и исправление выполняются по мере возможности с
приоритетом для уязвимостей с высоким влиянием.

### Координированное раскрытие

После подтверждения отчёта исправление и regression-тесты готовятся приватно,
когда это необходимо. Публичное раскрытие происходит после доступности
исправленного Release либо в другой согласованный с автором отчёта момент.
Существенная исправленная уязвимость может быть опубликована как GitHub Security
Advisory с указанием влияния, затронутых версий и способа обновления. Авторство
исследователя указывается по согласованию.

### Security-релизы и проверка архивов

Исправленные сборки публикуются только на странице
[Releases](https://github.com/IlyaBarilo/vn-vertical-engine/releases). Для каждого
релизного ZIP публикуется соседний файл `.sha256`. В исходном репозитории пару
файлов можно проверить командой:

```powershell
node dev/scripts/release-checksums.mjs verify ".\vn-vertical-engine-vX.Y.Z.zip.sha256"
```

Без исходного репозитория вычислите значение штатным PowerShell и сравните его
с первым полем файла `.sha256`:

```powershell
(Get-FileHash -Algorithm SHA256 ".\vn-vertical-engine-vX.Y.Z.zip").Hash.ToLower()
```

В Linux и macOS стандартный формат проверяется командой:

```sh
sha256sum -c "vn-vertical-engine-vX.Y.Z.zip.sha256"
```

Совпадение SHA-256 обнаруживает повреждение или замену архива относительно
скачанного checksum-файла. Это не цифровая подпись и не защищает от одновременной
компрометации репозитория, Release и его `.sha256`.

### Область ответственности

В область отчётов входят уязвимости в официальных файлах runtime, Worker- и
iframe-изоляции, протоколе мини-игр, проверке путей и форматов, авторских
инструментах, аудиторе и релизном процессе. Подробные границы и остаточные риски
описаны в [модели угроз](docs/security/threat-model.md).

Проверяйте только собственную копию проекта и тестовые данные. Не нарушайте
работу чужих установок, не получайте доступ к чужим данным и не используйте
социальную инженерию.

Следующие границы принципиальны:

- клиентские HTML/JavaScript-файлы не являются местом для серверных секретов;
- защита авторских файлов действует при их запуске через официальный runtime,
  но не при прямом открытии недоверенного HTML, SVG или JavaScript;
- `license-key.js` выполняется в основном окне и должен считаться доверенным
  локальным файлом, а не входом от неизвестного автора;
- компрометация браузера, ОС, расширения или официального runtime находится вне
  модели проекта;
- лимиты уменьшают риск исчерпания памяти, но не гарантируют работу тяжёлых
  медиа на любом устройстве.

---

## English

### Supported versions

| Version | Status |
| --- | --- |
| Latest published non-prerelease GitHub Release | Supported |
| `main` branch | Development only; not a stable release |
| Earlier releases | Unsupported |

Security fixes target the latest stable release. Fixes are not normally
backported, so reproduce the issue with the latest Release before reporting it.

### Reporting a vulnerability

Use the private GitHub
[Report a vulnerability](https://github.com/IlyaBarilo/vn-vertical-engine/security/advisories/new)
form. Private Vulnerability Reporting is enabled and sends the report directly
to the maintainer without first disclosing its details.

Do not publish vulnerability details, a working exploit, or private project
material in Discussions, a public pull request, or another public channel before
coordinated disclosure. Do not include passwords, tokens, real license keys, or
third-party user projects.

Please include the affected version or commit, browser and OS, `file://` or
HTTP(S) launch method, affected component, minimal reproduction, impact, expected
safe behavior, and any known mitigation.

This project is maintained by a single developer, so no response-time guarantee
or bug bounty program is provided. Reports are acknowledged, assessed, and
fixed on a best-effort basis, with high-impact vulnerabilities prioritized.

### Coordinated disclosure

When necessary, a confirmed issue and its regression tests are prepared
privately. Public disclosure follows an available fixed Release or another date
agreed with the reporter. A material fixed issue may be published as a GitHub
Security Advisory with impact, affected versions, and upgrade instructions.
Reporter credit is coordinated with the reporter.

### Security releases and archive verification

Fixed builds are published only on the official
[Releases](https://github.com/IlyaBarilo/vn-vertical-engine/releases) page. Each
release ZIP has a matching `.sha256` file. From a source checkout, verify the pair
with:

```powershell
node dev/scripts/release-checksums.mjs verify ".\vn-vertical-engine-vX.Y.Z.zip.sha256"
```

Without a source checkout, compute the value with PowerShell and compare it with
the first field of the `.sha256` file:

```powershell
(Get-FileHash -Algorithm SHA256 ".\vn-vertical-engine-vX.Y.Z.zip").Hash.ToLower()
```

On Linux and macOS, the standard checksum format can be verified with:

```sh
sha256sum -c "vn-vertical-engine-vX.Y.Z.zip.sha256"
```

A matching SHA-256 detects archive corruption or replacement relative to the
downloaded checksum file. It is not a digital signature and does not protect
against simultaneous compromise of the repository, Release, and `.sha256`.

### Scope and boundaries

Reports may cover the official runtime, Worker and iframe isolation, mini-game
protocol, path and format validation, authoring tools, project auditor, and
release process. See the detailed [threat model](docs/security/threat-model.md).

Test only copies and data you own. Do not disrupt third-party installations,
access third-party data, or use social engineering.

Important boundaries:

- client-side HTML and JavaScript cannot protect server secrets;
- author-file protections apply when content is launched by the official runtime,
  not when untrusted HTML, SVG, or JavaScript is opened directly;
- `license-key.js` executes in the main window and is trusted local code;
- compromised browsers, operating systems, extensions, or official runtime files
  are outside this model;
- resource limits reduce memory-exhaustion risk but cannot guarantee that heavy
  media works on every device.
