// Foundation's NSRange: a location and a length.
export class NSRange {

    constructor({location = 0, length = 0} = {}) {
        this.location = location
        this.length = length
    }
}


// Foundation's NSNotFound, a global as in Swift, not a member of NSRange.
export const NSNotFound = Number.MAX_SAFE_INTEGER
