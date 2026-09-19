export class Locale {

    constructor(identifier) {
        this.identifier = identifier
    }

    get languageCode() {
        return this.identifier.split("-")[0]
    }

    get regionCode() {
        return this.identifier.split("-")[1] || null
    }
}
