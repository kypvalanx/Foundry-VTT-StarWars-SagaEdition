import {
    crunchyCrit,
    doubleDiceCrit,
    doubleValueCrit,
    maxRollCrit
} from "../../../module/actor/attack/attackDelegate.mjs";

export async function attackDelegateTests(quench) {
    quench.registerBatch("attackDelegate",
        (context) => {
            const {describe, it, assert, expect, should} = context;
            describe("attackDelegate", ()=>{
                describe("doubleDiceCrit", ()=>{
                    it("should double dice and numeric terms", ()=>{
                        const roll = Roll.fromTerms(Roll.parse("3d8 + 7"))
                        const critRoll = doubleDiceCrit(roll, 2)
                        assert.equal(critRoll.formula, "6d8 + 14")
                    })

                    it("should triple dice and numeric terms", ()=>{
                        const roll = Roll.fromTerms(Roll.parse("3d8 + 7"))
                        const critRoll = doubleDiceCrit(roll, 3)
                        assert.equal(critRoll.formula, "9d8 + 21")
                    })
                })


                describe("doubleValueCrit", ()=>{
                    it("should double dice and numeric terms", ()=>{
                        const roll = Roll.fromTerms(Roll.parse("3d8 + 7"))
                        const critRoll = doubleValueCrit(roll, 2)
                        assert.equal(critRoll.formula, "3d8 * 2 + 14")
                    })

                    it("should triple dice and numeric terms", ()=>{
                        const roll = Roll.fromTerms(Roll.parse("3d8 + 7"))
                        const critRoll = doubleValueCrit(roll, 3)
                        assert.equal(critRoll.formula, "3d8 * 3 + 21")
                    })
                })


                describe("maxRollCrit", ()=>{
                    it("should double dice and numeric terms", ()=>{
                        const roll = Roll.fromTerms(Roll.parse("3d8 + 7"))
                        const critRoll = maxRollCrit(roll)
                        assert.equal(critRoll.formula, "24[3d8] + 7")
                    })
                })


                describe("crunchyCrit", ()=>{
                    it("should double dice and numeric terms", ()=>{
                        const roll = Roll.fromTerms(Roll.parse("3d8 + 7"))
                        const critRoll = crunchyCrit(roll)
                        assert.equal(critRoll.formula, "3d8 + 7 + 31")
                    })
                })
            })
        })

}