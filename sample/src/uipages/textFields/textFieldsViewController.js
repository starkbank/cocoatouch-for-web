import "UIKit"
import { MenuView } from "../../uicomponents/menu/menuView.js"


export class TextFieldsViewController extends UIViewController {

    @IBOutlet("#menu", MenuView) menuView
    @IBOutlet("#text-fields-name", UITextField) nameField
    @IBOutlet("#text-fields-email", UITextField) emailField
    @IBOutlet("#text-fields-notes", UITextField) notesField
    @IBOutlet("#text-fields-password", UITextField) passwordField
    @IBOutlet("#text-fields-submit", UIButton) submitButton
    @IBOutlet("#text-fields-notes-count", UILabel) notesCountLabel
    @IBOutlet("#text-fields-preview", UILabel) previewLabel
    @IBOutlet("#text-fields-show-password", UISwitch) showPasswordSwitch
    @IBOutlet("#text-fields-lock-name", UISwitch) lockNameSwitch
    @IBOutlet("#text-fields-editing", UILabel) editingLabel
    @IBOutlet("#text-fields-message", UITextView) messageView
    @IBOutlet("#text-fields-message-count", UILabel) messageCountLabel

    viewDidLoad() {
        this.nameField.placeholder = "Ada Lovelace"
        this.emailField.placeholder = "ada@example.com"
        this.notesField.placeholder = "Anything else?"
        this.passwordField.placeholder = "••••••••"
        this.nameField.delegate = this
        this.emailField.delegate = this
        this.notesField.delegate = this
        this.showPasswordSwitch.addTarget(this, {action: this.showPasswordChanged, for: UIControlEvent.valueChanged})
        this.lockNameSwitch.addTarget(this, {action: this.lockNameChanged, for: UIControlEvent.valueChanged})
        this.messageView.isScrollEnabled = false
        this.messageView.delegate = this
        this.messageView.text = "A text view grows with its text.\nType a few more lines."
        this.updateMessageCount()
        this.updateForm()
    }

    viewDidAppear() {
        this.nameField.becomeFirstResponder()
    }

    // UITextFieldDelegate

    textFieldDidBeginEditing(textField) {
        this.editingLabel.text = `Editing ${textField.identifier.replace("text-fields-", "")}`
    }

    textFieldDidEndEditing(textField) {
        this.updateForm()
    }

    textFieldShouldReturn(textField) {
        if (textField === this.notesField) { return }
        textField.resignFirstResponder()
        this.submitTapped()
    }

    // UITextViewDelegate

    textViewDidChange(textView) {
        this.updateMessageCount()
    }

    @IBAction("#text-fields-submit", UIButton) submitTapped() {
        if (!this.isFormFilled()) {
            this.previewLabel.text = "Fill in name and email first."
            return
        }
        this.previewLabel.text = `Submitted ${this.nameField.text} (${this.emailField.text})` + (this.notesField.text ? ` with notes: ${this.notesField.text}` : "")
    }

    // addTarget actions receive the sender alone, and this is the target; see the Buttons page.
    showPasswordChanged(sender) {
        this.passwordField.isSecureTextEntry = !sender.isOn
    }

    lockNameChanged(sender) {
        this.nameField.isUserInteractionEnabled = !sender.isOn
    }

    updateForm() {
        var isFilled = this.isFormFilled()
        this.submitButton.isEnabled = isFilled
        this.submitButton.alpha = isFilled ? 1 : 0.5
        this.notesCountLabel.text = `${this.notesField.text.length} characters`
    }

    updateMessageCount() {
        this.messageCountLabel.text = `${this.messageView.text.length} characters`
    }

    isFormFilled() {
        return this.nameField.text.trim().length > 0 && this.emailField.text.trim().length > 0
    }
}
