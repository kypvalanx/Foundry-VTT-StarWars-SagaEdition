import {getEntityRawData} from "../compendium/generation.test.mjs";
import {processActor} from "../../../module/compendium/generation.mjs";
import {SWSEActor} from "../../../module/actor/actor.mjs";

export async function withTestActor(fn, options= {}) {
    const name = "New Test Actor DELETE ME";
    let actor;
    if(options.entity){
        let actorData = await getEntityRawData(options.entity.path, options.entity.name)

        actorData.system.test = true;
        actor = await processActor(actorData);
    } else {
        actor = await SWSEActor.create({
            name: name,
            type: "character",
            img: "artwork/character-profile.jpg"
        })
    }

    actor.suppressDialog = true
    let context = {otherActors:[]}

    try {
        await fn(actor, context);
    } finally {
        for(let a of context.otherActors){
            a.delete()
        }
        await actor.delete();
        game.actors.forEach(a => {if(a.system.test === true){
            a.delete()
        }})
    }
}

export async function withTestVehicle(param, options = {}) {
    const name = "New Test Actor DELETE ME";
    const actor = await SWSEActor.create({
        name: name,
        type: "vehicle",
        img: "artwork/character-profile.jpg"
    })
    try {
        await param(actor);
    } finally {
        await actor.delete();
        game.actors.forEach(a => {
            if (a.name === name) {
                a.delete()
            }
        })
    }
}

export function getMockEvent(data = {}) {
    const newVar = data;
    newVar.preventDefault = () => {
    };
    newVar.stopPropagation = () => {
    };
    return newVar;
}

export function hasItems(assert, actual = [], expected) {
    actual = actual.map(i => i.displayName || i.name || i.value)
    assert.includeMembers(actual, expected)
}

export function notHaveItems(assert, actual, expected) {
    actual = actual.map(i => i.name || i.value)
    assert.notIncludeMembers(actual, expected)
}