import test from 'node:test';
import assert from 'node:assert/strict';
import { createEntityApi } from '../bonbon-strategy-entities.js';

globalThis.window = { customCards: [], cardMod_patch_state: true };
globalThis.document = {
  querySelector: () => null,
  documentElement: { style: { setProperty() {}, removeProperty() {} } },
};
globalThis.MutationObserver = class { observe() {} };
globalThis.customElements = { define() {} };
const { BonbonStrategy } = await import('../bonbon-strategy.js');

function fixture() {
  const entities = {};
  const states = {};
  const add = (entity_id, device_id, extra = {}) => {
    entities[entity_id] = { entity_id, device_id, ...extra };
    states[entity_id] = { state: 'off', attributes: { friendly_name: entity_id } };
  };
  add('switch.oven_power', 'oven');
  add('button.oven_start', 'oven');
  add('select.oven_mode', 'oven');
  // A real device reading can be diagnostic or have its own area assignment.
  add('sensor.oven_temperature', 'oven', { entity_category: 'diagnostic', area_id: 'other' });
  add('sensor.oven_unavailable', 'oven');
  states['sensor.oven_unavailable'].state = 'unavailable';
  add('sensor.oven_hidden', 'oven', { hidden: true });
  add('sensor.oven_hidden_label', 'oven', { labels: ['bonbon_hidden'] });
  add('sensor.oven_disabled', 'oven', { disabled_by: 'user' });
  add('sensor.oven_config', 'oven', { entity_category: 'config' });
  add('sensor.oven_missing_state', 'oven');
  delete states['sensor.oven_missing_state'];
  add('switch.single', 'single');
  add('input_boolean.helper', undefined, { area_id: 'kitchen' });
  return {
    panelUrl: 'test',
    entities,
    states,
    panels: {},
    config: {},
    floors: {},
    devices: {
      oven: { id: 'oven', area_id: 'kitchen', name: 'Default oven', name_by_user: 'My oven' },
      single: { id: 'single', area_id: 'kitchen', name: 'Single' },
    },
    areas: {
      kitchen: { area_id: 'kitchen', name: 'Kitchen', labels: [] },
      other: { area_id: 'other', name: 'Other', labels: [] },
    },
  };
}

async function generate(sectionOptions = {}, extraViews = {}) {
  const log = console.log;
  console.log = () => {};
  try {
    const dashboard = await BonbonStrategy.generate(
      {
        views: {
          bonbon_home: { disabled: true },
          bonbon_area: { sections: { bonbon_switches: sectionOptions } },
          ...extraViews,
        },
      },
      fixture(),
    );
    assert.ok(dashboard.views.every((view) => view.path !== 'error'), 'generation succeeds');
    return dashboard;
  } finally {
    console.log = log;
  }
}

function flatten(cards) {
  return cards.flatMap((card) => [card, ...flatten(card.cards || [])]);
}

function cardsFor(view) {
  return flatten(view.sections.flatMap((section) => section.cards));
}

test('grouping remains opt-in', async () => {
  const dashboard = await generate();
  const cards = cardsFor(dashboard.views.find((view) => view.path === 'bonbon_area_kitchen'));
  assert.equal(cards.filter((card) => card.card_type === 'pop-up').length, 0);
  assert.ok(cards.some((card) => card.entity === 'switch.oven_power'));
  assert.ok(cards.some((card) => card.entity === 'button.oven_start'));
});

test('one selected switch produces a device button and one native entity list across domains', async () => {
  const dashboard = await generate({ group_by_device: true, cards: 'switch.oven_power' });
  const view = dashboard.views.find((view) => view.path === 'bonbon_area_kitchen');
  const cards = cardsFor(view);
  const popup = cards.find((card) => card.card_type === 'pop-up');
  assert.equal(popup.name, 'My oven');
  assert.equal(popup.cards.length, 1);
  assert.equal(popup.cards[0].type, 'entities');
  assert.equal(popup.cards[0].show_header_toggle, false);
  assert.deepEqual(popup.cards[0].entities, [
    'button.oven_start',
    'select.oven_mode',
    'sensor.oven_temperature',
    'sensor.oven_unavailable',
    'switch.oven_power',
  ]);
  const launcher = cards.find((card) => card.button_action?.tap_action?.navigation_path === popup.hash);
  assert.equal(launcher.name, 'My oven');
  assert.equal(launcher.button_type, 'name');
  assert.equal(launcher.entity, undefined);
  assert.equal(launcher.tap_action.navigation_path, popup.hash);
  assert.equal(popup.styles, undefined, 'popup retains Bubble Card layout');
  assert.equal(popup.card_mod, undefined);
  assert.equal(popup.cards[0].card_mod, undefined, 'native rows retain HA styling even with card-mod installed');
  assert.ok(launcher.styles, 'dashboard launcher still uses Bonbon styling');
  assert.ok(cards.some((card) => card.entity === 'sensor.oven_unavailable'), 'other sections keep their cards');
});

test('device details include readings and unavailable entities, filtering hidden, disabled, config and missing states', () => {
  const api = createEntityApi(fixture());
  assert.deepEqual(api.getDeviceEntities('oven'), [
    'button.oven_start',
    'select.oven_mode',
    'sensor.oven_temperature',
    'sensor.oven_unavailable',
    'switch.oven_power',
  ]);
  assert.deepEqual(api.getDeviceEntities('single'), ['switch.single']);
  assert.deepEqual(api.getDeviceEntities('missing'), []);
});

test('multiple matching controls produce one launcher per device and preserve helpers', async () => {
  const dashboard = await generate({
    group_by_device: true,
    cards: ['switch.*', 'button.*', 'select.*', 'input_boolean.*', 'switch.oven_power'],
  });
  const view = dashboard.views.find((view) => view.path === 'bonbon_area_kitchen');
  const cards = cardsFor(view);
  const popups = cards.filter((card) => card.card_type === 'pop-up');
  assert.deepEqual(popups.map((card) => card.name).sort(), ['My oven', 'Single']);
  for (const popup of popups) {
    assert.equal(new Set(popup.cards[0].entities).size, popup.cards[0].entities.length);
    assert.equal(cards.filter((card) => card.button_action?.tap_action?.navigation_path === popup.hash).length, 1);
  }
  assert.ok(cards.some((card) => card.entity === 'input_boolean.helper'));
  assert.ok(!cards.some((card) => card.entity === 'switch.oven_power'));
});

test('explicit YAML cards and runtime hide selectors retain their individual behavior', async () => {
  const custom = { type: 'custom:bubble-card', entity: 'switch.oven_power', name: 'Explicit' };
  const dashboard = await generate({ group_by_device: true, cards: [custom, 'switch.single:hide([state=off])'] });
  const cards = cardsFor(dashboard.views.find((view) => view.path === 'bonbon_area_kitchen'));
  assert.ok(cards.some((card) => card.name === 'Explicit'));
  assert.ok(cards.some((card) => card.entity === 'switch.single' && card.styles.includes('[state=off]')));
  assert.ok(!cards.some((card) => card.card_type === 'pop-up'));
});

test('device popup hashes remain unique across sections and views', async () => {
  const dashboard = await generate(
    { group_by_device: true, cards: 'switch.oven_power' },
    {
      custom: {
        sections: {
          first: { group_by_device: true, cards: 'switch.oven_power' },
          second: { group_by_device: true, cards: 'switch.oven_power' },
        },
      },
    },
  );
  const hashes = dashboard.views
    .flatMap(cardsFor)
    .filter((card) => card.card_type === 'pop-up')
    .map((card) => card.hash);
  assert.equal(hashes.length, 3);
  assert.equal(new Set(hashes).size, 3);
});
