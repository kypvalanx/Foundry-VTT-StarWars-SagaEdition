import {explodeOptions} from "../../../module/choice/choice.mjs";
import {
    resolveExpression,
    resolveExpressionReduce,
    resolveValueArray,
    resolveWeight
} from "../../../module/common/util.mjs";

const ADD = CONST.ACTIVE_EFFECT_MODES.ADD
const MULTIPLY = CONST.ACTIVE_EFFECT_MODES.MULTIPLY
const UPGRADE = CONST.ACTIVE_EFFECT_MODES.UPGRADE
const DOWNGRADE = CONST.ACTIVE_EFFECT_MODES.DOWNGRADE
const OVERRIDE = CONST.ACTIVE_EFFECT_MODES.OVERRIDE
const CUSTOM = CONST.ACTIVE_EFFECT_MODES.CUSTOM
const POST_ROLL_MULTIPLY = 6;

export async function utilTests(quench) {
    quench.registerBatch("util",
        (context) => {
            const {describe, it, assert, expect, should} = context;
            describe("util", ()=>{
                describe("resolveExpressionReduce", ()=>{
                    it("should default to a first term of 0 if no obvious term is applied", async () =>{
                        assert.equal( resolveExpressionReduce([{value: 5, mode: MULTIPLY}], {}), 0)
                    })

                    it("should add first then multiply", async () => {
                        assert.equal(25, resolveExpressionReduce([{value: 5, mode: ADD}, {value: 5, mode: MULTIPLY}], {}))
                    })

                    it("should select the highest average value when upgrading", async () => {
                        assert.equal(7, resolveExpressionReduce([{value: 5, mode: ADD}, {value: 7, mode: UPGRADE}], {}))
                        assert.equal(5, resolveExpressionReduce([{value: 5, mode: ADD}, {value: 3, mode: UPGRADE}], {}))
                        assert.equal("1d8", resolveExpressionReduce([{value: 5, mode: ADD}, {value: "1d8", mode: UPGRADE}], {}))
                        //assert.equal("5d8 + 3d6", resolveExpressionReduce([{value: "2d6 + 5d8 + 1d6", mode: ADD}, {value: "1d8", mode: UPGRADE}], {}))
                    })

                    it("should select the lowest average value when downgrading", async () => {
                        assert.equal(5, resolveExpressionReduce([{value: 5, mode: ADD}, {value: 7, mode: DOWNGRADE}], {}))
                        assert.equal(3, resolveExpressionReduce([{value: 5, mode: ADD}, {value: 3, mode: DOWNGRADE}], {}))
                    })

                    it("should resolve lower number priority first", async () => {
                        assert.equal(13, resolveExpressionReduce([
                            {value: 5, mode: ADD, priority: -1},
                            {value: 5, mode: ADD, priority: 2},
                            {value: 3, mode: ADD}
                        ], {}))
                        assert.equal(8, resolveExpressionReduce([
                            {value: 50, mode: MULTIPLY, priority: -1},
                            {value: 5,mode: ADD,priority: 2},
                            {value: 3, mode: ADD}
                        ], {}))
                    })

                    it("should add tagged numbers correctly", async ()=>{
                        assert.equal(`["ammo:155"]`, JSON.stringify(resolveExpressionReduce([{value: "ammo:100", mode: ADD},{value: "ammo:55", mode: ADD}], {})))
                        assert.equal(`["ammo:100","ammo2:55"]`, JSON.stringify(resolveExpressionReduce([{value: "ammo:100", mode: ADD},{value: "ammo2:55", mode: ADD}], {})))
                    })
                })

                describe("resolveWeight", ()=>{
                    it("should return the number of kilograms that something weighs", async ()=>{
                        assert.equal(5, resolveWeight("5", 1, 5))
                        assert.equal(5, resolveWeight("5 kg", 1, 5))
                        assert.equal(5, resolveWeight("5 KG", 1, 5))
                        assert.equal(5, resolveWeight("5 KiloGrams", 1, 5))
                        assert.equal(5000, resolveWeight("5 Ton", 1, 5))
                        assert.equal(5, resolveWeight(5, 1, 5))
                    })
                    it("should respect quantity when resolving weight", async ()=>{
                        assert.equal(15, resolveWeight(5, 3, 5))
                        assert.equal(0, resolveWeight(5, 0, 5))
                    })
                    it("should resolve a provided cost factor", async ()=>{
                        assert.equal(200, resolveWeight("(40 x Cost Factor) kg", 1, 5))
                    })

                })

                describe("resolveValueArray", ()=>{
                    it("should handle no parameters", async ()=>{
                        

                        assert.equal(12, resolveValueArray(["2", 4, "*2"], null))
                        assert.equal(2, resolveValueArray(["+2"], null))
                        assert.equal(24, resolveValueArray(["2", 4, "*2", "*4", "/2"], null))

                    })

                })

                describe("resolveExpression", ()=>{
                    it("should handle basic math", async ()=>{
                        assert.equal(resolveExpression("+2", null),2)
                        assert.equal(resolveExpression("-5", null),-5)
                        assert.equal(resolveExpression("-5-5", null),-10)
                        assert.equal(resolveExpression("-5--5", null), 0)
                        assert.equal(1, resolveExpression("1+2-3+5-4", null))
                        assert.equal(-9, resolveExpression("1+2-(3+5)-4", null))
                        assert.equal(27, resolveExpression("3*9", null))
                        assert.equal(39, resolveExpression("3+4*9", null))
                        assert.equal(-24, resolveExpression("-3*8", null))
                        assert.equal(-24, resolveExpression("3*-8", null))
                    })
                })

                describe("resolveExpression", ()=>{
                    it("should handle MIN and MAX functions", async ()=>{
                        assert.equal(resolveExpression("MAX(1,5)", null), 5)
                        assert.equal(resolveExpression("MIN(1,5)", null), 1)
                        assert.equal(resolveExpression("MAX(1,5)+4", null), 9)
                        assert.equal(resolveExpression("MAX(1,5)+MAX(1,5)", null), 10)
                        assert.equal(resolveExpression("MAX(1,MAX(2,5))+3", null), 8)
                    })
                })

                describe("resolveExpression", ()=>{
                    it("should keep dice expressions separate", async ()=>{
                        assert.equal(resolveExpression("3d6+3", null), "3d6 + 3")
                    })
                })

                describe("innerJoin", ()=>{
                    it("should handle no parameters", async ()=>{



                        // console.log( '[1,2,3,4,5]' === JSON.stringify(innerJoin([1,2,3,4,5])))
                        // console.log( '[2,3,4]' === JSON.stringify(innerJoin([1,2,3,4,5], [2,3,4])))
                        // console.log( '[2,3,4]' === JSON.stringify(innerJoin(...[[1,2,3,4,5], [2,3,4]])))
                        // console.log( '[3]' === JSON.stringify(innerJoin([1,2,3,4,5], [2,3,4], [3])))
                        // console.log( '[]' === JSON.stringify(innerJoin([1,2,3,4,5], [2,3,4], [1])))

                    })

                })
            })
        });
}