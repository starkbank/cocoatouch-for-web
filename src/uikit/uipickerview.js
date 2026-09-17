import { UIView } from "./uiview.js"
import { NSString } from "../utils/nsstring.js"


export class UIPickerView extends UIView {

    segments = []
    
    set text(text) {
        var cleanedScriptText = NSString.cleanScript(text)
        $(this.selector).html(cleanedScriptText)
    }

    set delegate(delegate) {
        var pickerView = this
        $(this.selector).on("change", function(e) {
            delegate.pickerViewDidSelectRow({
                pickerView: pickerView,
                row: $(this).prop("selectedIndex"),
                component: 0
            })
        })
    }

    titleForRow(rows) {
        if(rows.length == 0) { return }
        rows.forEach(row => {
            $(this.selector).append("<option value=" + row.value + ">" + row.description + "</option>")
        })
    }

    selectedValue() {
        return $(this.selector).children("option:selected").val()
    }

    set defaultValue(value) {
        $(this.selector).val(value)
    }
}