// UIControl.State's cases a page can report. Apple's is an option set; here
// UIControl.state is a frozen array of the active cases.
export class UIControlState {

    static get normal() {
        return "normal"
    }

    static get highlighted() {
        return "highlighted"
    }

    static get disabled() {
        return "disabled"
    }

    static get selected() {
        return "selected"
    }

    static get focused() {
        return "focused"
    }
}
