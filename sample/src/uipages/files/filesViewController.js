import "UIKit"
import "Foundation"
import "UniformTypeIdentifiers"
import { MenuView } from "../../uicomponents/menu/menuView.js"


const highlightColor = new UIColor({hex: "#e6f1fc"})


export class FilesViewController extends UIViewController {

    @IBOutlet("#menu", MenuView) menuView
    @IBOutlet("#files-drop", UIView) dropView
    @IBOutlet("#files-list", UILabel) listLabel
    @IBOutlet("#files-status", UILabel) statusLabel

    urls = []

    viewDidLoad() {
        this.dropView.addInteraction(new UIDropInteraction({delegate: this}))
        this.showFiles()
    }

    viewWillDisappear() {
        this.clearFiles()
    }

    // A browser opens a file chooser only from the user's tap, so the picker is presented here.
    @IBAction("#files-choose", UIButton) chooseTapped() {
        const picker = new UIDocumentPickerViewController({
            forOpeningContentTypes: [UTType.pdf, UTType.image, UTType.plainText],
            asCopy: true,
        })
        picker.allowsMultipleSelection = true
        picker.delegate = this
        this.present(picker, {animated: true})
    }

    @IBAction("#files-clear", UIButton) clearTapped() {
        this.clearFiles()
        this.statusLabel.text = "Cleared."
    }

    // UIDocumentPickerDelegate

    documentPickerDidPickDocumentsAtURLs(controller, urls) {
        this.statusLabel.text = `Picked ${urls.length} file${urls.length === 1 ? "" : "s"}.`
        this.addFiles(urls)
    }

    documentPickerWasCancelled(controller) {
        this.statusLabel.text = "The picker was cancelled."
    }

    // UIDropInteractionDelegate

    dropInteractionSessionDidEnter(interaction, session) {
        this.dropView.backgroundColor = highlightColor
    }

    // Without a .copy proposal here the drop is swallowed and performDrop never runs.
    dropInteractionSessionDidUpdate(interaction, session) {
        return new UIDropProposal({operation: UIDropOperation.copy})
    }

    dropInteractionSessionDidExit(interaction, session) {
        this.dropView.backgroundColor = null
    }

    dropInteractionPerformDrop(interaction, session) {
        for (const item of session.items) {
            item.itemProvider.loadFileRepresentation({
                forTypeIdentifier: UTType.item.identifier,
                completionHandler: (url, error) => {
                    if (error) {
                        this.statusLabel.text = "A dropped file could not be read."
                        return
                    }
                    this.addFiles([url])
                },
            })
        }
        this.statusLabel.text = `Dropped ${session.items.length} item${session.items.length === 1 ? "" : "s"}.`
    }

    dropInteractionSessionDidEnd(interaction, session) {
        this.dropView.backgroundColor = null
    }

    addFiles(urls) {
        this.urls.push(...urls)
        this.showFiles()
    }

    // The registry holds each file until it is removed, so a page that is done with them says so.
    clearFiles() {
        for (const url of this.urls) {
            FileManager.default.removeItem({at: url})
        }
        this.urls = []
        this.showFiles()
    }

    // Names are the user's: they are label text, never markup.
    showFiles() {
        if (this.urls.length === 0) {
            this.listLabel.text = "No files yet."
            return
        }
        const lines = this.urls.map(function(url) {
            const name = FileManager.default.displayName({atPath: url.href})
            const size = FileManager.default.attributesOfItem({atPath: url.href})[FileAttributeKey.size]
            return `${name} · ${size} bytes`
        })
        this.listLabel.text = lines.join("\n")
    }
}
