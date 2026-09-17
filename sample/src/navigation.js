// In-app links push a history entry and raise popstate, so the router presents
// the next controller the same way it does for the browser's back button.
export function navigate(path) {
    if (window.location.pathname === path) { return }
    window.history.pushState(null, "", path)
    window.dispatchEvent(new PopStateEvent("popstate"))
}
