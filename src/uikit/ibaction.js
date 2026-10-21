import { Bind, keyboardPrefix } from "../utils/bind.js"
import { decoratedDescriptor } from "../utils/decoratedDescriptor.js"
import { UIControl } from "./uicontrol.js"
import { UIControlEvent } from "./uicontrolevent.js"
import { typed, enumeration } from "../utils/required.js"


const eventType = enumeration(UIControlEvent, "UIControl.Event")


// The event is the third field of the connection, as Interface Builder stores
// it on the action (eventType="editingChanged"); omitted, the sender's class
// default applies. Several events on one method are stacked declarations,
// several connections, as in a nib.
/**
 * @param {string} selector
 * @param {Function} [cls]
 * @param {object} [options]
 * @param {"touchUpInside"|"valueChanged"|"editingChanged"|"editingDidBegin"|"editingDidEnd"|"touchDown"} [options.for]
 * @returns {(target: object, name: string, descriptor?: PropertyDescriptor) => any}
 */
export function IBAction(selector, cls, {for: controlEvent} = {}) {
    _checkEvent(selector, cls, controlEvent)
    return (target, name, descriptor) => {
        var array = target["ibactions"] || []
        target["ibactions"] = array.concat({
            cls: cls,
            selector: selector,
            controlEvent: controlEvent,
            method: name,
            target: target,
        })
        Bind.registerPrototypeForRestore(target)
        return decoratedDescriptor(descriptor)
    }
}


function _checkEvent(selector, cls, controlEvent) {
    if (controlEvent === undefined) { return }
    var signature = "Apple's connection stores the event of a control; write @IBAction(selector, UIButton, {for: UIControlEvent.touchDown})."
    typed(controlEvent, "for", eventType, "IBAction", signature)
    if (selector.indexOf(keyboardPrefix) !== -1) {
        throw new TypeError(`IBAction("${selector}") is a key command, which has no control event: drop {for}.`)
    }
    if (cls === UIControl || cls?.prototype instanceof UIControl) { return }
    throw new TypeError(`IBAction("${selector}", ${cls?.name}, {for}) needs a UIControl class: only a control has events to connect.`)
}
