import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIPickerView } from "../src/index.js"


test("a delegate without pickerViewTitleForRowForComponent reloads without throwing and renders empty titles", function() {
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
    picker.delegate = {pickerViewTitleForRowForComponent: function(pickerView, row, component) { return "Row " + row }}
    assert.deepEqual($("#picker option").map(function() { return $(this).text() }).get(), ["Row 0", "Row 1"])
})

test("a picker delegate carrying a retired name is refused, naming the replacement, and the new names fire", function() {
    page("<select id=\"picker\"></select>")
    var picker = new UIPickerView("#picker")
    picker.dataSource = {pickerViewNumberOfRowsInComponent: function() { return 2 }}
    assert.throws(() => { picker.delegate = {pickerViewTitleForRow: function() { return "x" }} }, (error) => error instanceof TypeError && /pickerViewTitleForRow\b/.test(error.message) && /pickerViewTitleForRowForComponent/.test(error.message))
    assert.throws(() => { picker.delegate = {pickerViewDidSelectRow: function() {}} }, (error) => error instanceof TypeError && /pickerViewDidSelectRowInComponent/.test(error.message))
    var picked = []
    picker.delegate = {
        pickerViewTitleForRowForComponent: function(pickerView, row, component) { return "Row " + row + "/" + component },
        pickerViewDidSelectRowInComponent: function(pickerView, row, component) { picked.push([row, component]) },
    }
    assert.deepEqual($("#picker option").map(function() { return $(this).text() }).get(), ["Row 0/0", "Row 1/0"])
    $("#picker").prop("selectedIndex", 1).trigger("change")
    assert.deepEqual(picked, [[1, 0]])
})
