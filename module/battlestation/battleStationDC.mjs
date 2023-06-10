let easy = {
    1: 13,
    2: 14,
    3: 14,
    4: 16,
    5: 16,
    6: 17,
    7: 17,
    8: 18,
    9: 18,
    10: 19,
    11: 19,
    12: 21,
    13: 21,
    14: 22,
    15: 22,
    16: 23,
    17: 23,
    18: 24,
    19: 24,
    20: 26
};
let medium = {
    1: 18,
    2: 19,
    3: 19,
    4: 21,
    5: 21,
    6: 22,
    7: 22,
    8: 23,
    9: 23,
    10: 24,
    11: 24,
    12: 26,
    13: 26,
    14: 27,
    15: 27,
    16: 28,
    17: 28,
    18: 29,
    19: 29,
    20: 31
};
let moderate = {
    1: 23,
    2: 24,
    3: 24,
    4: 26,
    5: 26,
    6: 27,
    7: 27,
    8: 28,
    9: 28,
    10: 29,
    11: 29,
    12: 31,
    13: 31,
    14: 32,
    15: 32,
    16: 33,
    17: 33,
    18: 34,
    19: 34,
    20: 36
};
let hard = {
    1: 26,
    2: 27,
    3: 27,
    4: 29,
    5: 29,
    6: 30,
    7: 30,
    8: 32,
    9: 32,
    10: 33,
    11: 33,
    12: 35,
    13: 35,
    14: 36,
    15: 37,
    16: 38,
    17: 38,
    18: 39,
    19: 39,
    20: 41
};
let heroic = {
    1: 31,
    2: 32,
    3: 32,
    4: 34,
    5: 34,
    6: 35,
    7: 35,
    8: 37,
    9: 37,
    10: 38,
    11: 38,
    12: 40,
    13: 40,
    14: 41,
    15: 42,
    16: 43,
    17: 43,
    18: 44,
    19: 44,
    20: 46
};


const battleStationDCTable = {easy, medium, moderate, hard, heroic};


function getMediumDC(cl) {
    return battleStationDCTable.medium[cl];
}

function getEasyDC(cl) {
    return battleStationDCTable.easy[cl];
}

function getModerateDC(cl) {
    return battleStationDCTable.moderate[cl];
}

function getHardDC(cl) {
    return battleStationDCTable.hard[cl];
}

function getHeroicDC(cl) {
    return battleStationDCTable.heroic[cl];
}