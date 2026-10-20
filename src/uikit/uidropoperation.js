// UIDropOperation, the three cases a page can honour: a drop is refused, shown
// as refused, or copies, as a browser copies a file out of the system.
export const UIDropOperation = Object.freeze({
    cancel: "cancel",
    forbidden: "forbidden",
    copy: "copy",
})
