// @ts-check
import "UIKit"
import "Foundation"


export class HomeViewController extends UIViewController {

    @IBOutlet("#title", UILabel) titleLabel

    viewDidLoad() {
        this.view.isHidden = false
        NSNotificationCenter.removeObserver(this)
        var label = new UILabel("#title")
        label.text = Keyboard.escape
    }

    @IBAction("#open", UIButton) openButtonTapped(sender) {
        this.titleLabel.text = sender.text
    }
}
