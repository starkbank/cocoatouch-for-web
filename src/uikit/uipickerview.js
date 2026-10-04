import { UIView } from "./uiview.js"
import { NSString } from "../utils/nsstring.js"


// A <select> driven like UIPickerView: the data source counts the rows, the
// delegate titles them and hears the selection.
export class UIPickerView extends UIView {

    set dataSource(dataSource) {
        this._dataSource = dataSource
        this.reloadAllComponents()
    }

    get dataSource() {
        return this._dataSource || null
    }

    set delegate(delegate) {
        this._delegate = delegate
        this.$el.off("change.picker").on("change.picker", () => {
            if (delegate && delegate.pickerViewDidSelectRow) {
                delegate.pickerViewDidSelectRow(this, this.selectedRow({inComponent: 0}), 0)
            }
        })
        this.reloadAllComponents()
    }

    get delegate() {
        return this._delegate || null
    }

    // Apple marks numberOfComponents(in:) required; this falls back to one on
    // purpose, since four consumer repos set a picker data source without it.
    get numberOfComponents() {
        var dataSource = this.dataSource
        if (dataSource && dataSource.numberOfComponentsInPickerView) { return dataSource.numberOfComponentsInPickerView(this) }
        return 1
    }

    numberOfRows(options) {
        var inComponent = _required(options, "inComponent", "UIPickerView.numberOfRows", "numberOfRows({inComponent: 0}). Apple's is numberOfRows(inComponent:)")
        var dataSource = this.dataSource
        if (!dataSource) { return 0 }
        return dataSource.pickerViewNumberOfRowsInComponent(this, inComponent)
    }

    // pickerView(_:titleForRow:forComponent:) is optional; a delegate that
    // supplies no title, or no delegate at all, renders blank rows, as UIKit does.
    reloadAllComponents() {
        if (!this.dataSource) { return }
        var delegate = this.delegate
        var selected = this.$el.prop("selectedIndex")
        this.$el.empty()
        var rows = this.numberOfRows({inComponent: 0})
        for (var row = 0; row < rows; row++) {
            var title = delegate && delegate.pickerViewTitleForRow ? delegate.pickerViewTitleForRow(this, row, 0) : null
            var text = title === null || title === undefined ? "" : NSString.cleanScript(String(title))
            this.$el.append("<option value=\"" + row + "\">" + text + "</option>")
        }
        if (selected >= 0 && selected < rows) { this.$el.prop("selectedIndex", selected) }
    }

    selectRow(row, {inComponent, animated} = {}) {
        this.$el.prop("selectedIndex", row)
    }

    selectedRow(options) {
        _required(options, "inComponent", "UIPickerView.selectedRow", "selectedRow({inComponent: 0}). Apple's is selectedRow(inComponent:)")
        var index = this.$el.prop("selectedIndex")
        return index === undefined || index === null ? -1 : index
    }
}

// Apple requires the label; JavaScript cannot refuse at compile time, so the
// call refuses instead and names what to write.
function _required(options, label, method, signature) {
    if (!options || options[label] === undefined) {
        throw new TypeError(`${method} requires a ${label}: ${signature}`)
    }
    return options[label]
}
