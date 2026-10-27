import { UIControlEvent } from "../uikit/uicontrolevent.js"


// The DOM event a control event is drawn from, shared by addTarget and by the
// actions Interface Builder connects, so both hear a control the same way.
export const controlEventNames = Object.freeze({
    [UIControlEvent.valueChanged]: "change",
    [UIControlEvent.touchUpInside]: "click",
    [UIControlEvent.editingChanged]: "input",
    [UIControlEvent.editingDidBegin]: "focus",
    [UIControlEvent.editingDidEnd]: "blur",
    [UIControlEvent.touchDown]: "mousedown",
})
