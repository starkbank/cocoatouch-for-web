// Key inputs for @IBAction, named like UIKeyCommand's input constants. A
// modifier flag is prepended: `UIKeyModifierFlags.command + UIKeyCommand.input("k")`.
export class UIKeyCommand {

    static input(key) { return "keyboard:" + key }

    static get inputReturn() { return "keyboard:Enter" }

    static get inputEscape() { return "keyboard:Escape" }

    // The delete key (Backspace on the web), which a focused text input consumes.
    static get inputDelete() { return "keyboard:Backspace" }

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
