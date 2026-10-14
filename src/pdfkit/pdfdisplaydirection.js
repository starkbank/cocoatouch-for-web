// PDFDisplayDirection. Apple's PDFView.displayDirection chooses the axis a
// continuous display mode scrolls along; pdf.js carries the same choice in
// scrollMode (VERTICAL or HORIZONTAL), so PDFView folds it, with displayMode,
// into the one scrollMode/spreadMode pair pdf.js wants. A paged mode
// (.singlePage, .twoUp) has no scroll axis, so the direction does not touch it.
export const PDFDisplayDirection = Object.freeze({
    vertical: "vertical",
    horizontal: "horizontal",
})
