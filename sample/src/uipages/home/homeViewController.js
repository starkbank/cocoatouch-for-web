import "UIKit"
import { MenuView } from "../../uicomponents/menu/menuView.js"
import { navigate } from "../../navigation.js"


export class HomeViewController extends UIViewController {

    @IBOutlet("#menu", MenuView) menuView
    @IBOutlet("#home-subtitle", UILabel) subtitleLabel

    viewDidLoad() {
        this.subtitleLabel.text = "Each page is a UIViewController with a .xib. Pick one to see a part of UIKit in use."
    }

    @IBAction(".home-option", UIButton) optionTapped(sender) {
        navigate(sender.$el.attr("href"))
    }
}
