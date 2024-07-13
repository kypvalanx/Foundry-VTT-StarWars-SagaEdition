import {SWSEActor} from "../../module/actor/actor.mjs";
import {getAvailableTrainedSkillCount} from "../../module/actor/skill-handler.mjs";
import {safeInsert} from "../../module/common/util.mjs";
import {SWSERollWrapper} from "../../module/common/roll.mjs";
import {getDiceTermsFromString} from "../../module/actor/attack/attack.mjs";
import {hasItems, withTestActor, withTestVehicle} from "./actor-sheet.test.mjs";


function getMockEvent() {
    const newVar = {};
    newVar.preventDefault = () => {
    };
    return newVar;
}


export async function vehicleSheetTests(quench) {
    quench.registerBatch("actor.actor-sheet.vehicle",
        (context) => {
            const {describe, it, assert, expect, should} = context;
            describe("Actor", () => {
                describe("._sheet", () => {
                    describe("._onDropItem", () => {

                        it('should accept a vehicle base type', async function () {
                            await withTestVehicle(async actor => {
                                actor.suppressDialog = true
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Light Freighter", type: "vehicleBaseType"})
                                hasItems(assert, actor.items, ["Colossal",
                                    "Light Freighter"])
                                assert.equal(actor.size.name, "Colossal")
                                //has changes check the changes on the vehicle base type
                                assert.lengthOf(actor.items, 2)

                                assert.equal(actor.system.attributes.str.total, 42);
                                assert.equal(actor.system.attributes.dex.total, 10);
                                assert.equal(actor.system.attributes.int.total, 12);
                                assert.equal(actor.health.max, 120);

                            });
                        });

                    })
                })
            })
        })
}