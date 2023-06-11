import {toNumber} from "../common/util.mjs";
import {getInheritableAttribute} from "../attribute-helper.mjs";

export function addSubCredits(type, actor) {
    let d = new Dialog({
        title: type === 'add' ? "Add Credits" : "Subtract Credits",
        content: `<label>Credits
                         <input type="number" value="0" id="credits" data-action="${type === 'add' ? "add" : "sub"}" name="credits"></label>`,
        buttons: {
            one: {
                icon: '',
                label: "Cancel",
                callback: () => {
                }
            },
            two: {
                icon: '',
                label: type === 'add' ? "Add" : "Subtract",
                callback: (html) => {
                    let input = html.find("#credits")[0];
                    let modifier = input.value;
                    let action = $(input).data('action');
                    let proposed;
                    if (action === 'add') {
                        proposed = actor.credits + toNumber(modifier);
                    } else {
                        proposed = actor.credits - toNumber(modifier);
                    }
                    //TODO should we check for negative?

                    actor.credits = proposed;
                }
            }
        },
        default: "two"
    });
    d.render(true);
}

export function transferCredits(actor, type) {
    let options = actor.items
        .filter(item => getInheritableAttribute({entity: item, attributeKey: "credit"}).length > 0)
        .map(item => `<option data-credits="${getInheritableAttribute({
            entity: item,
            attributeKey: "credit",
            reduce: "FIRST"
        })}" value="${item.id}">${item.name}</option>`)
    let content =
        `<div class="flex flex-row">
                     <div><label>Your Credits: <div>${actor.credits}</div></label></div>
                     <div>
                         <label>Credits
                             <input type="number" value="0" id="credits" name="credits">
                         </label>
                     </div>
                     <div><select>${options}</select><label>Credits:<div class="item-credits">0</div></label></div>
                 </div>`;
    let d = new Dialog({
        title: type === "Transfer Credits",
        content: content,
        buttons: {
            one: {
                icon: '',
                label: "Cancel",
                callback: () => {
                }
            },
            two: {
                icon: '',
                label: "Confirm",
                callback: (html) => {
                    let input = html.find("#credits")[0];
                    let select = html.find("select")[0];
                    let modifier = input.value;

                    let item = actor.items.get(select.value)
                    let attr = Object.values(item.data.data.attributes).find(attr => attr.key === 'credit')

                    item.setAttribute("credit", toNumber(attr.value) + toNumber(modifier));
                    //TODO should we check for negative?
                    actor.credits = actor.credits - toNumber(modifier);
                }
            }
        },
        default: "two",
        render: (html) => {
            let select = html.find("select");
            let itemCredit = html.find(".item-credits")
            select.on('change', (event) => {
                let option = Object.values($(event.currentTarget)[0]).find(element => element.selected)
                itemCredit.empty()
                itemCredit.append($(option).data("credits"));
            })
            let option = Object.values($(select)[0]).find(element => element.selected)
            itemCredit.empty()
            itemCredit.append($(option).data("credits"));
        }
    });
    d.render(true);
}