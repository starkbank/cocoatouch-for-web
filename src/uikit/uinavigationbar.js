import { UIView } from "./uiview.js"
import { UIButton } from "./uibutton.js"
import { UILabel } from "./uilabel.js"
import { IBOutlet } from "./iboutlet.js"


// UINavigationBar: the bar a navigation controller draws above its content,
// with Apple's default back button, titled after the previous controller.
// Customising it waits for UIBarButtonItem. The nib is a string rather than a
// .xib so the framework's own entry points can import the class.
export class UINavigationBar extends UIView {

}

UINavigationBar.nib = "<div class=\"navigation-bar\"><button id=\"navigation-bar-back\" class=\"navigation-bar-back\"></button><span id=\"navigation-bar-title\" class=\"navigation-bar-title\"></span></div>"
IBOutlet("#navigation-bar-back", UIButton)(UINavigationBar.prototype, "backButton", {})
IBOutlet("#navigation-bar-title", UILabel)(UINavigationBar.prototype, "titleLabel", {})
