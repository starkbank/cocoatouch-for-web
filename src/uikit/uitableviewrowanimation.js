// UITableView.RowAnimation, Apple's cases. A row here appears or changes
// without an animation whichever case is given: the table records it and
// draws the rows at once, as `animated` is recorded elsewhere.
export const UITableViewRowAnimation = Object.freeze({
    fade: "fade",
    right: "right",
    left: "left",
    top: "top",
    bottom: "bottom",
    none: "none",
    middle: "middle",
    automatic: "automatic",
})
