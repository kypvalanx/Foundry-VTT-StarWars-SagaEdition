import {generationTests} from "./compendium/generation.test.mjs";
import {actorSheetTests} from "./actor/actor-sheet.test.mjs";
import {attackDelegateTests} from "./actor/attack/attackDelegate.test.mjs";
import {choiceTests} from "./choice/choice.test.mjs";
import {compendiumUtilTests} from "./compendium/compendium-utils.test.mjs";
import {skillHandlerTest} from "./actor/skill-handler.test.mjs";
import {vehicleSheetTests} from "./actor/actor-sheet.vehicle.test.mjs";

export function registerTestSuites(quench) {
    for(const batchFunction of [generationTests]){
        batchFunction(quench);
    }
    for(const batchFunction of [actorSheetTests]){
        batchFunction(quench);
    }
    for(const batchFunction of [vehicleSheetTests]){
        batchFunction(quench);
    }
    for(const batchFunction of [skillHandlerTest]){
        batchFunction(quench);
    }
    for(const batchFunction of [attackDelegateTests]){
        batchFunction(quench);
    }
    for(const batchFunction of [choiceTests]){
        batchFunction(quench);
    }
    // for(const batchFunction of [utilTests]){
    //     batchFunction(quench);
    // }
    for(const batchFunction of [compendiumUtilTests]){
        batchFunction(quench);
    }

}