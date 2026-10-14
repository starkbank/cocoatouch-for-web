// Stands in for pdfjs-dist/web/pdf_viewer.mjs; see lib.mjs for the shape.
var current = null

export function use(viewer) {
    current = viewer
}

function constructorFor(name) {
    return class {
        constructor(...args) {
            return new current[name](...args)
        }
    }
}

function enumerationFor(name) {
    return new Proxy({}, {get: function(target, key) { return current[name][key] }})
}

export const EventBus = constructorFor("EventBus")
export const PDFLinkService = constructorFor("PDFLinkService")
export const PDFFindController = constructorFor("PDFFindController")
export const PDFViewer = constructorFor("PDFViewer")
export const ScrollMode = enumerationFor("ScrollMode")
export const SpreadMode = enumerationFor("SpreadMode")
export const FindState = enumerationFor("FindState")
export const LinkTarget = enumerationFor("LinkTarget")
