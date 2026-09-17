import { UIView } from "./uiview.js"
import { UIControlEvent } from "./uicontrolevent.js"


export class UIControl extends UIView {

    addTarget(target, params) {
        var control = this

        var event = {
            [UIControlEvent.valueChanged]: "change",
            [UIControlEvent.touchUpInside]: "click",
        }[params["for"]] || "click"

        this.$el.off(event).on(event, (e) => {
            e.stopPropagation()
            return target[params["action"].name](control)
        })
    }

}