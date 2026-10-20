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


function lockablePicker() {
    page("<select id=\"picker\"></select><input id=\"other\">")
    var picker = new UIPickerView("#picker")
    picker.dataSource = {pickerViewNumberOfRowsInComponent: () => 3}
    return picker
}

test("isUserInteractionEnabled = false disables the select, so it cannot take the focus or be changed from the keyboard", function() {
    var picker = lockablePicker()
    var select = document.getElementById("picker")
    picker.isUserInteractionEnabled = false
    assert.equal(select.disabled, true)
    assert.equal(select.hasAttribute("disabled"), true)
    select.focus()
    assert.notEqual(document.activeElement, select)
    assert.equal(picker.isUserInteractionEnabled, false)
    assert.equal(select.style.pointerEvents, "none", "the view's own pointer-events stays")
})

test("isUserInteractionEnabled = true restores the select, and the getter round-trips", function() {
    var picker = lockablePicker()
    var select = document.getElementById("picker")
    assert.equal(picker.isUserInteractionEnabled, true)
    picker.isUserInteractionEnabled = false
    picker.isUserInteractionEnabled = true
    assert.equal(select.disabled, false)
    assert.equal(select.hasAttribute("disabled"), false)
    select.focus()
    assert.equal(document.activeElement, select)
    assert.equal(picker.isUserInteractionEnabled, true)
    assert.equal(select.style.pointerEvents, "")
})

test("a locked picker keeps its rows, its selection and its delegate", function() {
    var picker = lockablePicker()
    var chosen = []
    picker.delegate = {pickerViewDidSelectRowInComponent(pickerView, row) { chosen.push(row) }}
    picker.selectRow(2, {inComponent: 0, animated: false})
    picker.isUserInteractionEnabled = false
    assert.equal($("#picker option").length, 3)
    assert.equal(picker.selectedRow({inComponent: 0}), 2)
    picker.isUserInteractionEnabled = true
    document.getElementById("picker").dispatchEvent(new window.Event("change", {bubbles: true}))
    assert.deepEqual(chosen, [2])
})
