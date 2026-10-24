import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { runStoryLoader } from './helpers/run-story-loader.mjs';

// Проверяет все полные story-контейнеры непосредственно из опубликованной спецификации.
test('полные примеры story из спецификации проходят настоящий парсер', async () => {
  const markdown = await readFile(new URL('../../docs/specs/spec-story.md', import.meta.url), 'utf8');
  const blocks = [...markdown.matchAll(/\x60{3}js\r?\n([\s\S]*?)\x60{3}/g)]
    .map(match => match[1]).filter(source => source.includes('window.STORY_TEXT') && source.includes('[meta]'));
  assert.equal(blocks.length, 3);
  for (const source of blocks) {
    const windowObject = {};
    vm.runInNewContext(source, { window: windowObject }, { timeout: 1000 });
    const parsed = await runStoryLoader(windowObject.STORY_TEXT);
    assert.deepEqual(parsed.errors, []);
    assert.ok(parsed.story);
    if (source.includes('two-paths')) {
      assert.equal(parsed.story.scenes.length, 3);
      const menu = parsed.story.scenes[0].actions.find(action => action.type === 'choice');
      assert.ok(menu);
      assert.deepEqual(Array.from(menu.choices, choice => choice.goto), ['river_end', 'home_end']);
      for (const ending of parsed.story.scenes.slice(1)) {
        assert.equal(ending.actions.length, 1);
        assert.equal(ending.actions[0].type, 'text');
      }
      assert.equal(Object.keys(parsed.story.assets.games).length, 0);
      assert.equal(Object.keys(parsed.story.assets.backgrounds).length, 0);
    }
    if (source.includes('text-example')) {
      assert.equal(parsed.story.scenes[0].actions[0].text, 'Счёт: {score}\nНовая строка. Обратная кавычка: '+String.fromCharCode(96)+'.');
    }
  }
});

