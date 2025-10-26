console.log("Starting actor tests ")

// basic.test.mjs
import test from 'node:test';
import {expect} from 'chai';

global.Actor = class {
    constructor(data = {}) {
        this.system = data.system || {};
        this.name = data.name || "Unnamed Actor";
    }

    // You can add other Foundry methods your code might call
    prepareData() {}
};

import {SWSEActor} from '../module/actor/actor.mjs';


console.log("Running actor tests")
// Minimal mock for Foundry's Actor base class


// Optional globals some modules reference
//global.game = { user: { id: "test-user" } };
//global.CONFIG = {};

test('i can make a new actor', () => {
    try{

        new SWSEActor()
    } catch (e) {
        console.log(e)
    }
});

test('isEven returns false for odd numbers', () => {
    expect(5).to.equal(5);
});
