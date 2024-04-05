import {generationTests} from "./compendium/generation.test.mjs";
import {actorSheetTests} from "./actor/actor-sheet.test.mjs";
import {attackDelegateTests} from "./actor/attack/attackDelegate.test.mjs";

export function registerTestSuites(quench) {
    for(const batchFunction of [generationTests]){
        //batchFunction(quench);
    }
    for(const batchFunction of [actorSheetTests]){
        batchFunction(quench);
    }
    for(const batchFunction of [attackDelegateTests]){
        batchFunction(quench);
    }

}