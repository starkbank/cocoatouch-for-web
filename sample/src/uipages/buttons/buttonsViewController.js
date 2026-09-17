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

    @IBAction(Keyboard.arrowUp) arrowUpPressed() {
        this.setCount(this.count + 1)
    }

    @IBAction(Keyboard.arrowDown) arrowDownPressed() {
        this.setCount(this.count - 1)
    }

    @IBAction("#buttons-remote", UIButton) remoteTapped() {
        this.incrementButton.sendActions()
    }

    @IBAction("#buttons-target", UIButton) targetTapped(sender) {
        this.targetTaps += 1
        this.targetOutputLabel.text = `${sender.text.trim()} tapped ${this.targetTaps}×`
    }

    // addTarget calls the action as a plain function with the target first,
    // so the controller is read from that argument rather than from `this`.
    enabledSwitchChanged(target, sender) {
        var isOn = sender.isOn()
        target.targetButton.isEnabled = isOn
        target.targetButton.text = isOn ? "Tap me" : "Disabled"
        target.targetButton.toggle("button-disabled")
    }

    setCount(count) {
        this.count = count
        this.countLabel.text = String(count)
    }
}
