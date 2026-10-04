// Apple requires the label; JavaScript cannot refuse at compile time, so the
// call refuses instead and names what to write. One place, so the check every
// labelled member makes changes together.
export function required(options, label, method, signature) {
    if (!options || options[label] === undefined) {
        throw new TypeError(`${method} requires a ${label}: ${signature}`)
    }
    return options[label]
}
