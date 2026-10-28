// UIDropOperation, Apple's four cases with its raw values, so a string is no
// operation: a drop is refused, shown as refused, copies, as a browser copies a
// file out of the system, or moves.
export const UIDropOperation = Object.freeze({
    cancel: 0,
    forbidden: 1,
    copy: 2,
    move: 3,
})
