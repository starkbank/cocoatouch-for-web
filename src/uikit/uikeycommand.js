// Key inputs for @IBAction, named like UIKeyCommand's input constants. A
// modifier flag is prepended: `UIKeyModifierFlags.command + UIKeyCommand.input("k")`.
export class UIKeyCommand {

    static input(key) { return "keyboard:" + key }

    static get inputReturn() { return "keyboard:Enter" }

    static get inputEscape() { return "keyboard:Escape" }

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
