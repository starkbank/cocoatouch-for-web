import "UIKit"
import { MenuView } from "../../uicomponents/menu/menuView.js"
import { BadgeView } from "../../uicomponents/badge/badgeView.js"


export class TraitsViewController extends UIViewController {

    @IBOutlet("#menu", MenuView) menuView
    @IBOutlet("#traits-badge-invoices", BadgeView) invoicesBadge
    @IBOutlet("#traits-badge-plain", BadgeView) plainBadge
    @IBOutlet("#traits-badges", UIView) badgesView
    @IBOutlet("#traits-box", UIView) boxView
    @IBOutlet("#traits-frame", UILabel) frameLabel
    @IBOutlet("#traits-screen", UILabel) screenLabel
    @IBOutlet("#traits-size-classes", UILabel) sizeClassesLabel
    @IBOutlet("#traits-log", UILabel) logLabel

    transitions = 0

    viewDidLoad() {
        this.describeGeometry()
        this.describeTraits()
        this.logLabel.text = "Resize the window across 768px to see willTransition and traitCollectionDidChange."
    }

    @IBAction("#traits-add-badge", UIButton) addBadgeTapped() {
        this.badgesView.addSubview(new BadgeView())
    }

    // Before the change: the controller's traitCollection still reads the old classes.
    willTransition({to: newCollection, with: coordinator}) {
        this.transitions += 1
        this.logLabel.text = `willTransition #${this.transitions}: ${this.traitCollection.horizontalSizeClass} → ${newCollection.horizontalSizeClass} (traitCollection still ${this.traitCollection.horizontalSizeClass})`
    }

    viewWillTransition({to: size, with: coordinator}) {
        coordinator.animate({completion: () => this.describeGeometry()})
    }

    traitCollectionDidChange(previous) {
        this.describeTraits()
        this.logLabel.text += ` · traitCollectionDidChange: was ${previous.horizontalSizeClass}, now ${this.traitCollection.horizontalSizeClass}`
    }

    describeGeometry() {
        const frame = this.boxView.frame
        this.frameLabel.text = `frame: origin (${Math.round(frame.minX)}, ${Math.round(frame.minY)}) size ${Math.round(frame.width)}×${Math.round(frame.height)} · midX ${Math.round(frame.midX)} · maxY ${Math.round(frame.maxY)} · bounds.origin is CGPoint.zero: ${this.boxView.bounds.minX === 0 && this.boxView.bounds.minY === 0}`
        const screen = UIScreen.main.bounds
        this.screenLabel.text = `UIScreen.main.bounds: ${screen.width}×${screen.height} · contains(100, 100): ${screen.contains(new CGPoint({x: 100, y: 100}))} · insetBy(10, 10): ${screen.insetBy({dx: 10, dy: 10}).width}×${screen.insetBy({dx: 10, dy: 10}).height}`
    }

    describeTraits() {
        const traits = this.traitCollection
        this.sizeClassesLabel.text = `horizontal: ${traits.horizontalSizeClass} · vertical: ${traits.verticalSizeClass}`
    }
}
