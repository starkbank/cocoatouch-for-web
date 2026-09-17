import "UIKit"


// A reusable view with its own nib, outlets and action. It works both as an
// `@IBOutlet` declared in a page's xib and as an instance created at runtime
// and attached with `addSubview`. Outlets bind inside the view's own element,
// so several cards on one page do not collide.
export class CardView extends UIView {

    @IBOutlet("#card-title", UILabel) titleLabel
    @IBOutlet("#card-subtitle", UILabel) subtitleLabel
    @IBOutlet("#card-taps", UILabel) tapsLabel

    taps = 0

    constructor(selector, {title = "Card", subtitle = ""} = {}) {
        super(selector)
        this.title = title
        this.subtitle = subtitle
    }

    awakeFromNib() {
        this.render()
    }

    configure({title, subtitle}) {
        this.title = title
        this.subtitle = subtitle
        this.render()
    }

    render() {
        this.titleLabel.text = this.title
        this.subtitleLabel.text = this.subtitle
        this.tapsLabel.text = this.taps === 0 ? "" : `${this.taps} tap${this.taps === 1 ? "" : "s"}`
    }

    // The tap travels up the responder chain as an in-app notification, so the
    // page reacts without the card knowing who presents it.
    @IBAction("#card-action", UIButton) actionTapped() {
        this.taps += 1
        this.render()
        NSNotificationCenter.postNotification({name: "cardDidTap", object: this, userInfo: {title: this.title, taps: this.taps}})
    }
}
