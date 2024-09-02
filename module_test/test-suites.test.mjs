import {generationTests} from "./compendium/generation.test.mjs";
import {actorSheetTests} from "./actor/actor-sheet.test.mjs";
import {attackDelegateTests} from "./actor/attack/attackDelegate.test.mjs";
import {choiceTests} from "./choice/choice.test.mjs";
import {compendiumUtilTests} from "./compendium/compendium-utils.test.mjs";
import {skillHandlerTest} from "./actor/skill-handler.test.mjs";
import {vehicleSheetTests} from "./actor/actor-sheet.vehicle.test.mjs";
import {utilTests} from "./common/util.test.js";

const registeredTests = [
    generationTests,
    actorSheetTests,
    vehicleSheetTests,
    skillHandlerTest,
    attackDelegateTests,
    choiceTests,
    utilTests,
    compendiumUtilTests];

export function registerTestSuites(quench) {
    for(const batchFunction of registeredTests){
        batchFunction(quench);
    }
}