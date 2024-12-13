function unifiedMeasureDistance(p0,
                                p1,
                                {ray = null, diagonalRule = "5105", state = {diagonals: 0, cells: 0}} = {}
) {
    ray ??= new Ray(p0, p1);
    const gs = canvas.dimensions.size,
        nx = Math.ceil(Math.abs(ray.dx / gs)),
        ny = Math.ceil(Math.abs(ray.dy / gs));

    // Get the number of straight and diagonal moves
    const nDiagonal = Math.min(nx, ny),
        nStraight = Math.abs(ny - nx);

    state.diagonals += nDiagonal;

    let cells = 0;
    // Standard Pathfinder diagonals: double distance for every odd.
    if (diagonalRule === "5105") {
        const nd10 = Math.floor(state.diagonals / 2) - Math.floor((state.diagonals - nDiagonal) / 2);
        cells = nd10 * 2 + (nDiagonal - nd10) + nStraight;
    }
    else if (diagonalRule === "101010") {
        cells = nStraight + nDiagonal * 2;
    }
    // Equal distance diagonals
    else cells = nStraight + nDiagonal;

    state.cells += cells;
    return cells * canvas.dimensions.distance;

}

export function measureDistances(segments, options = {}) {
    if (!options.gridSpaces) return BaseGrid.prototype.measureDistances.call(this, segments, options);

    // Track the total number of diagonals
    const diagonalRule = this.diagonalRule;
    const state = {diagonals: 0};

    // Iterate over measured segments
    return segments.map((s) => unifiedMeasureDistance(null, null, {ray: s.ray, diagonalRule, state}));


}