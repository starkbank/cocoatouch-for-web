import "UIKit"
import "Foundation"
import { MenuView } from "../../uicomponents/menu/menuView.js"


const COLORS = {
    accent: new UIColor({hex: "#0070e0"}),
    success: new UIColor({hex: "#1f9d55"}),
    danger: new UIColor({hex: "#d64545"}),
    default: new UIColor({hex: "#1c1f26"}),
}

export class LabelsViewController extends UIViewController {

    @IBOutlet("#menu", MenuView) menuView
    @IBOutlet("#labels-greeting", UILabel) greetingLabel
    @IBOutlet("#labels-styled", UILabel) styledLabel
    @IBOutlet("#labels-toggle-hidden", UIButton) hiddenButton
    @IBOutlet("#labels-clock", UILabel) clockLabel
    @IBOutlet("#labels-width", UILabel) widthLabel
    @IBOutlet("#labels-pings", UILabel) pingsLabel

    pings = 0
    clockTimer = null
    isEmphasized = false

    viewDidLoad() {
        this.greetingLabel.text = "Hello from viewDidLoad"
        this.updateWidth()
        NSNotificationCenter.addObserver(this, {name: "resize", object: window, selector: "updateWidth"})
        NSNotificationCenter.addObserver(this, {name: "labelsDidPing", selector: "labelsDidPing"})
    }

    viewDidAppear() {
        this.tick()
        this.clockTimer = setInterval(() => this.tick(), 1000)
    }

    viewWillDisappear() {
        clearInterval(this.clockTimer)
        this.clockTimer = null
    }

    @IBAction("#labels-color-accent", UIButton) accentTapped() {
        this.greetingLabel.textColor = COLORS.accent
    }

    @IBAction("#labels-color-success", UIButton) successTapped() {
        this.greetingLabel.textColor = COLORS.success
    }

    @IBAction("#labels-color-danger", UIButton) dangerTapped() {
        this.greetingLabel.textColor = COLORS.danger
    }

    @IBAction("#labels-color-default", UIButton) defaultTapped() {
        this.greetingLabel.textColor = COLORS.default
    }

    @IBAction("#labels-toggle-hidden", UIButton) toggleHiddenTapped() {
        var isHidden = !this.styledLabel.isHidden
        this.styledLabel.isHidden = isHidden
        this.hiddenButton.text = isHidden ? "Show" : "Hide"
    }

    @IBAction("#labels-toggle-style", UIButton) toggleStyleTapped() {
        this.isEmphasized = !this.isEmphasized
        this.styledLabel.style = this.isEmphasized ? "labels-emphasized output" : "labels-plain output"
    }

    @IBAction("#labels-ping", UIButton) pingTapped() {
        NSNotificationCenter.postNotification({name: "labelsDidPing", userInfo: {at: new Date()}})
    }

    labelsDidPing(notification) {
        this.pings += 1
        this.pingsLabel.text = `${this.pings} received, last at ${notification.userInfo.at.toLocaleTimeString()}`
    }

    updateWidth() {
        this.widthLabel.text = `Window is ${window.innerWidth}px wide`
    }

    tick() {
        this.clockLabel.text = new Date().toLocaleTimeString()
    }
}
