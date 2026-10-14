// PDFDisplayMode. pdf.js's PDFViewer splits the same idea across two
// independent properties, scrollMode and spreadMode; PDFView.displayMode
// maps Apple's single enum onto that pair so the host never has to know pdf.js
// has two knobs where Apple has one.
export const PDFDisplayMode = Object.freeze({
    singlePage: "singlePage",
    singlePageContinuous: "singlePageContinuous",
    twoUp: "twoUp",
    twoUpContinuous: "twoUpContinuous",
})
