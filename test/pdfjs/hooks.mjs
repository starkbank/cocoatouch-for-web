var standIns = {
    "pdfjs-dist/build/pdf.min.mjs": new URL("./lib.mjs", import.meta.url).href,
    "pdfjs-dist/web/pdf_viewer.mjs": new URL("./viewer.mjs", import.meta.url).href,
}

export function resolve(specifier, context, nextResolve) {
    if (!Object.hasOwn(standIns, specifier)) { return nextResolve(specifier, context) }
    return {url: standIns[specifier], shortCircuit: true}
}
