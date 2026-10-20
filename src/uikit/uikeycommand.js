const backspaceInput = "\b"


// Key inputs for @IBAction, named like UIKeyCommand's input constants. A
// modifier flag is prepended: `UIKeyModifierFlags.command + UIKeyCommand.input("k")`.
export class UIKeyCommand {

    // Apple names no constant for Backspace: it is the input "\u{8}", written "\b".
    static input(key) { return "keyboard:" + (key === backspaceInput ? "Backspace" : key) }

    static get inputReturn() { return "keyboard:Enter" }

    static get inputEscape() { return "keyboard:Escape" }

    // The forward Delete key, as Apple's inputDelete is; Backspace is input("\b").
    // A focused text input consumes both.
    static get inputDelete() { return "keyboard:Delete" }

    // UIKeyCommand.wantsPriorityOverSystemBehavior, written as a flag before the
    // input like a modifier: it lets the command run while a text input is the
    // first responder, and the command prevents the input's own behaviour only
    // when its method does not return false.
    static get wantsPriorityOverSystemBehavior() { return "priority+" }

    static get inputUpArrow() { return "keyboard:ArrowUp" }

    static get inputDownArrow() { return "keyboard:ArrowDown" }

    static get inputLeftArrow() { return "keyboard:ArrowLeft" }

    static get inputRightArrow() { return "keyboard:ArrowRight" }
}


export class UIKeyModifierFlags {

    static get command() { return "meta+" }

    static get control() { return "ctrl+" }

    static get shift() { return "shift+" }

    static get alternate() { return "alt+" }
}
