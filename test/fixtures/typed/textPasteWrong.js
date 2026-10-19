// @ts-check
import "UIKit"


var textField = new UITextField("#mail")
textField.pasteDelegate = {textPasteConfigurationSupportingTransform: 3}
new UITextPasteItem().setStringResult(7)
