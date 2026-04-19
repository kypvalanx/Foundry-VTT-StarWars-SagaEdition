import {withTestActor} from "./actor-utils.mjs";

export async function skillHandlerTest(quench) {
    quench.registerBatch("actor.skill-handler",
        (context) => {
            const {describe, it, assert, expect, should} = context;
            describe("skill-handler", () => {
                it('should successfully build skills', async function () {
                    await withTestActor(async actor => {
                        actor.suppressDialog = true
                        let skills = Object.values(actor.system.skills)
                        assert.lengthOf(skills, 25)
                    });
                });

                it('should successfully build skills when a grouper is provided', async function () {
                    await withTestActor(async actor => {
                        actor.suppressDialog = true

                        let groupedSkillMap = new Map();
                        groupedSkillMap.set("Athletics", {grouped: ["Jump", "Climb", "Swim"], classes: ["Scout", "Soldier", "Jedi"], uut: true})

                        actor.system._prepareSkillDerivedData({groupedSkillMap})
                        let skills = Object.values(actor.system.skills)
                        assert.lengthOf(skills, 23)
                        let skill = actor.system.skills["Athletics"]
                        assert.lengthOf(skill.situationalSkills, 3)
                    });
                });

                it('should successfully add appropriate attribute mod', async function () {
                    await withTestActor(async actor => {
                        actor.suppressDialog = true
                        await actor.setAttributes({int:18})

                        actor.system._prepareSkillDerivedData()
                        let skills = Object.values(actor.system.skills)

                        assert.lengthOf(skills, 25)
                        assert.equal(actor.system.skills["Knowledge (Bureaucracy)"].value, 4)
                    });
                });

                it('should successfully add appropriate skillBonus', async function () {
                    await withTestActor(async actor => {
                        actor.suppressDialog = true
                        await actor.addChange({key:"skillBonus", value:"Knowledge (Bureaucracy):4"})

                        actor.system._prepareSkillDerivedData()
                        let skills = Object.values(actor.system.skills)

                        assert.lengthOf(skills, 25)
                        assert.equal(actor.system.skills["Knowledge (Bureaucracy)"].value, 4)
                    });
                });

                it('should create situational bonuses when an unknown skill is modified that is prefixed with another skill', async function () {
                    await withTestActor(async actor => {
                        actor.suppressDialog = true
                        await actor.addChange({key:"skillBonus", value:"Knowledge (Bureaucracy) (Watercooler Talk):4"})

                        actor.system._prepareSkillDerivedData()
                        let skills = Object.values(actor.system.skills)
                        assert.lengthOf(skills, 25)
                        const knowledgeBureaucracy = actor.system.skills["Knowledge (Bureaucracy)"];
                        assert.equal(knowledgeBureaucracy.value, 0)

                        assert.equal(knowledgeBureaucracy.situationalSkills.filter(s => s.label === "Knowledge (Bureaucracy) (Watercooler Talk)")[0].value, 4)
                    });
                });

                it('should create skills when an unknown skill is modified', async function () {
                    await withTestActor(async actor => {
                        actor.suppressDialog = true
                        await actor.addChange({key:"skillBonus", value:"Competitive Origami:4"})
                        actor.system._prepareSkillDerivedData()
                        let skills = Object.values(actor.system.skills)
                        assert.lengthOf(skills, 26)
                        const skill = skills.filter(s => s.label === "Competitive Origami")[0];
                        assert.equal(skill.value, 4)
                        assert.lengthOf(skill.situationalSkills, 0)
                    });
                });

                it('skill tags should not be case sensitive', async function () {
                    await withTestActor(async actor => {
                        actor.suppressDialog = true
                        await actor.addChange({key:"skillBonus", value:"stealth:0"})
                        actor.system._prepareSkillDerivedData()
                        let skills = Object.values(actor.system.skills)
                        assert.lengthOf(skills, 25)
                        const skill = skills.filter(s => s.label === "Stealth")[0];
                        assert.equal(!!skill, true)
                        assert.equal(skill.value, 0)
                        assert.lengthOf(skill.situationalSkills, 0)
                    });
                });

                it('skill tags should not be case sensitive', async function () {
                    await withTestActor(async actor => {
                        actor.suppressDialog = true
                        await actor.addChange({key:"skillBonus", value:"stealth:6"})
                        actor.system._prepareSkillDerivedData()
                        let skills = Object.values(actor.system.skills)
                        assert.lengthOf(skills, 25)
                        const skill = skills.filter(s => s.label === "Stealth")[0];
                        assert.equal(!!skill, true)
                        assert.equal(skill.value, 6)
                        assert.lengthOf(skill.situationalSkills, 0)
                    });
                });
            });
    })
}