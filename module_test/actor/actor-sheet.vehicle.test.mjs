import {hasItems, withTestActor, withTestVehicle} from "./actor-sheet.test.mjs";
import {getInheritableAttribute} from "../../module/attribute-helper.mjs";


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

                                assert.equal(actor.system.attributes.str.total, 42);
                                assert.equal(actor.system.attributes.dex.total, 10);
                                assert.equal(actor.system.attributes.int.total, 12);
                                assert.equal(actor.health.max, 120);

                                //assert.equal(actor.system.defense.reflex.total, 10)
                            });
                        });

                        it('should accept a vehicle base type', async function () {
                            await withTestVehicle(async actor => {
                                actor.suppressDialog = true
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Light Freighter", type: "vehicleBaseType"})
                                hasItems(assert, actor.items, ["Colossal",
                                    "Light Freighter"])

                                const reflexDefense = getInheritableAttribute({
                                    entity: actor,
                                    attributeKey: "reflexDefenseBonus",
                                    reduce: ["SUM", "SUMMARY", "MAPPED"],
                                    attributeFilter: attr => !attr.modifier
                                }, {skipCache:true})

                                const armorReflexDefenseBonus = getInheritableAttribute({
                                    entity: actor,
                                    attributeKey: "armorReflexDefenseBonus",
                                    reduce: ["SUM", "SUMMARY", "MAPPED"],
                                    attributeFilter: attr => !attr.modifier
                                }, {skipCache:true})

                                assert.equal(reflexDefense["SUM"], -10)
                                assert.equal(armorReflexDefenseBonus["SUM"], 12)
                                assert.equal(actor.system.defense.reflex.total, 12)

                            });
                        });
                    })
                })
            })
        })
}