// @ts-check
import "UIKit"


var textField = new UITextField("#mail")
textField.pasteDelegate = {textPasteConfigurationSupportingTransformPasteItem: 3}
new UITextPasteItem().setStringResult(7)
