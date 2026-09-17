import "UIKit"
import { navigate } from "../../navigation.js"


// Every page declares `@IBOutlet("#menu", MenuView)`. The nib is injected into
// that element at build time, and the view highlights the current route once
// its outlets are bound.
export class MenuView extends UIView {

    awakeFromNib() {
        var path = window.location.pathname
        this.$el.find(".menu-option").each(function() {
            $(this).toggleClass("menu-option-active", $(this).attr("href") === path)
        })
    }

    // One action for every option: the binder creates a UIButton per matched
    // element and hands it over as the sender.
    @IBAction(".menu-option", UIButton) optionTapped(sender) {
        navigate(sender.$el.attr("href"))
    }

    @IBAction("#menu-brand", UIButton) brandTapped() {
        navigate("/")
    }
}
