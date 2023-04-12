
/**
 * Extend the base ActiveEffect entity
 * @extends {ActiveEffect}
 */
export class SWSEActiveEffect extends ActiveEffect {
    async safeUpdate(data={}, context={}) {
        if(this.canUserModify(game.user, 'update')){
            await this.update(data, context);
        }
    }

    static async _onCreateDocuments(documents, context) {
        super._onCreateDocuments(documents, context).then(
            game.items.directory.render())
    }
    static async _onDeleteDocuments(documents, context) {
        super._onCreateDocuments(documents, context).then(
            game.items.directory.render())
    }
}