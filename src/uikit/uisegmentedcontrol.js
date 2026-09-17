import { UIControl } from "./uicontrol.js"
import { NSString } from "../utils/nsstring.js"


export class UISegmentedControl extends UIControl {

    segments = []
    selectedSegmentIndex = ""
    numberOfSegments = this.segments.length

    constructor(selector) {
        super(selector)
        this.init()
    }

    init() {
        this.loadSegments()
        this.numberOfSegments = this.segments.length
    }

    loadSegments() {
        let elementList = $(this.selector).children()
        for (let index = 0; index < elementList.length; index++) {
            const element = elementList[index]
            this.segments.push(element)
        }
        this.setEnabled(elementList[0].id)
    }

    setEnabled(identifier) {
        this.segments.forEach(element => {
            element.className = element.className.replace(" active", "")
            if (element.id === identifier) {
                element.className += " active"
                this.selectedSegmentIndex = identifier
            }
        })
    }

    setBadgeValue(identifier, value) {
        const i = this.segments.findIndex(_item => _item.id === identifier)
        if (i > -1) {
            this.segments[i].lastElementChild.innerHTML = value || 0
        }
    }

    setTitle(identifier, title) {
        var cleanedScriptText = NSString.cleanScript(title)
        const i = this.segments.findIndex(_item => _item.id === identifier)
        if (i > -1) {
            this.segments[i].firstElementChild.innerHTML = cleanedScriptText
        }
    }

    set isBadgeHidden(bool = false) {
        this.segments.forEach(element => {
            if (bool) {
                return $(element.lastElementChild).hide()
            }
            $(element.lastElementChild).show()
        })
    }
}
