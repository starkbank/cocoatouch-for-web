import { NSObject } from "../foundation/nsobject.js"
import { typed, optional, StringType } from "../utils/required.js"


// UIPasteboard.general: the text this page copies for the user to paste
// elsewhere. Deviation from Apple, on purpose: the getter returns only the last
// string this page wrote and null before any write, because Apple's reads the
// system pasteboard and a page cannot read the clipboard synchronously, nor
// without a permission prompt.
export class UIPasteboard extends NSObject {

    static get general() {
        if (!_general) { _general = new UIPasteboard() }
        return _general
    }

    _string = null

    get string() {
        return this._string
    }

    // nil forgets the page's string; the browser offers no way to clear the
    // system clipboard without overwriting it, so nothing is written.
    set string(value) {
        typed(value, "string", optional(StringType), "UIPasteboard.string", "Apple's is var string: String?.")
        this._string = value
        if (value === null) { return }
        _write(value)
    }

    get hasStrings() {
        return this._string !== null
    }
}


var _general = null


// The async clipboard API needs a secure context and a permission the browser
// may refuse; the selection copy works in the user's click everywhere else.
function _write(text) {
    var clipboard = typeof navigator === "undefined" ? null : navigator.clipboard
    if (!clipboard || typeof clipboard.writeText !== "function") {
        _copyBySelection(text)
        return
    }
    var written
    try {
        written = clipboard.writeText(text)
    } catch (error) {
        _copyBySelection(text)
        return
    }
    Promise.resolve(written).catch(() => _copyBySelection(text))
}


// Off-screen rather than display:none, since a hidden field cannot be selected.
// Read-only keeps a touch keyboard from opening, and the previous focus comes
// back so the copy does not move the user's caret.
function _copyBySelection(text) {
    var previous = document.activeElement
    var area = document.createElement("textarea")
    area.value = text
    area.readOnly = true
    area.setAttribute("aria-hidden", "true")
    area.style.position = "fixed"
    area.style.top = "0"
    area.style.left = "0"
    area.style.opacity = "0"
    area.style.pointerEvents = "none"
    document.body.appendChild(area)
    try {
        area.select()
        document.execCommand("copy")
    } finally {
        document.body.removeChild(area)
        if (previous && typeof previous.focus === "function") { previous.focus() }
    }
}
