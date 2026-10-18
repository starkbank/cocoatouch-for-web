import { Locale } from "../foundation/locale.js"
import { datePickerDateFormat, datePickerRegional } from "./datepickerlocale.js"
import { UIControl } from "./uicontrol.js"
import { UIControlEvent } from "./uicontrolevent.js"
import { required, typed, Bool, DateType } from "../utils/required.js"


// Wraps a jQuery UI datepicker (jquery-ui must be on the page) over the input
// its element already holds, as a nib supplies it, or in an input the picker
// inserts when the element has none. In "time" mode it wraps the
// ClockPicker 0.0.7 plugin (also a page script) the same way, over the same input.
export class UIDatePicker extends UIControl {

    constructor(selector) {
        super(selector)
        this._locale = new Locale("en")
        this._mode = "date"
        var inputId = selector.replace(/^#/, "").replace(/[^\w-]/g, "-") + "-uidatepicker"
        var $existing = this.$el.find("input").first()
        if ($existing.length === 0) {
            this.$el.append("<input id=\"" + inputId + "\" class=\"input dateinput\" autocomplete=\"off\" readonly=\"readonly\"/>")
        }
        if ($existing.length > 0 && !$existing.attr("id")) {
            $existing.attr("id", inputId)
        }
        this.inputSelector = "#" + (($existing.length > 0 && $existing.attr("id")) || inputId)
        this._configure()
    }

    get $input() {
        return $(this.inputSelector)
    }

    // In time mode only the hours and minutes count: the clock holds "HH:mm", so
    // the date reads as that time today and writing a date keeps its time only.
    set date(date) {
        if (this._mode === "time") {
            this.$input.prop("value", _clockText(date))
            return
        }
        this.$input.datepicker("setDate", date)
    }

    get date() {
        if (this._mode === "time") { return _timeToday(this.$input.prop("value")) }
        return this.$input.datepicker("getDate")
    }

    // setDate(_:animated:): animated is required and recorded; the picker does not animate.
    /**
     * @param {Date} date
     * @param {object} options
     * @param {boolean} options.animated
     */
    setDate(date, {animated} = {}) {
        var signature = "Apple's is setDate(_:animated:); write setDate(date, {animated: false})."
        required(animated, "animated", Bool, "UIDatePicker.setDate", signature)
        typed(date, "date", DateType, "UIDatePicker.setDate", signature)
        this.date = date
    }

    set locale(locale) {
        this._locale = locale
        if (this._mode !== "time") {
            this.$input.datepicker("option", "dateFormat", datePickerDateFormat(locale))
        }
        this._configure()
    }

    get locale() {
        return this._locale
    }

    // The clock has no limits, so in time mode the two dates are ignored, and
    // the destroyed calendar is not asked for them.
    set minimumDate(date) {
        if (this._mode === "time") { return }
        this.$input.datepicker("option", "minDate", date)
    }

    get minimumDate() {
        if (this._mode === "time") { return null }
        return this.$input.datepicker("option", "minDate")
    }

    set maximumDate(date) {
        if (this._mode === "time") { return }
        this.$input.datepicker("option", "maxDate", date)
    }

    get maximumDate() {
        if (this._mode === "time") { return null }
        return this.$input.datepicker("option", "maxDate")
    }

    // "date" picks a day, "time" (Apple's .time) picks hours and minutes on a
    // clock, "yearAndMonth" hides the calendar and picks a month.
    set datePickerMode(mode) {
        this._mode = mode === "yearAndMonth" || mode === "time" ? mode : "date"
        this._configure()
    }

    get datePickerMode() {
        return this._mode
    }

    // A selection is a valueChanged control event, so addTarget, removeTarget
    // and sendActions work as on every other control: the action runs on its
    // target with the picker as the sender, and reads the date from picker.date.
    _configure() {
        var regional = datePickerRegional(this._locale)
        var onSelect = () => this.sendActions({for: UIControlEvent.valueChanged})
        this._removeClock()
        this.$input.datepicker("destroy")
        if (this._mode === "time") {
            this._buildClock()
            return
        }
        if (this._mode === "date") {
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
    // ClockPicker is attached to the picker's element, whose input it finds, as
    // the callers have always done; its own markup and options stay the
    // plugin's, and a nib may set the rest as data attributes the plugin reads
    // (data-default, data-donetext), which beat these defaults. The plugin
    // sends a change event only when the value differs, so valueChanged is
    // sent from afterDone alone when it did not, and a close with a value is one
    // valueChanged either way.
    _buildClock() {
        if (!$.fn || typeof $.fn.clockpicker !== "function") {
            throw new TypeError("UIDatePicker.datePickerMode = \"time\" wraps the ClockPicker jQuery plugin, which must be on the page, as the date mode needs jquery-ui.")
        }
        var valueBeforeDone = null
        this.$el.clockpicker({
            placement: "bottom",
            align: "left",
            autoclose: true,
            ...this.$el.data(),
            beforeDone: () => { valueBeforeDone = this.$input.prop("value") },
            afterDone: () => {
                if (this.$input.prop("value") !== valueBeforeDone) { return }
                this.sendActions({for: UIControlEvent.valueChanged})
            },
        })
        this._hasClock = true
    }

    // The plugin puts a popover in the body and a resize listener on the window
    // the first time the clock opens, and keeps both until removed, so a picker
    // that goes with its controller must remove the clock too. The calendar is
    // one div the page shares, so an open one is closed with its picker.
    _dispose() {
        this._removeClock()
        if (this._mode !== "time") {
            this.$input.datepicker("hide")
            this.$input.datepicker("destroy")
        }
        super._dispose()
    }

    _removeClock() {
        if (!this._hasClock) { return }
        this.$el.clockpicker("remove")
        this._hasClock = false
    }
}


// "HH:mm", the text ClockPicker writes in 24-hour mode.
function _clockText(date) {
    var pad = (number) => (number < 10 ? "0" : "") + number
    return pad(date.getHours()) + ":" + pad(date.getMinutes())
}


// The time the clock shows as a Date today; null for what the clock cannot have
// written, so a half-typed field is not read as midnight.
function _timeToday(text) {
    var parsed = /^(\d{1,2}):(\d{2})$/.exec(String(text).trim())
    if (!parsed) { return null }
    var hours = Number(parsed[1])
    var minutes = Number(parsed[2])
    if (hours > 23 || minutes > 59) { return null }
    var today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, 0, 0)
}
