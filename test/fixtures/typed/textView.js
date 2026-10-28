// @ts-check
import "UIKit"


export class NoteViewController extends UIViewController {

    @IBOutlet("#note", UITextView) noteView

    viewDidLoad() {
        this.noteView.isScrollEnabled = false
        this.noteView.delegate = this
        this.noteView.delegate = {textViewDidChange(textView) { textView.text = textView.text }}
        this.noteView.delegate = null
        var scrolls = this.noteView.isScrollEnabled
    }

    textViewDidChange(textView) {
        this.noteView.text = textView.text
    }
}
