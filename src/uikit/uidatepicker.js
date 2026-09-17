import { Locale } from "../foundation/locale.js"
import { UIControl } from "./uicontrol.js"
import { UIControlEvent } from "./uicontrolevent.js"


// Wraps a jQuery UI datepicker (jquery-ui must be on the page) in an input the
// picker inserts into its element when it is empty.
export class UIDatePicker extends UIControl {

    constructor(selector) {
        super(selector)
        this._locale = new Locale("en")
        this._monthOnly = false
        var inputId = selector.replace(/^#/, "").replace(/[^\w-]/g, "-") + "-uidatepicker"
        if (this.$el.children().length === 0) {
            this.$el.append("<input id=\"" + inputId + "\" class=\"input dateinput\" autocomplete=\"off\" readonly=\"readonly\"/>")
        }
        this.inputSelector = "#" + inputId
        this._configure()
    }

    get $input() {
        return $(this.inputSelector)
    }

    set date(date) {
        this.$input.datepicker("setDate", date)
    }

    get date() {
        return this.$input.datepicker("getDate")
    }

    setDate(date, {animated} = {}) {
        this.date = date
    }

    set locale(locale) {
        this._locale = locale
        this.$input.datepicker("option", "dateFormat", locale.dateFormat)
        this._configure()
    }

    get locale() {
        return this._locale
    }

    set minimumDate(date) {
        this.$input.datepicker("option", "minDate", date)
    }

    get minimumDate() {
        return this.$input.datepicker("option", "minDate")
    }

    set maximumDate(date) {
        this.$input.datepicker("option", "maxDate", date)
    }

    get maximumDate() {
        return this.$input.datepicker("option", "maxDate")
    }

    set placeholder(placeholder) {
        this.$input.attr("placeholder", placeholder)
    }

    // "date" picks a day, "yearAndMonth" hides the calendar and picks a month.
    set datePickerMode(mode) {
        this._monthOnly = mode === "yearAndMonth"
        this._configure()
    }

    get datePickerMode() {
        return this._monthOnly ? "yearAndMonth" : "date"
    }

    showOnlyMonth() {
        this.datePickerMode = "yearAndMonth"
    }

    addTarget(target, {action, for: controlEvent}) {
        if (controlEvent !== UIControlEvent.valueChanged) { return }
        this.$input.datepicker("option", "onSelect", (date) => action(target, date))
        if (!this._monthOnly) { return }
        this.$input.datepicker("option", "onClose", () => {
            var month = $("#ui-datepicker-div .ui-datepicker-month :selected").val()
            var year = $("#ui-datepicker-div .ui-datepicker-year :selected").val()
            var date = new Date(year, month, 1)
            this.date = date
            action(target, date)
            setTimeout(() => { this.$input.datepicker("widget").removeClass("hide-calendar") }, 200)
        })
    }

    _configure() {
        var regional = this._locale.regional || {}
        this.$input.datepicker("destroy")
        if (!this._monthOnly) {
            this.$input.datepicker({...regional, dateFormat: this._locale.dateFormat, changeMonth: true, changeYear: true})
            return
        }
        this.$input.datepicker({
            ...regional,
            showButtonPanel: true,
            changeMonth: true,
            changeYear: true,
            dateFormat: "MM yy",
            closeText: this._locale.identifier === "pt-BR" ? "Selecionar" : "Select",
            beforeShow: () => { this.$input.datepicker("widget").addClass("hide-calendar") }
        })
    }
}
