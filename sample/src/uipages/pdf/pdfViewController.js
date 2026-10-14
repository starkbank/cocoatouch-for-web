import "UIKit"
import "Foundation"
import "PDFKit"
import { MenuView } from "../../uicomponents/menu/menuView.js"
import guideUrl from "./sampleGuide.pdf"


// The whole PDFKit contract is the PDFView outlet and PDFDocument({url}): the
// framework carries pdf.js, its worker and its stylesheet, so this page
// publishes and wires nothing. The controller is both delegates, as a
// controller is on iOS: PDFDocumentDelegate for the find, PDFViewDelegate for
// the links.
export class PdfViewController extends UIViewController {

    @IBOutlet("#menu", MenuView) menuView
    @IBOutlet("#pdf-view", PDFView) pdfView
    @IBOutlet("#pdf-previous", UIButton) previousButton
    @IBOutlet("#pdf-next", UIButton) nextButton
    @IBOutlet("#pdf-position", UILabel) positionLabel
    @IBOutlet("#pdf-mode", UIButton) modeButton
    @IBOutlet("#pdf-direction", UIButton) directionButton
    @IBOutlet("#pdf-search", UITextField) searchField
    @IBOutlet("#pdf-find-output", UILabel) findOutputLabel
    @IBOutlet("#pdf-link-output", UILabel) linkOutputLabel

    findLines = []

    viewDidLoad() {
        const guide = new PDFDocument({url: guideUrl})
        guide.delegate = this
        this.pdfView.delegate = this
        this.searchField.delegate = this
        this.searchField.placeholder = "Try pdfkit, alpha or omega"
        // Scrolling moves the current page with no button pressed, so the
        // gates follow the notification rather than the taps.
        NotificationCenter.default.addObserver(this, {name: NSNotification.Name.PDFViewDocumentChanged, object: this.pdfView, selector: "pagesDidChange"})
        NotificationCenter.default.addObserver(this, {name: NSNotification.Name.PDFViewPageChanged, object: this.pdfView, selector: "pagesDidChange"})
        this.pdfView.document = guide
        this.pagesDidChange()
        this.updateDisplayButtons()
        this.findOutputLabel.text = "Nothing searched yet."
        this.linkOutputLabel.text = "No link clicked yet."
    }

    pagesDidChange() {
        const page = this.pdfView.currentPage
        this.previousButton.isEnabled = this.pdfView.canGoToPreviousPage
        this.nextButton.isEnabled = this.pdfView.canGoToNextPage
        this.positionLabel.text = page ? `Page ${page.label} of ${this.pdfView.document.pageCount}` : "Loading…"
    }

    @IBAction("#pdf-previous", UIButton) previousTapped(sender) {
        this.pdfView.goToPreviousPage(sender)
    }

    @IBAction("#pdf-next", UIButton) nextTapped(sender) {
        this.pdfView.goToNextPage(sender)
    }

    @IBAction("#pdf-mode", UIButton) modeTapped() {
        const continuous = this.pdfView.displayMode === PDFDisplayMode.singlePageContinuous
        this.pdfView.displayMode = continuous ? PDFDisplayMode.singlePage : PDFDisplayMode.singlePageContinuous
        this.updateDisplayButtons()
    }

    @IBAction("#pdf-direction", UIButton) directionTapped() {
        const vertical = this.pdfView.displayDirection === PDFDisplayDirection.vertical
        this.pdfView.displayDirection = vertical ? PDFDisplayDirection.horizontal : PDFDisplayDirection.vertical
        this.updateDisplayButtons()
    }

    updateDisplayButtons() {
        this.modeButton.setTitle(`displayMode: ${this.pdfView.displayMode}`, {for: UIControl.State.normal})
        this.directionButton.setTitle(`displayDirection: ${this.pdfView.displayDirection}`, {for: UIControl.State.normal})
    }

    @IBAction("#pdf-find", UIButton) findTapped() {
        this.find()
    }

    @IBAction("#pdf-clear", UIButton) clearTapped() {
        this.pdfView.highlightedSelections = []
    }

    find() {
        this.findLines = []
        this.findOutputLabel.text = ""
        this.pdfView.document.beginFindString(this.searchField.text, {withOptions: [NSString.CompareOptions.caseInsensitive]})
    }

    // UITextFieldDelegate: Return searches, as it does on iOS.
    textFieldShouldReturn(textField) {
        this.find()
    }

    // PDFDocumentDelegate. Each method appends to the one label, so a search
    // shows its whole sequence, in the order PDFKit delivers it.
    documentDidBeginDocumentFind(notification) {
        this.logFind("documentDidBeginDocumentFind")
    }

    documentDidFindMatch(notification) {
        this.logFind("documentDidFindMatch")
    }

    didMatchString(selection) {
        const pages = selection.pages.map((page) => page.label).join(", ")
        this.logFind(`didMatchString("${selection.string}") on page ${pages}`)
    }

    documentDidEndDocumentFind(notification) {
        this.logFind("documentDidEndDocumentFind")
    }

    logFind(line) {
        this.findLines.push(line)
        this.findOutputLabel.text = this.findLines.join("\n")
    }

    // PDFViewDelegate. Implementing this method is what keeps PDFKit from
    // opening the link: the delegate is handed the URL and the opening is its
    // job, so this one only reports it.
    pdfViewWillClickOnLinkWithURL(pdfView, url) {
        this.linkOutputLabel.text = `pdfViewWillClickOnLinkWithURL received ${url.href}, and nothing was opened.`
    }
}
