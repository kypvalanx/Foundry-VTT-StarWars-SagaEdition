function getComputerDC(int, attitude){
    let willDefence = getWillDefence(int);
    let checkModifier = getCheckModifier(attitude, int);

    return {willDefence, checkModifier};
}

function getWillDefence(int) {
    if(!int || Number.isNaN(int)){
        return 15;
    }

    let mod = getAttributeMod(int);

    return 15 + mod;
}

function getAttributeMod(attr){
    if(isNaN(attr)){
        throw new Error(`${attr} is not a number`);
    }
    return Math.floor((attr -10)/2);
}

function getCheckModifier(attitude, int){
    attitude = attitude.toUpperCase();
    switch(attitude){
        case "HOSTILE":
            return -10;
        case "UNFRIENDLY":
            return -5;
        case "INDIFFERENT":
            return -2;
        case "FRIENDLY":
        case "HELPFUL":
            return getAttributeMod(int);
    }
    throw new Error(`Unknown Attitude: ${attitude}`);
}

const computerStats = {
    int: "14",
    attitude: "friendly"
}

console.log(getComputerDC(14, "friendly"));
