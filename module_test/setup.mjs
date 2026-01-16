// module_test/setup.mjs

import { expect } from 'chai';

// Mock Foundry globals
global.foundry = {
  documents: {
    ActiveEffect: class {},
    Actor: class {},
    Item: class {},
    TokenDocument: class {}
  },
  utils: {
    getProperty: (obj, path) => path.split('.').reduce((o, i) => o?.[i], obj),
    mergeObject: (target, source) => Object.assign(target, source),
  },
  appv1: {
    sheets: {
        ActorSheet: class {},
        ItemSheet: class {}
    }
  },
  canvas: {
    placeables: {
        MeasuredTemplate: class {}
    }
  },
  applications: {
    sidebar: {
      tabs: {
        CompendiumDirectory: class {}
      }
    },
    sheets: {
        ActiveEffectConfig: class {},
        ItemSheet: class {},
        ActorSheet: class {}
    },
    hud: {
        TokenHUD: class {}
    }
  }
};

global.MeasuredTemplate = global.foundry.canvas.placeables.MeasuredTemplate;
global.TokenDocument = global.foundry.documents.TokenDocument;

global.Application = class {};

global.Hooks = {
  once: () => {},
  on: () => {},
  callAll: () => {},
  call: () => {}
};

global.Roll = class {
  constructor(formula, data) {
    this.formula = formula;
    this.data = data;
  }
  evaluate() { return this; }
};

global.CONST = {
  ACTIVE_EFFECT_MODES: {
    CUSTOM: 0,
    MULTIPLY: 1,
    ADD: 2,
    DOWNGRADE: 3,
    UPGRADE: 4,
    OVERRIDE: 5
  }
};

global.Actor = class extends global.foundry.documents.Actor {
  constructor(data = {}) {
    super();
    this.system = data.system || {};
    this.name = data.name || "Unnamed Actor";
    this.flags = data.flags || {};
    this.effects = [];
  }
  prepareData() {}
};

global.Item = class extends global.foundry.documents.Item {
  constructor(data = {}) {
    super();
    this.system = data.system || {};
    this.name = data.name || "Unnamed Item";
  }
  prepareData() {}
};

global.ActiveEffect = global.foundry.documents.ActiveEffect;

global.game = {
  user: { id: "test-user", name: "Test User" },
  settings: {
    get: (scope, key) => {
        if (scope === 'swse' && key === 'defaultAttributeGenerationType') return 'Manual';
        return null;
    }
  },
  packs: {
    get: () => ({ metadata: { packageType: "world" } })
  }
};

global.CONFIG = {
  ActiveEffect: { legacyTransferral: false },
  Actor: { documentClass: global.Actor },
  Item: { documentClass: global.Item }
};

// Add other necessary globals or mocks as needed
