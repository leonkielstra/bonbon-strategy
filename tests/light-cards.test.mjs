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
    test(`${mode} light renders with a bottom brightness slider when ${state}`, () => {
      // Off lights need no current brightness value.
      const attributes = { supported_color_modes: [mode] };
      if (state === 'on') attributes.brightness = 128;

      const card = buildLight(attributes, { state });

      assert.equal(card.type, 'custom:bubble-card');
      assert.equal(card.card_type, 'button');
      assert.equal(card.button_type, 'state');
      assert.equal(card.styles, undefined);
      assert.equal(card.entity, 'light.test');
      assert.equal(card.button_action.tap_action.action, 'more-info');
      assert.equal(card.tap_action.action, 'more-info');
      assert.equal(card.sub_button.bottom[0].sub_button_type, 'slider');
      assert.equal(card.sub_button.bottom[0].entity, 'light.test');
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
  assert.equal(card.button_type, 'state');
  assert.equal(card.sub_button.bottom[0].sub_button_type, 'slider');
});

test('dimmable light uses a tall state card with power and brightness controls', () => {
  const card = buildLight({ supported_color_modes: ['brightness'] });

  assert.equal(card.icon, undefined);
  assert.equal(card.scrolling_effect, false);
  assert.equal(card.show_name, true);
  assert.equal(card.show_icon, true);
  assert.equal(card.rows, 1.719);
  assert.equal(card.slider_live_update, undefined);
  assert.equal(card.tap_to_slide, undefined);
  assert.equal(card.use_accent_color, undefined);
  assert.equal(card.show_state, undefined);
  assert.equal(card.show_last_changed, undefined);
  assert.deepEqual(card.sub_button, {
    main: [
      {
        entity: 'light.test',
        icon: 'mdi:power-cycle',
        show_background: true,
        light_background: false,
        show_icon: true,
        hide_when_parent_unavailable: false,
        tap_action: { action: 'toggle' },
      },
    ],
    bottom: [
      {
        entity: 'light.test',
        sub_button_type: 'slider',
        state_background: true,
        state_content: 'brightness',
        light_background: true,
        show_icon: false,
        show_background: true,
        scrolling_effect: false,
        slider_live_update: true,
        relative_slide: false,
        tap_to_slide: false,
        use_accent_color: false,
        allow_light_slider_to_0: false,
        light_transition: true,
        fill_width: true,
        always_visible: true,
        show_button_info: false,
      },
    ],
  });
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

test('configured tap actions are preserved on dimmable light cards', () => {
  const card = buildLight(
    { supported_color_modes: ['brightness'] },
    {
      config: {
        actions: {
          light: { button: 'toggle', icon: 'toggle' },
        },
      },
    },
  );

  assert.equal(card.button_type, 'state');
  assert.equal(card.button_action.tap_action.action, 'toggle');
  assert.equal(card.tap_action.action, 'toggle');
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
