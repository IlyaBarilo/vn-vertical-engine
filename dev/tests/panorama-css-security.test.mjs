import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.dirname(fileURLToPath(new URL('../../index.html', import.meta.url)));

// Проверяет только файлы проекта, чтобы локальные неотслеживаемые материалы не ломали тесты разработчика.
test('assets/360 не содержит отслеживаемых устаревших JS-панорам', function() {
  const panoramaPaths = execFileSync('git', ['ls-files', '--', 'assets/360'], {
    cwd: repositoryRoot,
    encoding: 'utf8'
  }).split(/\r?\n/);
  const legacyPackages = panoramaPaths
    .filter(function(relativePath) {
      return /-360[^/\\]*\.js$/i.test(relativePath)
        && existsSync(path.join(repositoryRoot, relativePath));
    })
    .sort();
  assert.deepEqual(legacyPackages, []);
});

// Записывает беззнаковое 32-битное число в PNG-заголовок с прямым порядком байтов.
function writeUint32Be(bytes, offset, value) {
  bytes[offset] = Math.floor(value / 0x1000000) & 0xff;
  bytes[offset + 1] = Math.floor(value / 0x10000) & 0xff;
  bytes[offset + 2] = Math.floor(value / 0x100) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

// Создаёт достаточный для ранней проверки PNG-заголовок без запуска полноценного декодера.
function createPngHeader(width, height) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  writeUint32Be(bytes, 16, width);
  writeUint32Be(bytes, 20, height);
  return bytes;
}

// Создаёт минимальный JPEG с SOF0, содержащим проверяемые ширину и высоту.
function createJpegHeader(width, height) {
  return Uint8Array.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x07, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff
  ]);
}

// Создаёт расширенный WebP-заголовок VP8X с 24-битными размерами минус один.
function createWebpHeader(width, height) {
  const bytes = new Uint8Array(30);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x58], 12);
  const storedWidth = width - 1;
  const storedHeight = height - 1;
  bytes[24] = storedWidth & 0xff;
  bytes[25] = (storedWidth >> 8) & 0xff;
  bytes[26] = (storedWidth >> 16) & 0xff;
  bytes[27] = storedHeight & 0xff;
  bytes[28] = (storedHeight >> 8) & 0xff;
  bytes[29] = (storedHeight >> 16) & 0xff;
  return bytes;
}

// Формирует computed style декларативного пакета для вызова настоящего извлекателя из проекта.
function createComputedStyle(mimeType, declaredWidth, declaredHeight, bytes) {
  const payload = Buffer.from(bytes).toString('base64');
  const properties = new Map([
    ['--vn360-schema', 'vn360-css-pack-v1'],
    ['--vn360-mode', 'normal'],
    ['--vn360-mime', mimeType],
    ['--vn360-width', String(declaredWidth)],
    ['--vn360-height', String(declaredHeight)],
    ['--vn360-size', String(bytes.length)],
    ['--vn360-quality', '1'],
    ['--vn360-chunk-count', '1'],
    ['--vn360-data-0', `data:${mimeType};base64,${payload}`]
  ]);
  return {
    getPropertyValue: function(propertyName) {
      const value = properties.get(propertyName);
      return value === undefined ? '' : JSON.stringify(value);
    }
  };
}

// Формирует минимальный текст CSS-пакета для проверки строгого парсера до браузерной загрузки.
function createCssPackSource(mimeType, declaredWidth, declaredHeight, bytes) {
  const payload = Buffer.from(bytes).toString('base64');
  return [
    '/* пакет конвертера */',
    '#vn360-pack {',
    '  --vn360-schema: "vn360-css-pack-v1";',
    '  --vn360-mode: "normal";',
    `  --vn360-mime: "${mimeType}";`,
    `  --vn360-width: "${declaredWidth}";`,
    `  --vn360-height: "${declaredHeight}";`,
    `  --vn360-size: "${bytes.length}";`,
    '  --vn360-quality: "1";',
    '  --vn360-chunk-count: "1";',
    `  --vn360-data-0: "data:${mimeType};base64,${payload}";`,
    '}',
    ''
  ].join('\n');
}

// Извлекает реальную защитную часть движка или редактора и запускает её отдельно от браузерного интерфейса.
async function loadPanoramaRuntime(kind) {
  const isEngine = kind === 'engine';
  const relativePath = isEngine ? 'engine/engine.js' : 'tools/scene360-editor.html';
  const source = await readFile(path.join(repositoryRoot, relativePath), 'utf8');
  const startMarker = isEngine
    ? 'var BG360_CSS_PACK_MAX_ENCODED_LENGTH'
    : 'var PANORAMA_CSS_PACK_MAX_ENCODED_LENGTH';
  const endMarker = isEngine
    ? 'function readBg360CssPack'
    : 'function readPanoramaCssPack';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `Не найден защитный блок ${relativePath}.`);

  let blobCreations = 0;
  class TestBlob {
    // Имитирует только размер Blob и считает, дошли ли недоверенные данные до этой стадии.
    constructor(parts, options) {
      blobCreations++;
      this.size = parts.reduce(function(total, part) { return total + part.length; }, 0);
      this.type = options && options.type ? options.type : '';
    }
  }
  const context = vm.createContext({
    atob,
    Blob: TestBlob,
    bg360Runtime: { renderer: { capabilities: { maxTextureSize: 32768 } } },
    renderer: { capabilities: { maxTextureSize: 32768 } }
  });
  const exportsSource = isEngine
    ? [
        'this.readDimensions = readBg360CssImageDimensions;',
        'this.validateDimensions = validateBg360CssImageDimensions;',
        'this.parseSource = createBg360CssPropertyReader;',
        'this.extractPack = extractBg360CssPackBlob;',
        'this.limits = { encoded: BG360_CSS_PACK_MAX_ENCODED_LENGTH, decoded: BG360_CSS_PACK_MAX_DECODED_SIZE, chunks: BG360_CSS_PACK_MAX_CHUNKS, chunk: BG360_CSS_PACK_MAX_CHUNK_LENGTH, source: BG360_CSS_PACK_MAX_SOURCE_LENGTH, width: BG360_CSS_IMAGE_MAX_WIDTH, height: BG360_CSS_IMAGE_MAX_HEIGHT, pixels: BG360_CSS_IMAGE_MAX_PIXELS };'
      ]
    : [
        'this.readDimensions = readPanoramaCssImageDimensions;',
        'this.validateDimensions = validatePanoramaCssImageDimensions;',
        'this.parseSource = createPanoramaCssPropertyReader;',
        'this.extractPack = extractPanoramaCssPackBlob;',
        'this.limits = { encoded: PANORAMA_CSS_PACK_MAX_ENCODED_LENGTH, decoded: PANORAMA_CSS_PACK_MAX_DECODED_SIZE, chunks: PANORAMA_CSS_PACK_MAX_CHUNKS, chunk: PANORAMA_CSS_PACK_MAX_CHUNK_LENGTH, source: PANORAMA_CSS_PACK_MAX_SOURCE_LENGTH, width: PANORAMA_CSS_IMAGE_MAX_WIDTH, height: PANORAMA_CSS_IMAGE_MAX_HEIGHT, pixels: PANORAMA_CSS_IMAGE_MAX_PIXELS };'
      ];
  new vm.Script(source.slice(start, end) + '\n' + exportsSource.join('\n'), { filename: relativePath }).runInContext(context);
  return {
    source,
    readDimensions: context.readDimensions,
    validateDimensions: context.validateDimensions,
    parseSource: context.parseSource,
    extractPack: context.extractPack,
    limits: JSON.parse(JSON.stringify(context.limits)),
    getBlobCreations: function() { return blobCreations; }
  };
}

// Подтверждает одинаковые большие пределы normal/mobile во всех двух загрузчиках.
test('движок и редактор используют единые предохранительные лимиты CSS-панорам', async function() {
  for (const kind of ['engine', 'editor']) {
    const runtime = await loadPanoramaRuntime(kind);
    assert.deepEqual(runtime.limits, {
      encoded: 128 * 1024 * 1024,
      decoded: 96 * 1024 * 1024,
      chunks: 4096,
      chunk: 32 * 1024,
      source: 130 * 1024 * 1024,
      width: 20000,
      height: 15000,
      pixels: 300000000
    });
    assert.doesNotThrow(function() { runtime.validateDimensions(20000, 15000); });
    assert.throws(function() { runtime.validateDimensions(20001, 15000); }, /превышает предел/);
    assert.throws(function() { runtime.validateDimensions(20000, 15001); }, /превышает предел/);
  }
});

// Проверяет, что CSS остаётся чистым контейнером данных без импортов, сторонних правил, дублей и скрытых частей.
test('строгий парсер CSS-панорам принимает только один канонический #vn360-pack', async function() {
  const validSource = createCssPackSource('image/png', 1, 1, createPngHeader(1, 1));
  const maliciousSources = [
    `@import url("https://example.invalid/a.css");\n${validSource}`,
    `html { display: none; }\n${validSource}`,
    validSource.replace('  --vn360-mode: "normal";', '  --vn360-mode: "normal";\n  --vn360-mode: "mobile";'),
    validSource.replace('  --vn360-mode: "normal";', '  --vn360-mode: "nor\\6dal";'),
    validSource.replace('  --vn360-data-0:', '  --vn360-data-1:')
  ];

  for (const kind of ['engine', 'editor']) {
    const runtime = await loadPanoramaRuntime(kind);
    const propertyReader = runtime.parseSource(validSource);
    assert.equal(propertyReader.getPropertyValue('--vn360-schema'), '"vn360-css-pack-v1"');
    assert.doesNotThrow(function() { runtime.extractPack(propertyReader); });
    for (const maliciousSource of maliciousSources) {
      assert.throws(function() { runtime.parseSource(maliciousSource); }, /CSS-пакет|количество частей/);
    }
  }
});

// Фиксирует строгий текстовый путь и узкий CSP-link только для несовместимого file:// origin в Chromium.
test('движок и редактор изолируют оба кроссбраузерных пути чтения CSS-пакета', async function() {
  const engineSource = (await loadPanoramaRuntime('engine')).source;
  const editorSource = (await loadPanoramaRuntime('editor')).source;
  assert.match(engineSource, /frameDocument\.contentType !== "text\/css"/);
  assert.match(engineSource, /createBg360CssPropertyReader\(cssSource\)/);
  assert.match(editorSource, /frameDocument\.contentType !== "text\/css"/);
  assert.match(editorSource, /createPanoramaCssPropertyReader\(cssSource\)/);
  const engineTextLoader = engineSource.slice(engineSource.indexOf('function readBg360CssPackFromTextDocument'), engineSource.indexOf('function createBg360CssStyleNonce'));
  const editorTextLoader = editorSource.slice(editorSource.indexOf('function readPanoramaCssPackFromTextDocument'), editorSource.indexOf('function createPanoramaCssStyleNonce'));
  assert.doesNotMatch(engineTextLoader, /srcdoc/);
  assert.doesNotMatch(editorTextLoader, /srcdoc/);
  assert.match(engineSource, /style-src 'nonce-[\s\S]+window\.location\.protocol !== "file:"/);
  assert.match(editorSource, /style-src 'nonce-[\s\S]+window\.location\.protocol !== "file:"/);
});

// Проверяет все поддерживаемые заголовки без обращения к браузерному Image-декодеру.
test('движок и редактор читают размеры PNG, JPEG и WebP из бинарного заголовка', async function() {
  const cases = [
    ['image/png', createPngHeader(12000, 6000)],
    ['image/jpeg', createJpegHeader(12000, 6000)],
    ['image/webp', createWebpHeader(12000, 6000)]
  ];
  for (const kind of ['engine', 'editor']) {
    const runtime = await loadPanoramaRuntime(kind);
    for (const [mimeType, bytes] of cases) {
      assert.deepEqual(JSON.parse(JSON.stringify(runtime.readDimensions(mimeType, [bytes]))), { width: 12000, height: 6000 });
    }
  }
});

// Доказывает, что поддельные метаданные и вредный фактический размер отклоняются до создания Blob.
test('CSS-панорама с поддельными или чрезмерными размерами не доходит до Blob-декодирования', async function() {
  for (const kind of ['engine', 'editor']) {
    const mismatchRuntime = await loadPanoramaRuntime(kind);
    assert.throws(function() {
      mismatchRuntime.extractPack(createComputedStyle('image/png', 1, 1, createPngHeader(2, 1)));
    }, /не совпадает с метаданными/);
    assert.equal(mismatchRuntime.getBlobCreations(), 0);

    const oversizedRuntime = await loadPanoramaRuntime(kind);
    assert.throws(function() {
      oversizedRuntime.extractPack(createComputedStyle('image/png', 1, 1, createPngHeader(20001, 1)));
    }, /превышает предел/);
    assert.equal(oversizedRuntime.getBlobCreations(), 0);
  }
});

// Фиксирует, что конвертер создаёт только пакеты, укладывающиеся в тот же контракт.
test('конвертер применяет общие лимиты до создания CSS-пакета', async function() {
  const source = await readFile(path.join(repositoryRoot, 'tools/convert-360-img-to-css.html'), 'utf8');
  assert.match(source, /PANORAMA_PACK_MAX_WIDTH = 20000/);
  assert.match(source, /PANORAMA_PACK_MAX_HEIGHT = 15000/);
  assert.match(source, /PANORAMA_PACK_MAX_PIXELS = 300000000/);
  assert.match(source, /validatePanoramaPackDimensions\(targetWidth, targetHeight\)/);
  assert.match(source, /PANORAMA_PACK_MAX_IMAGE_BYTES = 96 \* 1024 \* 1024/);
});
