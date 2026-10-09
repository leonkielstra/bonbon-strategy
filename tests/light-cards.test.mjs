import test from 'node:test';
import assert from 'node:assert/strict';
import { createBuildersApi } from '../bonbon-strategy-builders.js';

function buildLight(attributes = {}, { state = 'off', config = {}, overrides = {} } = {}) {
  const entity = { entity_id: 'light.test', name: 'Test light' };
  const states = { [entity.entity_id]: { state, attributes } };
  const { createButtonCard } = createBuildersApi('test', config, states);

  return createButtonCard({ entity }, {}, overrides);
}

const dimmableModes = ['brightness', 'color_temp', 'hs', 'xy', 'rgb', 'rgbw', 'rgbww', 'white'];

for (const mode of dimmableModes) {
  for (const state of ['on', 'off']) {
    test(`${mode} light renders as a slider when ${state}`, () => {
      // Off lights need no current brightness value.
      const attributes = { supported_color_modes: [mode] };
      if (state === 'on') attributes.brightness = 128;

      const card = buildLight(attributes, { state });

      assert.equal(card.type, 'custom:bubble-card');
      assert.equal(card.card_type, 'button');
      assert.equal(card.button_type, 'slider');
      assert.equal(card.entity, 'light.test');
      assert.equal(card.button_action.tap_action.action, 'toggle');
      assert.equal(card.tap_action.action, 'toggle');
    });
  }
}

for (const modes of [['onoff'], ['unknown'], []]) {
  test(`light with modes ${JSON.stringify(modes)} stays a toggle`, () => {
    const card = buildLight({ supported_color_modes: modes });
    assert.equal(card.button_type, 'switch');
  });
}

test('missing capability data keeps the light a toggle', () => {
  assert.equal(buildLight().button_type, 'switch');

  const { createButtonCard } = createBuildersApi('test', {});
  const card = createButtonCard({ entity: { entity_id: 'light.missing' } });
  assert.equal(card.button_type, 'switch');
});

test('color light with multiple supported modes renders as a slider', () => {
  const card = buildLight({
    supported_color_modes: ['color_temp', 'hs'],
    brightness: null,
  });
  assert.equal(card.button_type, 'slider');
});

test('switch entities stay toggles', () => {
  const { createButtonCard } = createBuildersApi('test', {});
  const card = createButtonCard({ entity: { entity_id: 'switch.test' } });
  assert.equal(card.button_type, 'switch');
});

test('explicit button type overrides automatic selection', () => {
  const card = buildLight({ supported_color_modes: ['brightness'] }, { overrides: { button_type: 'switch' } });
  assert.equal(card.button_type, 'switch');
});

test('configured tap actions are preserved on sliders', () => {
  const card = buildLight(
    { supported_color_modes: ['brightness'] },
    {
      config: {
        actions: {
          light: { button: 'more-info', icon: 'more-info' },
        },
      },
    },
  );

  assert.equal(card.button_type, 'slider');
  assert.equal(card.button_action.tap_action.action, 'more-info');
  assert.equal(card.tap_action.action, 'more-info');
});

test('custom YAML cards are preserved', () => {
  const { createButtonCard } = createBuildersApi('test', {});
  const custom = {
    type: 'custom:bubble-card',
    entity: 'light.test',
    button_type: 'switch',
  };

  assert.strictEqual(createButtonCard({ object: custom }), custom);
});
