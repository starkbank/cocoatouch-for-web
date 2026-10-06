// UIControl.State's cases a page can report. Apple's is an option set; here
// UIControl.state is a frozen array of the active cases.
export class UIControlState {

    /** @returns {"normal"} */
    static get normal() {
        return "normal"
    }

    /** @returns {"highlighted"} */
    static get highlighted() {
        return "highlighted"
    }

    /** @returns {"disabled"} */
    static get disabled() {
        return "disabled"
    }

    /** @returns {"selected"} */
    static get selected() {
        return "selected"
    }

    /** @returns {"focused"} */
    static get focused() {
        return "focused"
    }
}
