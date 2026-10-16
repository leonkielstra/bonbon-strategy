import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig } from '../bonbon-strategy-config.js';

test('default Lights section uses a single card column', () => {
  const lights = defaultConfig.views.bonbon_area.sections.bonbon_lights;

  assert.equal(lights.min_columns, 1);
  assert.equal(lights.max_columns, 1);
});
