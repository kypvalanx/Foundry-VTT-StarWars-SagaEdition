import {expect, test} from "./runTests.mjs";
import {meetsPrerequisites} from "../module/prerequisite.mjs";


export function runPrerequisiteTests() {
    let responses = [];

    responses.push(test("empty requirements always pass", () => {
        let response = meetsPrerequisites({}, undefined)
        expect("empty requirements should pass", !response.doesFail)
    }))


    responses.push(test("empty target cannot pass requirements", () => {
        let response = meetsPrerequisites(undefined, {})
        expect("empty target should fail", response.doesFail)
    }))

    return responses;
}