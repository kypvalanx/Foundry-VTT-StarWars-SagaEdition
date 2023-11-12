import {SWSEActor} from "../../module/actor/actor.mjs";

function withTestActor(param) {
    SWSEActor.create({
        name: "New Test Actor",
        type: "character",
        img: "artwork/character-profile.jpg"
    }).then(async r => {await param(r); return r}).then(r => r.delete());
}

function getMockEvent() {
    const newVar = {};
    newVar.preventDefault = ()=>{};
    return newVar;
}

export async function tests(quench) {
quench.registerBatch("actor.actor-sheet.classes",
    (context)=>{
        const { describe, it, assert, expect, should } = context;
        describe("Actors should allow classes to be added", ()=>{
            it('should accept a first level of a heroic class', function () {
                withTestActor(async actor => {
                    await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class"})
                    console.log("actor quenched")
                });
            });
        })
    })
}