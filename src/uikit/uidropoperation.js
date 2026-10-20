// UIDropOperation, Apple's four cases: a drop is refused, shown
// as refused, copies, as a browser copies a file out of the system, or moves.
export const UIDropOperation = Object.freeze({
    cancel: "cancel",
    forbidden: "forbidden",
    copy: "copy",
    move: "move",
})
