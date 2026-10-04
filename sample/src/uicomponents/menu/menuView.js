import "UIKit"
import "Foundation"
import { navigate } from "../../navigation.js"


// Every page declares `@IBOutlet("#menu", MenuView)`. The nib is injected into
// that element at build time; the view then gives each option its page as a
// user activity, which renders as the anchor's href, and selects the current one.
export class MenuView extends UIView {

    @IBOutlet("#menu-brand", UIButton) brandButton
    @IBOutlet("#menu-home", UIButton) homeOption
    @IBOutlet("#menu-buttons", UIButton) buttonsOption
    @IBOutlet("#menu-labels", UIButton) labelsOption
    @IBOutlet("#menu-text-fields", UIButton) textFieldsOption
    @IBOutlet("#menu-custom-views", UIButton) customViewsOption
    @IBOutlet("#menu-table-view", UIButton) tableViewOption
    @IBOutlet("#menu-links", UIButton) linksOption
    @IBOutlet("#menu-traits", UIButton) traitsOption

    awakeFromNib() {
        const path = window.location.pathname
        const options = {
            "/": this.homeOption,
            "/buttons": this.buttonsOption,
            "/labels": this.labelsOption,
            "/text-fields": this.textFieldsOption,
            "/custom-views": this.customViewsOption,
            "/table-view": this.tableViewOption,
            "/links": this.linksOption,
            "/traits": this.traitsOption,
        }
        this.brandButton.userActivity = _browsing("/")
        for (const [page, option] of Object.entries(options)) {
            option.userActivity = _browsing(page)
            option.isSelected = page === path
        }
    }

    // One action for every option: the binder creates a UIButton per matched
    // element and hands it over as the sender, whose activity names the page.
    @IBAction(".menu-option", UIButton) optionTapped(sender) {
        navigate(sender.userActivity.webpageURL)
    }

    @IBAction("#menu-brand", UIButton) brandTapped() {
        navigate("/")
    }
}


function _browsing(url) {
    const activity = new NSUserActivity({activityType: NSUserActivityTypeBrowsingWeb})
    activity.webpageURL = url
    return activity
}
