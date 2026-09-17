import { uuid } from "../utils/uuid.js"


export class AVPlayer {

    constructor(selector) {
        this.selector = selector || "#"+uuid()
        this.next = null
    }

    get identifier() {
        var id = this.selector.replace(/#\b[\w\-]{36}\b #/, "").replaceAll("#", "")
        var ids = id.split(" ")
        return ids.pop()
    }

    set url(url) {
        $(this.selector).attr("src", url)
    }
}