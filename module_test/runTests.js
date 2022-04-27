import {runPrerequisiteTests} from "./prerequisite.test.js";

export function test(requirement, test) {
    try {
        test()
        return {pass : true, requirement}
    } catch (exception) {
        return {pass: false, exception, requirement}
    }
}

export function expect(message, boolean){
    if(!boolean){
        throw message;
    }
}

export function runTests(){
    console.log("starting tests")

    let responses = [];
    responses.push(...runPrerequisiteTests());

    for (let response of responses){
        if(response.pass){
            console.log(response.requirement)
        } else {
            console.error(response.requirement, response.exception)
        }

    }
    return true;
}