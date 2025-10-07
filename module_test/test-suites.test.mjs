import {generationTests} from "./compendium/generation.test.mjs";
import {actorSheetTests} from "./actor/actor-sheet.test.mjs";
import {attackDelegateTests} from "./actor/attack/attackDelegate.test.mjs";
import {choiceTests} from "./choice/choice.test.mjs";
import {compendiumUtilTests} from "./compendium/compendium-utils.test.mjs";
import {skillHandlerTest} from "./actor/skill-handler.test.mjs";
import {vehicleSheetTests} from "./actor/actor-sheet.vehicle.test.mjs";
import {utilTests} from "./common/util.test.js";
import {attackTests} from "./actor/attack/attack.test.mjs";
import {poltgotBasicTests} from "./module-integrations/polygot/basic-integration.test.mjs";
import {defenseTests} from "./actor/actor-sheet.defense.test.mjs";
import {featTests} from "./actor/actor-sheet.feats-martial-artist.mjs";
import {healthTests} from "./actor/actor-sheet.health.test.mjs";
import {featMulticlassTests} from "./actor/actor-sheet.feats-multiclass-starting-feats.mjs";

const registeredTests = [
    generationTests,
    actorSheetTests,
    vehicleSheetTests,
    skillHandlerTest,
    attackDelegateTests,
    choiceTests,
    utilTests,
    compendiumUtilTests,
    attackTests,
    poltgotBasicTests,
    defenseTests,
    featTests,
    healthTests,
    featMulticlassTests
];

export function registerTestSuites(quench) {

    quench.mocha.setup({timeout: 10000})
    for(const batchFunction of registeredTests){
        batchFunction(quench);
    }
}