

export class IndexPath {

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
