import { UIView } from "./uiview.js"
import { NSString } from "../utils/nsstring.js"
import { rejectRetiredDelegateNames } from "../utils/delegateNames.js"
import { required } from "../utils/required.js"


const retiredDelegateNames = {pickerViewTitleForRow: "pickerViewTitleForRowForComponent", pickerViewDidSelectRow: "pickerViewDidSelectRowInComponent"}


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
        rejectRetiredDelegateNames(delegate, retiredDelegateNames, "UIPickerView.delegate")
        this._delegate = delegate
        this.$el.off("change.picker").on("change.picker", () => {
            if (delegate && delegate.pickerViewDidSelectRowInComponent) {
                delegate.pickerViewDidSelectRowInComponent(this, this.selectedRow({inComponent: 0}), 0)
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
        var inComponent = required(options, "inComponent", "UIPickerView.numberOfRows", "numberOfRows({inComponent: 0}). Apple's is numberOfRows(inComponent:)")
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
            var title = delegate && delegate.pickerViewTitleForRowForComponent ? delegate.pickerViewTitleForRowForComponent(this, row, 0) : null
            var text = title === null || title === undefined ? "" : NSString.cleanScript(String(title))
            this.$el.append("<option value=\"" + row + "\">" + text + "</option>")
        }
        if (selected >= 0 && selected < rows) { this.$el.prop("selectedIndex", selected) }
    }

    // selectRow(_:inComponent:animated:): both labels required; one component, no animation.
    selectRow(row, options) {
        required(options, "inComponent", "UIPickerView.selectRow", "selectRow(row, {inComponent: 0, animated: false}). Apple's is selectRow(_:inComponent:animated:)")
        required(options, "animated", "UIPickerView.selectRow", "selectRow(row, {inComponent: 0, animated: false}). Apple's is selectRow(_:inComponent:animated:)")
        this.$el.prop("selectedIndex", row)
    }

    selectedRow(options) {
        required(options, "inComponent", "UIPickerView.selectedRow", "selectedRow({inComponent: 0}). Apple's is selectedRow(inComponent:)")
        var index = this.$el.prop("selectedIndex")
        return index === undefined || index === null ? -1 : index
    }
}
