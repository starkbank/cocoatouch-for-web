// The addresses a page may navigate to or hand to another app. mailto: and tel:
// execute nothing; a scheme a browser would run (javascript:, data:) or read
// from disk (file:) is refused. Relative addresses resolve against the page.
// One chokepoint, so NSUserActivity.webpageURL and UIApplication.open agree.
const navigableProtocols = ["http:", "https:", "mailto:", "tel:"]

// The resolved URL, or null when the text is not an address the page may follow.
export function resolvedNavigableURL(text) {
    var resolved
    try {
        resolved = new URL(text, typeof window !== "undefined" && window.location ? window.location.href : "http://localhost/")
    } catch (error) {
        return null
    }
    if (navigableProtocols.indexOf(resolved.protocol) === -1) { return null }
    return resolved
}
