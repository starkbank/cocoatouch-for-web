

export class NSString {

    // Strips scripts, or defers to DOMPurify when the page loads it, which
    // is what an app that renders untrusted text should do.
    static cleanScript(text) {
        if (!text) { return "" }
        if (typeof globalThis.DOMPurify !== "undefined") {
            return globalThis.DOMPurify.sanitize(text)
        }
        return text.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    }
}
