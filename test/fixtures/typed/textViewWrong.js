// @ts-check
import "UIKit"


var textView = new UITextView("#note")
textView.isScrollEnabled = "no"
textView.delegate = {textViewDidChange: 3}
