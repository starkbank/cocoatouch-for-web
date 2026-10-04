import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIPickerView } from "../src/index.js"


test("a delegate without pickerViewTitleForRow reloads without throwing and renders empty titles", function() {
    page("<select id=\"picker\"></select>")
    var picker = new UIPickerView("#picker")
    picker.dataSource = {pickerViewNumberOfRowsInComponent: function() { return 3 }}
    picker.delegate = {}
    assert.equal($("#picker option").length, 3)
    assert.deepEqual($("#picker option").map(function() { return $(this).text() }).get(), ["", "", ""])
    assert.equal(picker.numberOfComponents, 1)
})

test("a picker with a data source and no delegate still renders its rows", function() {
    page("<select id=\"picker\"></select>")
    var picker = new UIPickerView("#picker")
    picker.dataSource = {pickerViewNumberOfRowsInComponent: function() { return 2 }}
    assert.equal($("#picker option").length, 2)
    picker.delegate = {pickerViewTitleForRow: function(pickerView, row) { return "Row " + row }}
    assert.deepEqual($("#picker option").map(function() { return $(this).text() }).get(), ["Row 0", "Row 1"])
})
