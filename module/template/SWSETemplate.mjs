export default class SWSETemplate extends (foundry.canvas?.placeables?.MeasuredTemplate ?? MeasuredTemplate) {
    #initialLayer;
    #events;
    drawPreview() {
        const initialLayer = canvas.activeLayer;

        // Draw the template and switch to the template layer
        this.draw();
        this.layer.activate();
        this.layer.preview.addChild(this);

        // Hide the sheet that originated the preview
        this.actorSheet?.minimize();

        // Activate interactivity
        return this.activatePreviewListeners(initialLayer);
    }

    /**
     * Activate listeners for the template preview
     * @param {CanvasLayer} initialLayer  The initially active CanvasLayer to re-activate after the workflow is complete
     * @returns {Promise}                 A promise that resolves with the final measured template if created.
     */
    activatePreviewListeners(initialLayer) {
        return new Promise((resolve, reject) => {
            this.#initialLayer = initialLayer;
            this.#events = {
                cancel: this._onCancelPlacement.bind(this),
                confirm: this._onConfirmPlacement.bind(this),
                move: this._onMovePlacement.bind(this),
                resolve,
                reject,
                rotate: this._onRotatePlacement.bind(this)
            };

            // Activate listeners
            canvas.stage.on("mousemove", this.#events.move);
            canvas.stage.on("mouseup", this.#events.confirm);
            canvas.app.view.oncontextmenu = this.#events.cancel;
            canvas.app.view.onwheel = this.#events.rotate;
        });
    }

    static fromAttack(attack, options={}) {
        const target = attack.template ?? {};
        if ( !target.shape ) return [];

        const templateData = foundry.utils.mergeObject({
            t: target.shape,
            user: game.user.id,
            distance: target.size,
            direction: 0,
            x: 0,
            y: 0,
            fillColor: game.user.color,
            flags: {
                "disableRotation": target.disableRotation,
                "snapPoint": target.snapPoint,
                "cleanUp": target.cleanUp
            }
        }, options);

        switch ( target.shape ) {
            case "cone":
                templateData.angle = CONFIG.MeasuredTemplate.defaults.angle;
                break;
            case "rect":
                templateData.width = target.size;
                templateData.distance = Math.hypot(target.size, target.size);
                templateData.direction = 45;
                break;
            // case "ray":
            //     templateData.width = target.width ?? canvas.dimensions.distance;
            //     break;
            case "circle":

            default:
                break;
        }

        // Construct the templates from activity data
        const cls = CONFIG.MeasuredTemplate.documentClass;

        return Array.fromRange(target.count || 1).map(() => {
            const template = new cls(foundry.utils.deepClone(templateData), {parent: canvas.scene});
            const object = new this(template);
            object.activity = attack;
            object.item = attack.item;
            object.actorSheet = attack.actor?.sheet || null;
            return object;
        });
    }

    /**
     * Rotate the template preview by 3˚ increments when the mouse wheel is rotated.
     * @param {Event} event  Triggering mouse event.
     */
    _onRotatePlacement(event) {
        if ( event.ctrlKey ) event.preventDefault(); // Avoid zooming the browser window
        event.stopPropagation();
        if(this.document.flags?.disableRotation){ return;}
        const delta = canvas.grid.type > CONST.GRID_TYPES.SQUARE ? 30 : 15;
        const snap = event.shiftKey ? delta : 5;
        const update = {direction: this.document.direction + (snap * Math.sign(event.deltaY))};
        this.document.updateSource(update);
        this.refresh();
    }

    /* -------------------------------------------- */

    /**
     * Confirm placement when the left mouse button is clicked.
     * @param {Event} event  Triggering mouse event.
     */
    async _onConfirmPlacement(event) {
        await this._finishPlacement(event);
        const destination = canvas.templates.getSnappedPoint({ x: this.document.x, y: this.document.y });
        this.document.updateSource(destination);
        this.#events.resolve(canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [this.document.toObject()]));
    }

    /* -------------------------------------------- */

    /**
     * Cancel placement when the right mouse button is clicked.
     * @param {Event} event  Triggering mouse event.
     */
    async _onCancelPlacement(event) {
        await this._finishPlacement(event);
        this.#events.reject();
    }

    /**
     * Shared code for when template placement ends by being confirmed or canceled.
     * @param {Event} event  Triggering event that ended the placement.
     */
    async _finishPlacement(event) {
        this.layer._onDragLeftCancel(event);
        canvas.stage.off("mousemove", this.#events.move);
        canvas.stage.off("mouseup", this.#events.confirm);
        canvas.app.view.oncontextmenu = null;
        canvas.app.view.onwheel = null;
        if ( this.#hoveredToken ) {
            this.#hoveredToken._onHoverOut(event);
            this.#hoveredToken = null;
        }
        this.#initialLayer.activate();
        await this.actorSheet?.maximize();
    }

    /**
     * Move the template preview when the mouse moves.
     * @param {Event} event  Triggering mouse event.
     */
    _onMovePlacement(event) {
        event.stopPropagation();
        const now = Date.now(); // Apply a 20ms throttle
        if ( now - this.#moveTime <= 20 ) return;
        const center = event.data.getLocalPosition(this.layer);
        const updates = this.getVertexSnappedPoint(center, this.document.flags.snapPoint);

        this.document.updateSource(updates);
        this.refresh();
        this.#moveTime = now;
    }


    getVertexSnappedPoint(point, snapType = "vertex") {
        const M = CONST.GRID_SNAPPING_MODES;
        const grid = canvas.grid;
        const mode = grid.isHexagonal
            ? M.CENTER | M.VERTEX
            : snapType === "vertex" ? M.VERTEX | M.CORNER : M.CENTER;
        return grid.getSnappedPoint(point, {
            mode: mode,
            resolution: 1
        });
    }

    /**
     * Current token that is highlighted when using adjusted size template.
     * @type
     */
    #hoveredToken;

    /**
     * Track the timestamp when the last mouse move event was captured.
     * @type {number}
     */
    #moveTime = 0;
}