import { UIActivityIndicatorView } from "./uiactivityindicatorview.js"
import { UIButton } from "./uibutton.js"
import { UILabel } from "./uilabel.js"
import { UITableView } from "./uitableview.js"
import { UITableViewCell } from "./uitableviewcell.js"
import { UITextField } from "./uitextfield.js"
import { UIView } from "./uiview.js"
import { UIControl } from "./uicontrol.js"
import { UISwitch } from "./uiswitch.js"
import { UIImageView } from "./uiimageview.js"
import { UIImage } from "./uiimage.js"
import { UIColor } from "./uicolor.js"
import { UIControlEvent } from "./uicontrolevent.js"
import { UIPickerView } from "./uipickerview.js"
import { UIProgressView } from "./uiprogressview.js"
import { UICollectionView, UICollectionViewCell } from "./uicollectionview.js"
import { UIDatePicker } from "./uidatepicker.js"
import { UISearchTextField } from "./uisearchtextfield.js"
import { UIDevice } from "./uidevice.js"
import { UIGestureRecognizer, UITapGestureRecognizer } from "./uigesturerecognizer.js"
import { UISegmentedControl } from "./uisegmentedcontrol.js"
import { UIViewController } from "./uiviewcontroller.js"
import { UIResponder } from "./uiresponder.js"
import { UIScrollView } from "./uiscrollview.js"
import { UIScriptLabel } from "./uiscriptlabel.js"
import { IBOutlet } from "./iboutlet.js"
import { IBAction } from "./ibaction.js"
import { Keyboard } from "../utils/keyboard.js"


export {
     UIActivityIndicatorView,
     UIButton,
     UILabel,
     UITableView,
     UITableViewCell,
     UITextField,
     UIView,
     UIControl,
     UISwitch,
     UIImageView,
     UIImage,
     UIColor,
     UIControlEvent,
     UIPickerView,
     UIProgressView,
     UICollectionView,
     UICollectionViewCell,
     UIDatePicker,
     UISearchTextField,
     UIDevice,
     UIGestureRecognizer,
     UITapGestureRecognizer,
     UISegmentedControl,
     UIViewController,
     UIResponder,
     UIScrollView,
     UIScriptLabel,
     IBOutlet,
     IBAction,
     Keyboard,
}

// Default Extensions

UIView.prototype.parentViewController = function() {
    var parentResponder = this.next
    while (parentResponder) {
        if (parentResponder instanceof UIViewController) {
            return parentResponder
        }
        parentResponder = parentResponder.next
    }
    return null
}