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
        if (rows.length === 0) { return }
        this.$el.empty()
        rows.forEach((row) => {
            this.$el.append("<option value=\"" + row.value + "\">" + row.description + "</option>")
        })
    }

    selectedValue() {
        return this.$el.children("option:selected").val() || ""
    }

    selectedDescription() {
        return this.$el.children("option:selected").text() || ""
    }

    set defaultValue(value) {
        this.$el.val(value)
    }

    set userInteractionEnabled(bool) {
        this.$el.prop("disabled", !bool)
        this.$el.css("pointer-events", bool ? "" : "none")
    }

    get userInteractionEnabled() {
        return !this.$el.prop("disabled")
    }
}