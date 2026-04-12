console.log("Starting actor tests ")

import test from 'node:test';
import {expect} from 'chai';
import SWSEActor from '../module/actor/actor.mjs';

test('SWSEActor instantiation', () => {
    const actor = new SWSEActor({
        name: "Test Character",
        system: {
            abilities: {
                str: { value: 10 },
                dex: { value: 12 },
                con: { value: 14 },
                int: { value: 8 },
                wis: { value: 13 },
                cha: { value: 15 }
            }
        }
    });
    expect(actor.name).to.equal("Test Character");
    expect(actor.system.abilities.str.value).to.equal(10);
});

test('SWSEActor levelSummary and firstAid', async () => {
    const actor = new SWSEActor({
        name: "Test Character",
        system: {}
    });
    actor.itemTypes.class = [{
        levelsTaken: [1, 2, 3],
        id: "class-id",
        name: "Jedi",
        canRerollHealth: () => false,
        classLevelHealth: () => 10
    }];
    
    expect(actor.levelSummary).to.equal(3);
    expect(actor.firstAid.perDay).to.equal(1);
});

test('SWSEActor forcePoints calculation at higher level', async () => {
    const actor = new SWSEActor({
        name: "Test Character",
        system: {
            forcePoints: 5
        }
    });
    // Level 15
    actor.itemTypes.class = [{
        levelsTaken: Array.from({length: 15}, (_, i) => i + 1),
        id: "class-id",
        name: "Jedi",
        canRerollHealth: () => false,
        classLevelHealth: () => 10
    }];
    
    const fp = actor.forcePoints;
    expect(fp.quantity).to.equal(5);
    expect(fp.roll).to.equal("3d6kh"); // Level 15 -> 3d6
});
