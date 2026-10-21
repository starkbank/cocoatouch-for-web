import "UIKit"
import { MenuView } from "../../uicomponents/menu/menuView.js"


export class ButtonsViewController extends UIViewController {

    @IBOutlet("#menu", MenuView) menuView
    @IBOutlet("#buttons-count", UILabel) countLabel
    @IBOutlet("#buttons-increment", UIButton) incrementButton
    @IBOutlet("#buttons-enabled-switch", UISwitch) enabledSwitch
    @IBOutlet("#buttons-target", UIButton) targetButton
    @IBOutlet("#buttons-target-output", UILabel) targetOutputLabel

    count = 0
    targetTaps = 0

    viewDidLoad() {
        this.enabledSwitch.addTarget(this, {action: this.enabledSwitchChanged, for: UIControlEvent.valueChanged})
    }

    @IBAction("#buttons-increment", UIButton) incrementTapped() {
        this.setCount(this.count + 1)
    }

    @IBAction("#buttons-decrement", UIButton) decrementTapped() {
        this.setCount(this.count - 1)
    }

    @IBAction("#buttons-reset", UIButton) resetTapped() {
        this.setCount(0)
    }

    @IBAction(UIKeyCommand.inputUpArrow) arrowUpPressed() {
        this.setCount(this.count + 1)
    }

    @IBAction(UIKeyCommand.inputDownArrow) arrowDownPressed() {
        this.setCount(this.count - 1)
    }

    @IBAction("#buttons-remote", UIButton) remoteTapped() {
        this.incrementButton.sendActions({for: UIControlEvent.touchUpInside})
    }

    @IBAction("#buttons-target", UIButton) targetTapped(sender) {
        this.targetTaps += 1
        this.targetOutputLabel.text = `${sender.currentTitle.trim()} tapped ${this.targetTaps}×`
    }

    // addTarget calls the action on the target with the sending control alone,
    // as Apple's (sender), so the controller is `this`.
    enabledSwitchChanged(sender) {
        var isOn = sender.isOn
        this.targetButton.isEnabled = isOn
        this.targetButton.setTitle(isOn ? "Tap me" : "Disabled", {for: UIControl.State.normal})
        this.targetButton.alpha = isOn ? 1 : 0.5
    }

    setCount(count) {
        this.count = count
        this.countLabel.text = String(count)
    }
}
