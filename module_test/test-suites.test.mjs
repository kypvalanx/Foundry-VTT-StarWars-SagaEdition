import {generationTests} from "./compendium/generation.test.mjs";
import {tests} from "./actor/actor-sheet.test.mjs";

export function registerTestSuites(quench) {
    for(const batchFunction of [generationTests]){
        batchFunction(quench);
    }
    for(const batchFunction of [tests]){
        //batchFunction(quench);
    }
}