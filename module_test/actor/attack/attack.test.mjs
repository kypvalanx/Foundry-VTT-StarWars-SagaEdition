import {appendTerms} from "../../../module/common/util.mjs";

export async function attackTests(quench) {
    quench.registerBatch("attack",
        (context) => {
            const {describe, it, assert, expect, should} = context;
            describe("appendTerm", () => {
                it("should append the term", async () => {
                    assert.equal(`[{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"+"}` +
                        `,{"class":"NumericTerm","options":{"flavor":"bonus"},"evaluated":false,"number":1}]`, JSON.stringify(appendTerms(1, "bonus")))
                })
                it("should append the term", async () => {
                    assert.equal(`[{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"-"}` +
                        `,{"class":"NumericTerm","options":{"flavor":"bonus"},"evaluated":false,"number":2}]`, JSON.stringify(appendTerms("-2", "bonus")))
                })
                it("should append the term", async () => {
                    assert.equal(`[{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"-"}` +
                        `,{"class":"Die","options":{"flavor":"bonus"},"evaluated":false,"number":4,"faces":10,"modifiers":[],"results":[]}]`, JSON.stringify(appendTerms("-4d10", "bonus")))
                })
                it("should append the term", async () => {
                    assert.equal(`[{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"-"}` +
                        `,{"class":"Die","options":{"flavor":"bonus"},"evaluated":false,"number":4,"faces":10,"modifiers":[],"results":[]}` +
                        `,{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"-"},` +
                        `{"class":"Die","options":{"flavor":"bonus"},"evaluated":false,"number":6,"faces":4,"modifiers":[],"results":[]},` +
                        `{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"+"},` +
                        `{"class":"NumericTerm","options":{"flavor":"bonus"},"evaluated":false,"number":9}]`, JSON.stringify(appendTerms("-4d10-6d4+9", "bonus")))
                })
                it("should append the term", async () => {
                    assert.equal(`[{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"+"}` +
                        `,{"class":"NumericTerm","options":{"flavor":"bomb"},"evaluated":false,"number":1}` +
                        `,{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"+"}` +
                        `,{"class":"Die","options":{"flavor":"bomb"},"evaluated":false,"number":3,"faces":6,"modifiers":[],"results":[]}]`, JSON.stringify(appendTerms("1+3d6", "bomb")))
                })
            })
        })
}