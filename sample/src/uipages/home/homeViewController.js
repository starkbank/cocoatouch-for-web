import "UIKit"
import "Foundation"
import { MenuView } from "../../uicomponents/menu/menuView.js"
import { navigate } from "../../navigation.js"


export class HomeViewController extends UIViewController {

    @IBOutlet("#menu", MenuView) menuView
    @IBOutlet("#home-subtitle", UILabel) subtitleLabel
    @IBOutlet("#home-buttons", UIButton) buttonsOption
    @IBOutlet("#home-labels", UIButton) labelsOption
    @IBOutlet("#home-text-fields", UIButton) textFieldsOption
    @IBOutlet("#home-custom-views", UIButton) customViewsOption
    @IBOutlet("#home-table-view", UIButton) tableViewOption
    @IBOutlet("#home-links", UIButton) linksOption
    @IBOutlet("#home-traits", UIButton) traitsOption

    viewDidLoad() {
        this.subtitleLabel.text = "Each page is a UIViewController with a .xib. Pick one to see a part of UIKit in use."
        const pages = [
            [this.buttonsOption, "/buttons"],
            [this.labelsOption, "/labels"],
            [this.textFieldsOption, "/text-fields"],
            [this.customViewsOption, "/custom-views"],
            [this.tableViewOption, "/table-view"],
            [this.linksOption, "/links"],
            [this.traitsOption, "/traits"],
        ]
        for (const [option, page] of pages) {
            const activity = new NSUserActivity({activityType: NSUserActivityTypeBrowsingWeb})
            activity.webpageURL = page
            option.userActivity = activity
        }
    }

    @IBAction(".home-option", UIButton) optionTapped(sender) {
        navigate(sender.userActivity.webpageURL)
    }
}
