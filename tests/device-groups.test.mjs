import test from 'node:test';
import assert from 'node:assert/strict';
import { createBuildersApi } from '../bonbon-strategy-builders.js';

globalThis.window = { customCards: [] };
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
  add('sensor.oven_temperature', 'oven');
  add('switch.oven_hidden', 'oven', { hidden: true });
  add('switch.oven_diagnostic', 'oven', { entity_category: 'diagnostic' });
  add('switch.oven_other_area', 'oven', { area_id: 'other' });
  add('switch.single', 'single');
  add('input_boolean.helper', undefined, { area_id: 'kitchen' });
  return {
    panelUrl: 'test', entities, states,
    panels: {}, config: {},
    devices: {
      oven: { id: 'oven', area_id: 'kitchen', name: 'Default oven', name_by_user: 'My oven' },
      single: { id: 'single', area_id: 'kitchen', name: 'Single' },
    },
    areas: { kitchen: { area_id: 'kitchen', name: 'Kitchen', labels: [] }, other: { area_id: 'other', name: 'Other', labels: [] } },
    floors: {},
  };
}

async function generate(sectionOptions = {}, extraViews = {}) {
  const log = console.log;
  console.log = () => {};
  try {
    const dashboard = await BonbonStrategy.generate({ views: {
      bonbon_home: { disabled: true },
      bonbon_area: { sections: { bonbon_switches: sectionOptions } },
      ...extraViews,
    } }, fixture());
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

test('device grouping is opt-in and preserves default entity cards', async () => {
  const dashboard = await generate();
  const cards = cardsFor(dashboard.views.find((view) => view.path === 'bonbon_area_kitchen'));
  assert.equal(cards.filter((card) => card.card_type === 'pop-up').length, 0);
  assert.ok(cards.some((card) => card.entity === 'switch.oven_power'));
  assert.ok(cards.some((card) => card.entity === 'button.oven_start'));
});

test('switch section generates one device launcher with all visible device entities inside its popup', async () => {
  const dashboard = await generate({ group_by_device: true });
  const view = dashboard.views.find((view) => view.path === 'bonbon_area_kitchen');
  const cards = cardsFor(view);
  const popup = cards.find((card) => card.card_type === 'pop-up' && card.name === 'My oven');
  assert.equal(cards.filter((card) => card.card_type === 'pop-up').length, 2);
  assert.equal(popup.name, 'My oven');
  assert.deepEqual(popup.cards.map((card) => card.entity).sort(), [
    'button.oven_start', 'select.oven_mode', 'sensor.oven_temperature', 'switch.oven_power',
  ]);
  const launcher = cards.find((card) => card.button_action?.tap_action?.action === 'navigate');
  assert.equal(launcher.button_action.tap_action.navigation_path, popup.hash);
  assert.equal(launcher.tap_action.navigation_path, popup.hash);
  assert.equal(launcher.entity, undefined);
  assert.equal(launcher.button_type, 'name');
  assert.equal(launcher.name, 'My oven');
  assert.equal(popup.cards.find((card) => card.entity === 'select.oven_mode').card_type, 'select');
  assert.equal(popup.cards.find((card) => card.entity === 'switch.oven_power').button_action.tap_action.action, 'toggle');
  // The sensor remains outside the popup in its original section.
  assert.ok(cards.some((card) => card.entity === 'sensor.oven_temperature'));
  assert.ok(cards.some((card) => card.entity === 'switch.single'));
  assert.ok(cards.some((card) => card.entity === 'input_boolean.helper'));
  const outsidePopup = flatten(view.sections.flatMap((section) => section.cards)
    .filter((card) => card.card_type !== 'pop-up'));
  assert.equal(outsidePopup.filter((card) => card.entity === 'switch.oven_power').length, 0);
  assert.equal(outsidePopup.filter((card) => card.entity === 'switch.single').length, 0);
  assert.ok(outsidePopup.some((card) => card.name === 'Single' && card.button_type === 'name'));
  assert.ok(popup.styles, 'global styling reaches popup');
  assert.ok(popup.cards.every((card) => card.styles), 'global styling reaches popup controls');
});

test('one selected oven switch opens a popup with all visible oven entities', async () => {
  const dashboard = await generate({ group_by_device: true, cards: 'switch.oven_power' });
  const view = dashboard.views.find((view) => view.path === 'bonbon_area_kitchen');
  const cards = cardsFor(view);
  const popup = cards.find((card) => card.card_type === 'pop-up');
  assert.equal(popup.name, 'My oven');
  assert.deepEqual(popup.cards.map((card) => card.entity).sort(), [
    'button.oven_start', 'select.oven_mode', 'sensor.oven_temperature', 'switch.oven_power',
  ]);
  const launcher = cards.find((card) => card.button_action?.tap_action?.navigation_path === popup.hash);
  assert.equal(launcher.name, 'My oven');
  assert.equal(launcher.button_type, 'name');
  assert.equal(launcher.entity, undefined);
});

test('expanding a device popup preserves selected hide rules and excludes hidden, diagnostic and other-area entities', async () => {
  const dashboard = await generate({ group_by_device: true, cards: 'switch.oven_power:hide([state=off])' });
  const cards = cardsFor(dashboard.views.find((view) => view.path === 'bonbon_area_kitchen'));
  const popup = cards.find((card) => card.card_type === 'pop-up');
  const power = popup.cards.find((card) => card.entity === 'switch.oven_power');
  assert.ok(power.styles.includes('[state=off]'));
  assert.ok(popup.cards.some((card) => card.entity === 'sensor.oven_temperature'));
  for (const excluded of ['switch.oven_hidden', 'switch.oven_diagnostic', 'switch.oven_other_area', 'switch.single']) {
    assert.ok(!popup.cards.some((card) => card.entity === excluded), `${excluded} is excluded`);
  }
});

test('explicit YAML cards remain outside device groups and duplicate selectors do not duplicate popup controls', async () => {
  const custom = { type: 'custom:bubble-card', entity: 'switch.oven_power', name: 'Explicit' };
  const dashboard = await generate({
    group_by_device: true,
    cards: ['switch.*', 'button.*', 'switch.oven_power', custom],
  });
  const cards = cardsFor(dashboard.views.find((view) => view.path === 'bonbon_area_kitchen'));
  const popup = cards.find((card) => card.card_type === 'pop-up');
  assert.equal(popup.cards.filter((card) => card.entity === 'switch.oven_power').length, 1);
  assert.ok(cards.some((card) => card.name === 'Explicit'));
});

test('popup hashes differ across sections and views', async () => {
  const dashboard = await generate({ group_by_device: true }, {
    custom: { sections: {
      first: { group_by_device: true, cards: ['switch.oven_power', 'button.oven_start'] },
      second: { group_by_device: true, cards: ['switch.oven_power', 'button.oven_start'] },
    } },
  });
  const hashes = dashboard.views.flatMap(cardsFor).filter((card) => card.card_type === 'pop-up').map((card) => card.hash);
  assert.equal(hashes.length, 5);
  assert.equal(new Set(hashes).size, 5);
});

test('popup controls retain hide rules without hiding the parent dashboard section', () => {
  const api = createBuildersApi('test', {});
  const sectionConfig = { key: 'switches', display_var: '--parent-display', next_margin_var: '--next-margin' };
  const cards = ['switch.oven', 'button.oven'].map((entity_id) => ({
    entity: { entity_id, device_id: 'oven', name: entity_id }, hide: '[state=off]',
  }));
  const [{ deviceGroup }] = api.groupDeviceCards(cards, sectionConfig, 'kitchen');
  const { popup } = api.createDeviceCards(deviceGroup);
  assert.ok(popup.cards.every((card) => card.styles.includes('[state=off]')));
  assert.ok(popup.cards.every((card) => !card.styles.includes('--parent-display')));
});
