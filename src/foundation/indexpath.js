

export class IndexPath {

    /**
     * @param {object} [options]
     * @param {number} [options.row]
     * @param {number} [options.item]
     * @param {number} [options.section]
     */
    constructor({row, section = 0, item}) {
        this.row = row === undefined ? item : row
        this.section = section
    }

    get item() {
        return this.row
    }

    isEqual(other) {
        return other instanceof IndexPath && other.row === this.row && other.section === this.section
    }
}
