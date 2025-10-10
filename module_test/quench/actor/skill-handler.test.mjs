import {generateSkills} from "../../../module/actor/skill-handler.mjs";
import {defaultSkills} from "../../../module/common/constants.mjs";
import {withTestActor} from "./actor-utils.mjs";

export async function skillHandlerTest(quench) {
    quench.registerBatch("actor.skill-handler",
        (context) => {
            const {describe, it, assert, expect, should} = context;
            describe("skill-handler", () => {
                it('should successfully build skills', async function () {
                    await withTestActor(async actor => {
                        actor.suppressDialog = true
                        let skills = generateSkills(actor, {skills: defaultSkills})
                        assert.lengthOf(skills, 25)
                    });
                });

                it('should successfully build skills when a grouper is provided', async function () {
                    await withTestActor(async actor => {
                        actor.suppressDialog = true

                        let groupedSkillMap = new Map();
                        groupedSkillMap.set("Athletics", {grouped: ["Jump", "Climb", "Swim"], classes: ["Scout", "Soldier", "Jedi"], uut: true})
                        let skills = generateSkills(actor, {groupedSkillMap})
                        assert.lengthOf(skills, 23)
                        let skill = skills.find(skill => skill.label === "Athletics")
                        assert.lengthOf(skill.situationalSkills, 3)
                    });
                });

                it('should successfully add appropriate attribute mod', async function () {
                    await withTestActor(async actor => {
                        actor.suppressDialog = true
                        await actor.setAttributes({int:18})
                        let skills = generateSkills(actor, {skills: defaultSkills})
                        assert.lengthOf(skills, 25)
                        assert.equal(skills.filter(s => s.label === "Knowledge (Bureaucracy)")[0].value, 4)
                    });
                });

                it('should successfully add appropriate skillBonus', async function () {
                    await withTestActor(async actor => {
                        actor.suppressDialog = true
                        await actor.addChange({key:"skillBonus", value:"Knowledge (Bureaucracy):4"})
                        let skills = generateSkills(actor, {skills: defaultSkills})
                        assert.lengthOf(skills, 25)
                        assert.equal(skills.filter(s => s.label === "Knowledge (Bureaucracy)")[0].value, 4)
                    });
                });

                it('should create situational bonuses when an unknown skill is modified that is prefixed with another skill', async function () {
                    await withTestActor(async actor => {
                        actor.suppressDialog = true
                        await actor.addChange({key:"skillBonus", value:"Knowledge (Bureaucracy) (Watercooler Talk):4"})
                        let skills = generateSkills(actor, {skills: defaultSkills})
                        assert.lengthOf(skills, 25)
                        const knowledgeBureaucracy = skills.filter(s => s.label === "Knowledge (Bureaucracy)")[0];
                        assert.equal(knowledgeBureaucracy.value, 0)

                        assert.equal(knowledgeBureaucracy.situationalSkills.filter(s => s.label === "Knowledge (Bureaucracy) (Watercooler Talk)")[0].value, 4)
                    });
                });

                it('should create skills when an unknown skill is modified', async function () {
                    await withTestActor(async actor => {
                        actor.suppressDialog = true
                        await actor.addChange({key:"skillBonus", value:"Competitive Origami:4"})
                        let skills = generateSkills(actor, {skills: defaultSkills})
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
                        let skills = generateSkills(actor, {skills: defaultSkills})
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
                        let skills = generateSkills(actor, {skills: defaultSkills})
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