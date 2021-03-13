main()

async function main() {
    if (canvas.tokens.controlled.length === 0) {
        ui.notifications.error("Please select token");
        return;
    }

    let actors = canvas.tokens.controlled.map(token => token.actor);

    var weaponTypes = ["rifles", "pistols", "grenades", "exotic melee weapons",
        "simple melee weapons", "heavy weapons", "simple ranged weapons", "exotic ranged weapons", "lightsabers", "mines", "advanced melee weapons"
    ];

    for (let actor of actors) {
        let feats = actor.items.filter(item => item.data.data.attributes.ItemType?.value == "Feat");

        let weapons = actor.items.filter(item => {
            let itemType = item.data.data.attributes.ItemType?.value;
            var isWeapon = false;
            if (itemType != null) {
                var types = itemType.split(", ");
                types.forEach(type => {
                    if (weaponTypes.includes(type)) {
                        isWeapon = true;
                    }
                });
                return isWeapon;
            }
        })

        if (weapons.length == 0) {
            ui.notifications.error("Attacking token has no weapons");
            continue;
        }

        let options = "";


        let level = actor.data.data.attributes.level?.value;
        level = level ? parseInt(level) : 3;

        let size = actor.data.data.attributes.size?.value;

        let bab = actor.data.data.attributes.bab?.value;
        bab = bab ? parseInt(bab) : 0;

        let dexmod = actor.data.data.attributes.dexmod?.value;
        dexmod = dexmod ? parseInt(dexmod) : 0;

        let strmod = actor.data.data.attributes.strmod?.value;
        strmod = strmod ? parseInt(strmod) : 0;

        //unarmed attack
        options += `<option name='unarmed' attack='1d20 + ${bab} + ${strmod}' damage='1d4 + ${strmod}' range='melee'>Unarmed | Atk: + ${bab + strmod} | Dmg: 1d4 + ${strmod}</option>`

        for (let weapon of weapons) {
            let damage = weapon.data.data.attributes.Damage?.value;

            if(damage==null){
                ui.notifications.error(weapon.data.name + " is missing a damage attribute.")
                damage = "1";
            }
            let itemType = weapon.data.data.attributes.ItemType?.value;
            var range = "ranged";
            let isMelee=false;
            let ability = 0
            ability = dexmod;
            if(itemType.includes("melee") || itemType.includes("lightsabers")){
                range = "melee";
                isMelee = true;
                ability = strmod;
            }

            let stunSetting = weapon.data.data.attributes.StunSetting?.value;


            var proficencyBonus = -5;
            if(itemType.includes("exotic")){
                feats.forEach(feat => {
                    if(feat.data.name.toLowerCase() == "exotic weapon proficiency (" + weapon.data.name.toLowerCase() + ")"){
                        proficencyBonus = 0;
                    }
                });
            } else {
                var types = itemType.split(", ");
                types.forEach(type => {
                    feats.forEach(feat => {
                        if(feat.data.name.toLowerCase() == "weapon proficiency (" + type.toLowerCase() + ")"){
                            proficencyBonus = 0;
                        }
                    });
                });
            }

            let weaponFocusBonus = 0;
            feats.forEach(feat => {
                if(itemType.includes("exotic")){
                    feats.forEach(feat => {
                        if(feat.data.name.toLowerCase() == "weapon focus (" + weapon.data.name.toLowerCase() + ")"){
                            weaponFocusBonus = 1;
                        }
                    });
                } else {
                    var types = itemType.split(", ");
                    types.forEach(type => {
                        if(feat.data.name.toLowerCase() == "weapon focus (" + type.toLowerCase() + ")"){
                            weaponFocusBonus = 1;
                        }
                    });
                }
            })


            damage = damage + " + " + Math.floor(level/2);

            let total = parseInt(bab) + ability + proficencyBonus + weaponFocusBonus;
            var onlyStun = false;
            if(stunSetting != null && stunSetting.includes("yes")){
                onlyStun = stunSetting.includes("only");
                var stunDamage = damage;
                if(stunSetting.includes("(")){
                    var stunDamage = stunSetting.replace("yes", "").replace("(only","").replace(", ","").replace(")","").trim();

                    if(stunDamage != ""){
                        stunDamage = damage;
                    }
                }

                if(isMelee){
                    if(isNotLight){
                        options += `<option value=${weapon.id} name='${weapon.data.name}' attack='${total}' damage='${damage} + ${strmod*2}' special='stun' range='${range}'>[TWO HAND] [STUN SETTING] ${weapon.data.name} | Atk: ${total} | Dmg: ${stunDamage} + ${strmod*2}</option>`
                    }
                    options += `<option value=${weapon.id} name='${weapon.data.name}' attack='${total}' damage='${damage} + ${strmod}' special='stun' range='${range}'>[STUN SETTING] ${weapon.data.name} | Atk: ${total} | Dmg: ${stunDamage} + ${strmod}</option>`
                }else{
                    options += `<option value=${weapon.id} name='${weapon.data.name}' attack='${total}' damage='${damage}' special='stun' range='${range}'>[STUN SETTING] ${weapon.data.name} | Atk: ${total} | Dmg: ${stunDamage}</option>`
                }
                //options += `<option value=${weapon.id} name='${weapon.data.name}' attack='${total}' damage='${damage}' stun='true' range='${range}'>[STUN SETTING] ${weapon.data.name} | Atk: ${total} | Dmg: ${stunDamage}</option>`
            }
            let isNotLight = true;
            if(!onlyStun){
                if(isMelee){
                    if(isNotLight){
                        options += `<option value=${weapon.id} name="${weapon.data.name}" attack='${total}' damage='${damage} + ${strmod*2}' range='${range}'>[TWO HAND] ${weapon.data.name} | Atk: ${total} | Dmg: ${damage} + ${strmod*2}</option>`
                    }
                    options += `<option value=${weapon.id} name="${weapon.data.name}" attack='${total}' damage='${damage} + ${strmod}' range='${range}'>${weapon.data.name} | Atk: ${total} | Dmg: ${damage} + ${strmod}</option>`
                }else{
                    options += `<option value=${weapon.id} name="${weapon.data.name}" attack='${total}' damage='${damage}' range='${range}'>${weapon.data.name} | Atk: ${total} | Dmg: ${damage}</option>`


                    options += `<option value=${weapon.id} name="${weapon.data.name}" attack='${total}' damage='${damage}' range='${range}' special='aid'>[AID ATTACK] ${weapon.data.name} | Atk: ${total}</option>`
                    options += `<option value=${weapon.id} name="${weapon.data.name}" attack='${total}' damage='${damage}' range='${range}' special='suppress'>[SUPPRESS FIRE] ${weapon.data.name} | Atk: ${total}</option>`

                }
            }
        }


        let dialogueTemplate = `
    <p>${actor.data.name}</p>
    <div>
      <select id="weapon">${options}</select>
    </div>
    `

        new Dialog({
            title: "Select Attack",
            content: dialogueTemplate,
            buttons: {
                attack: {
                    label: "Attack",
                    callback: (html) => {
                        let weapons = html.find("#weapon");

                        let weapon = weapons[0].options[weapons[0].options.selectedIndex]

                        console.log(weapon);

                        let attack_bonus = weapon.getAttribute("attack");
                        let special = weapon.getAttribute("special");
                        let stun = false;
                        if(special == 'stun'){
                            stun = true;
                        }
                        let aid = false;
                        if(special == 'aid'){
                            aid = true;
                        }
                        let suppress = false;
                        if(special == 'suppress'){
                            suppress = true;
                        }

                        let range = weapon.getAttribute("range");
                        let name = weapon.getAttribute("name");
                        let attackRollString = `1d20 + ${attack_bonus}`

                        let damageRollString = weapon.getAttribute("damage");
                        let attackRoll = new Roll(attackRollString).roll();
                        //attackRoll.toMessage();

                        let currentUser = game.users.get(game.userId).data;

                        if(aid){
                            ChatMessage.create({
                                content: `
              <p>You roll a ${attackRoll.total} with your ${name}!  Your Target was 10.</p>
              <p>${attackRoll.result}</p>
            `,
                                speaker: ChatMessage.getSpeaker({
                                    actor: actor
                                }),
                                roll: attackRoll,
                                sound: "sounds/dice.wav"
                            });

                        }else if(suppress){

                            ChatMessage.create({
                                content: `
              <p>You roll a ${attackRoll.total} with your ${name}!  Your Target was 10.</p>
              <p>${attackRoll.result}</p>
            `,
                                speaker: ChatMessage.getSpeaker({
                                    actor: actor
                                }),
                                roll: attackRoll,
                                sound: "sounds/dice.wav"
                            });
                        }else{


                            ui.notifications.info("You roll a "+attackRoll.total+" with your "+name+"!");
                            ChatMessage.create({
                                content: `
              <p>You roll a ${attackRoll.total} with your ${name}!</p>
              <p>${attackRoll.result}</p>
              <p> <button id="confirm">Confirm Critical</button></p>
              <p> <button id="rollDamage">Roll Damage</button></p>
            `,
                                speaker: ChatMessage.getSpeaker({
                                    actor: actor
                                }),
                                roll: attackRoll,
                                sound: "sounds/dice.wav"
                            });

                            let dtHref="https://swse.fandom.com/wiki/Hit_Points#:~:text=Damage%20Threshold%3A%20Fortitude%20Defense%20%2B%20Size%20Modifier&text=If%20the%20Damage%20reduces%20you,it's%20Damage%20Threshold%20is%20destroyed."

                            // Roll Damage
                            Hooks.once('renderChatMessage', (chatItem, html) => {
                                html.find("#rollDamage").click(() => {

                                    let damageRoll = new Roll(damageRollString).roll();

                                    if (stun) {
                                        ChatMessage.create({
                                            content: `
					  <p>You do ${damageRoll.total} <a href='https://swse.fandom.com/wiki/Stunning'>stun</a> damage.  If this beats the targets <a href='${dtHref}'>DT</a> they move 2 steps down the condition track or five if their HP is 0.  Enemy takes <b>${Math.floor(damageRoll.total/2)}</b> damage.</p>
					  <p>${damageRoll.result}</p>
					`,
                                            speaker: ChatMessage.getSpeaker({
                                                actor: actor
                                            }),
                                            roll: damageRoll,
                                            sound: "sounds/dice.wav"
                                        });
                                    } else {
                                        ChatMessage.create({
                                            content: `
					  <p>You do ${damageRoll.total} damage. if this beats the targets <a href='${dtHref}'>DT</a> they move one step down the condition track.</p>
					  <p>${damageRoll.result}</p>
					`,
                                            speaker: ChatMessage.getSpeaker({
                                                actor: actor
                                            }),
                                            roll: damageRoll,
                                            sound: "sounds/dice.wav"
                                        });
                                    }

                                })

                                html.find("#confirm").click(() => {

                                    let attackRoll = new Roll(attackRollString).roll();
                                    ui.notifications.info("You roll a "+attackRoll.total+" with your "+name+"!");
                                    ChatMessage.create({
                                        content: `
					  <p>You roll ${attackRoll.total} if this hits, you crit!!</p>
					  <p>${attackRoll.result}</p>
					`,
                                        speaker: ChatMessage.getSpeaker({
                                            actor: actor
                                        }),
                                        roll: attackRoll,
                                        sound: "sounds/dice.wav"
                                    });
                                })
                            })
                        }

                    },
                    cancel: {
                        label: "Cancel"
                    }
                }
            }}).render(true);
    }
}