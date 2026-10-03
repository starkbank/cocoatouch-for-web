import "UIKit"
import "Foundation"
import { MenuView } from "../../uicomponents/menu/menuView.js"
import { navigate } from "../../navigation.js"


const pages = [
    {title: "Buttons", path: "/buttons"},
    {title: "Labels", path: "/labels"},
    {title: "Text fields", path: "/text-fields"},
    {title: "Table view", path: "/table-view"},
]

const symbols = ["fa-solid fa-credit-card", "fa-solid fa-building-columns", "fa-solid fa-qrcode", "fa-solid fa-shield-halved"]

const rowCount = 40

// A named image is a file; the sample ships none, so this one is inline.
const logoUrl = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" rx="8" fill="#0070e0"/><text x="18" y="24" font-family="Helvetica, Arial" font-size="16" font-weight="700" text-anchor="middle" fill="#fff">CT</text></svg>')


export class LinksViewController extends UIViewController {

    @IBOutlet("#menu", MenuView) menuView
    @IBOutlet("#links-list", UIView) listView
    @IBOutlet("#links-output", UILabel) outputLabel
    @IBOutlet("#links-symbol", UIImageView) symbolView
    @IBOutlet("#links-symbol-name", UILabel) symbolNameLabel
    @IBOutlet("#links-logo", UIImageView) logoView
    @IBOutlet("#links-scroll", UIScrollView) scrollView
    @IBOutlet("#links-scroll-output", UILabel) scrollOutputLabel
    @IBOutlet("#links-search", UITextField) searchField
    @IBOutlet("#links-keys-output", UILabel) keysOutputLabel

    symbolIndex = 0
    slashCount = 0
    commandCount = 0

    viewDidLoad() {
        this.addLinks()
        this.showSymbol(0)
        this.logoView.image = new UIImage({named: logoUrl})
        this.addRows()
        this.searchField.placeholder = "Press / anywhere to focus me"
        this.updateScrollOutput()
        this.updateKeysOutput()
    }

    // A link is an anchor whose user activity is browsing a page: the
    // webpageURL becomes its href, so it works as a link before any tap.
    addLinks() {
        for (const page of pages) {
            const link = new UIButton()
            link.nib = `<a class="links-option">${page.title}</a>`
            this.listView.addSubview(link)
            link.userActivity = _browsing(page.path)
            link.addTarget(this, {action: _linkTapped, for: UIControlEvent.touchUpInside})
        }
    }

    linkTapped(link) {
        const url = link.userActivity.webpageURL
        this.outputLabel.text = `Opening ${url} from userActivity.webpageURL`
        navigate(url)
    }

    @IBAction("#links-next-symbol", UIButton) nextSymbolTapped() {
        this.showSymbol((this.symbolIndex + 1) % symbols.length)
    }

    showSymbol(index) {
        this.symbolIndex = index
        this.symbolView.image = new UIImage({systemName: symbols[index]})
        this.symbolNameLabel.text = `UIImage({systemName: "${symbols[index]}"})`
    }

    addRows() {
        for (let row = 1; row <= rowCount; row++) {
            const rowView = new UIView()
            rowView.nib = `<div class="links-row">Row ${row}</div>`
            this.scrollView.addSubview(rowView)
        }
    }

    @IBAction("#links-scroll-top", UIButton) scrollTopTapped() {
        this.scrollView.setContentOffset(CGPoint.zero, {animated: true})
        this.updateScrollOutputSoon()
    }

    @IBAction("#links-scroll-bottom", UIButton) scrollBottomTapped() {
        const bottom = this.scrollView.contentSize.height - this.scrollView.bounds.height
        this.scrollView.setContentOffset(new CGPoint({x: 0, y: bottom}), {animated: true})
        this.updateScrollOutputSoon()
    }

    @IBAction("#links-scroll-step", UIButton) scrollStepTapped() {
        const offset = this.scrollView.contentOffset
        this.scrollView.contentOffset = new CGPoint({x: 0, y: offset.y + 120})
        this.updateScrollOutput()
    }

    updateScrollOutputSoon() {
        setTimeout(() => this.updateScrollOutput(), 600)
    }

    updateScrollOutput() {
        const offset = this.scrollView.contentOffset
        const size = this.scrollView.contentSize
        this.scrollOutputLabel.text = `contentOffset.y ${Math.round(offset.y)} of contentSize.height ${Math.round(size.height)}`
    }

    // A bare "/" reaches the page only while no text input has the focus;
    // typed into the field, it is a character. ⌘J fires either way.
    @IBAction(UIKeyCommand.input("/")) slashPressed() {
        this.slashCount += 1
        this.searchField.becomeFirstResponder()
        this.updateKeysOutput()
    }

    @IBAction(UIKeyModifierFlags.command + UIKeyCommand.input("j")) commandJPressed() {
        this.commandCount += 1
        this.updateKeysOutput()
    }

    updateKeysOutput() {
        this.keysOutputLabel.text = `"/" focused the field ${this.slashCount}× · ⌘J fired ${this.commandCount}×`
    }
}


function _browsing(url) {
    const activity = new NSUserActivity({activityType: NSUserActivityTypeBrowsingWeb})
    activity.webpageURL = url
    return activity
}

function _linkTapped(target, sender) {
    target.linkTapped(sender)
}
