// @ts-check
import "UIKit"
import "UniformTypeIdentifiers"


export class MailViewController extends UIViewController {

    @IBOutlet("#mail", UITextField) mailField

    viewDidLoad() {
        this.mailField.pasteDelegate = this
        this.mailField.pasteDelegate = {textPasteConfigurationSupportingTransform(field, item) { item.setNoResult() }}
        this.mailField.pasteDelegate = null
    }

    textPasteConfigurationSupportingTransform(textField, item) {
        item.itemProvider.loadDataRepresentation({
            forTypeIdentifier: UTType.html.identifier,
            completionHandler: (data, error) => {},
        })
        item.setStringResult("a, b")
        item.setDefaultResult()
    }
}
