// noinspection JSClosureCompilerSyntax
export const DEFAULT_MODIFICATION_EFFECT = {
    name: "New Modification",
    changes: [],
    icon: "icons/svg/item-bag.svg",
    disabled: false,
    flags: {
        swse: {
            description: "",
            itemModifier: true
        }
    }
};export const DEFAULT_LEVEL_EFFECT = {
    name: "New Level",
    changes: [],
    icon: "icons/svg/item-bag.svg",
    disabled: false,
    flags: {
        swse: {
            description: "",
            isLevel: true
        }
    }
};

// noinspection JSClosureCompilerSyntax
export const DEFAULT_MODE_EFFECT = {
    name: "New Mode",
    changes: [],
    icon: "icons/svg/item-bag.svg",
    disabled: false,
    flags: {
        swse: {
            description: ""
        }
    }
};

export function getDefaultDataByType(itemType) {
    switch (itemType) {
        case "language":
            return {
                attributes: {
                    0: {key: "readable", value: true, override: false},
                    1: {key: "writable", value: true, override: false},
                    2: {key: "spoken", value: true, override: false},
                    3: {key: "characterReads", value: true, override: false},
                    4: {key: "characterWrites", value: true, override: false},
                    5: {key: "characterSpeaks", value: true, override: false},
                    6: {key: "silentCommunication", value: false, override: false},
                    7: {key: "visualCommunication", value: false, override: false}
                }
            }
        default:
            return {};
    }
}