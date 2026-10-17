import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig } from '../bonbon-strategy-config.js';
import { createBuildersApi } from '../bonbon-strategy-builders.js';

test('default Lights section puts multiple light cards in two columns', () => {
  const lights = defaultConfig.views.bonbon_area.sections.bonbon_lights;
  const { createGrid } = createBuildersApi('test', defaultConfig);

  assert.equal(createGrid([{}, {}, {}], lights).columns, 2);
  assert.equal(createGrid([{}], lights).columns, 1);
});
