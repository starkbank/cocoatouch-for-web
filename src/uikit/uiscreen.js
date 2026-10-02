import { NSObject } from "../foundation/nsobject.js"


// UIKit's UIScreen: the browser viewport stands in for the device screen.
export class UIScreen extends NSObject {

    static get main() {
        if (!UIScreen._main) { UIScreen._main = new UIScreen() }
        return UIScreen._main
    }

    get bounds() {
        if (typeof window === "undefined" || window.innerWidth === undefined) { return {x: 0, y: 0, width: 0, height: 0} }
        return {x: 0, y: 0, width: window.innerWidth, height: window.innerHeight}
    }
}
