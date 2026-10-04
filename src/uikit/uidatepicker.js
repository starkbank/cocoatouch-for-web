import { Locale } from "../foundation/locale.js"
import { datePickerDateFormat, datePickerRegional } from "./datepickerlocale.js"
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

    // setDate(_:animated:): animated is required and recorded; the picker does not animate.
    setDate(date, options) {
        _required(options, "animated", "UIDatePicker.setDate", "setDate(date, {animated: false}). Apple's is setDate(_:animated:)")
        this.date = date
    }

    set locale(locale) {
        this._locale = locale
        this.$input.datepicker("option", "dateFormat", datePickerDateFormat(locale))
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

    // "date" picks a day, "yearAndMonth" hides the calendar and picks a month.
    set datePickerMode(mode) {
        this._monthOnly = mode === "yearAndMonth"
        this._configure()
    }

    get datePickerMode() {
        return this._monthOnly ? "yearAndMonth" : "date"
    }

    // A selection is a valueChanged control event, so addTarget, removeTarget
    // and sendActions work as on every other control: the action runs on its
    // target with the picker as the sender, and reads the date from picker.date.
    _configure() {
        var regional = datePickerRegional(this._locale)
        var onSelect = () => this.sendActions({for: UIControlEvent.valueChanged})
        this.$input.datepicker("destroy")
        if (!this._monthOnly) {
            this.$input.datepicker({...regional, dateFormat: datePickerDateFormat(this._locale), changeMonth: true, changeYear: true, onSelect: onSelect})
            return
        }
        this.$input.datepicker({
            ...regional,
            showButtonPanel: true,
            changeMonth: true,
            changeYear: true,
            dateFormat: "MM yy",
            closeText: this._locale.identifier === "pt-BR" ? "Selecionar" : "Select",
            beforeShow: () => { this.$input.datepicker("widget").addClass("hide-calendar") },
            onSelect: onSelect,
            onClose: () => {
                var month = $("#ui-datepicker-div .ui-datepicker-month :selected").val()
                var year = $("#ui-datepicker-div .ui-datepicker-year :selected").val()
                this.date = new Date(year, month, 1)
                this.sendActions({for: UIControlEvent.valueChanged})
                setTimeout(() => { this.$input.datepicker("widget").removeClass("hide-calendar") }, 200)
            },
        })
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
