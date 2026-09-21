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

    get numberOfComponents() {
        var dataSource = this.dataSource
        if (dataSource && dataSource.numberOfComponentsInPickerView) { return dataSource.numberOfComponentsInPickerView(this) }
        return 1
    }

    numberOfRows({inComponent} = {inComponent: 0}) {
        var dataSource = this.dataSource
        if (!dataSource) { return 0 }
        return dataSource.pickerViewNumberOfRowsInComponent(this, inComponent)
    }

    reloadAllComponents() {
        var delegate = this.delegate
        if (!this.dataSource || !delegate) { return }
        var selected = this.$el.prop("selectedIndex")
        this.$el.empty()
        var rows = this.numberOfRows({inComponent: 0})
        for (var row = 0; row < rows; row++) {
            var title = NSString.cleanScript(delegate.pickerViewTitleForRow(this, row, 0))
            this.$el.append("<option value=\"" + row + "\">" + title + "</option>")
        }
        if (selected >= 0 && selected < rows) { this.$el.prop("selectedIndex", selected) }
    }

    selectRow(row, {inComponent, animated} = {}) {
        this.$el.prop("selectedIndex", row)
    }

    selectedRow({inComponent} = {inComponent: 0}) {
        var index = this.$el.prop("selectedIndex")
        return index === undefined || index === null ? -1 : index
    }
}
