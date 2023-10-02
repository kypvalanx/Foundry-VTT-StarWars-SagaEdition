import {generationTests} from "./compendium/generation.test.mjs";

export function registerTestSuites(quench) {
    for(const batchFunction of [generationTests]){
        batchFunction(quench);
    }
}