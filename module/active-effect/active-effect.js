
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
}