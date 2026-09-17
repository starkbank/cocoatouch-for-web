import "UIKit"
import "Foundation"
import { MenuView } from "../../uicomponents/menu/menuView.js"
import { CardView } from "../../uicomponents/card/cardView.js"


const TITLES = ["Invoice", "Transfer", "Boleto", "Card", "Pix", "Loan"]

export class CustomViewsViewController extends UIViewController {

    @IBOutlet("#menu", MenuView) menuView
    @IBOutlet("#custom-views-featured", CardView) featuredCard
    @IBOutlet("#custom-views-grid", UIView) gridView
    @IBOutlet("#custom-views-count", UILabel) countLabel
    @IBOutlet("#custom-views-log", UILabel) logLabel

    viewDidLoad() {
        this.featuredCard.configure({title: "Featured", subtitle: "Declared in the xib, nib injected at build time"})
        NSNotificationCenter.addObserver(this, {name: "cardDidTap", selector: "cardDidTap"})
        this.updateCount()
    }

    @IBAction("#custom-views-add", UIButton) addTapped() {
        var index = this.gridView.subviews.length
        this.gridView.addSubview(this.makeCard(index))
        this.updateCount()
    }

    @IBAction("#custom-views-add-three", UIButton) addThreeTapped() {
        var index = this.gridView.subviews.length
        this.gridView.addSubviews([this.makeCard(index), this.makeCard(index + 1), this.makeCard(index + 2)])
        this.updateCount()
    }

    @IBAction("#custom-views-remove", UIButton) removeTapped() {
        var subviews = this.gridView.subviews
        if (subviews.length === 0) { return }
        subviews[subviews.length - 1].removeFromSuperview()
        this.updateCount()
    }

    cardDidTap(notification) {
        var card = notification.object
        var inGrid = card.superview === this.gridView
        var owner = card.parentViewController() === this
        this.logLabel.text = `${notification.userInfo.title} tapped ${notification.userInfo.taps}× · in grid: ${inGrid} · parent controller is this page: ${owner}`
    }

    makeCard(index) {
        var title = TITLES[index % TITLES.length]
        return new CardView(null, {title: `${title} #${index + 1}`, subtitle: "Created with new CardView() and added at runtime"})
    }

    updateCount() {
        var count = this.gridView.subviews.length
        this.countLabel.text = `${count} subview${count === 1 ? "" : "s"}`
    }
}
