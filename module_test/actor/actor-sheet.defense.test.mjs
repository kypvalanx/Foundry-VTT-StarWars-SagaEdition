import {SWSEActor} from "../../module/actor/actor.mjs";
import {getAvailableTrainedSkillCount} from "../../module/actor/skill-handler.mjs";
import {SWSERollWrapper} from "../../module/common/roll.mjs";
import {getDiceTermsFromString} from "../../module/actor/attack/attack.mjs";
import {withTestActor} from "./actor-sheet.test.mjs";

export function getMockEvent(data = {}) {
    const newVar = data;
    newVar.preventDefault = () => {
    };
    newVar.stopPropagation = () => {
    };
    return newVar;
}

export function hasItems(assert, actual = [], expected) {
    actual = actual.map(i => i.name || i.value)
    assert.includeMembers(actual, expected)
}
export function notHaveItems(assert, actual, expected) {
    actual = actual.map(i => i.name || i.value)
    assert.notIncludeMembers(actual, expected)
}

export async function defenseTests(quench) {
    quench.registerBatch("actor.actor-sheet.character.defenses",
        (context) => {
            const {describe, it, assert, expect, should} = context;
            describe("Actor", () => {
                describe("._sheet", () => {
                    describe("._onDropItem", () => {

                        it('rancors should have their intended defense stats', async function () {
                            await withTestActor(async actor => {
                                assert.equal(actor.defense.reflex.total, 17, "reflex");
                                assert.equal(actor.defense.reflex.defenseModifiers[0].total, 17, "FFReflex");
                                assert.equal(actor.defense.fortitude.total, 16, "Fortitude");
                                assert.equal(actor.defense.will.total, 8, "Will");
                            }, {entity: {path: "systems/swse/module_test/resources/rancor.json", name: "Rancor"}});
                        });



                    })
                })
            })

        })
}