import { Locale } from "../foundation/locale.js"
import { datePickerDateFormat, datePickerRegional } from "./datepickerlocale.js"
import { UIControl } from "./uicontrol.js"
import { UIControlEvent } from "./uicontrolevent.js"
import { UIDatePickerMode } from "./uidatepickermode.js"
import { required, typed, Bool, DateType } from "../utils/required.js"


// Wraps a jQuery UI datepicker (jquery-ui must be on the page) over the input
// its element already holds, as a nib supplies it, or in an input the picker
// inserts when the element has none. In "time" mode it wraps the
// ClockPicker 0.0.7 plugin (also a page script) the same way, over the same input;
// in "dateAndTime" mode it turns that input into the browser's own datetime-local.
// What showPicker() throws when the browser declines to open it, without a user
// activation or inside a cross-origin frame; the field stays usable by keyboard.
const refusals = ["NotAllowedError", "SecurityError"]

const modes = Object.values(UIDatePickerMode)


export class UIDatePicker extends UIControl {

    static get Mode() {
        return UIDatePickerMode
    }

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
        // What the input's id was when the picker was made, for a reader that wants
        // to find it; the picker itself holds the element and never looks it up.
        this.inputSelector = "#" + (($existing.length > 0 && $existing.attr("id")) || inputId)
        this._adoptInput(this.$el[0])
        this._configure()
    }

    // The input element is held, not found again: it can lose its id (a nib's
    // awakeFromNib renames it) and it is still in use after the controller has
    // emptied the element, when the document no longer has it. It is looked for in
    // the picker's element only when that element is a different node, as a view's
    // own element is (UIView.$el), which is the one case the held input is not
    // the right one; an element that is merely gone changes nothing.
    get $input() {
        var root = this.$el[0]
        if (root && root !== this._root) { this._adoptInput(root) }
        return $(this._input)
    }

    _adoptInput(root) {
        this._root = root
        var found = $(root).find("input")[0]
        if (found) { this._input = found }
    }

    // In time mode only the hours and minutes count: the clock holds "HH:mm", so
    // the date reads as that time today and writing a date keeps its time only.
    set date(date) {
        if (this._mode === "time") {
            this.$input.prop("value", _clockText(date))
            return
        }
        if (this._mode === "dateAndTime") {
            this.$input.prop("value", _localText(date))
            return
        }
        if (this._mode === "yearAndMonth") {
            typed(date, "date", DateType, "UIDatePicker.date", "Apple's is var date: Date, never nil; write picker.date = new Date().")
            this._month = _firstOfMonth(date)
            this.$input.datepicker("setDate", this._month)
            return
        }
        this.$input.datepicker("setDate", date)
    }

    // yearAndMonth holds the month that was picked or written, as the first of
    // it in local time, and the current month until one is: Apple's date is
    // never nil. The widget's text is only "MMMM yyyy", and parsing it back
    // would depend on the locale's month names.
    get date() {
        if (this._mode === "time") { return _timeToday(this.$input.prop("value")) }
        if (this._mode === "yearAndMonth") { return new Date(this._month.getTime()) }
        if (this._mode === "dateAndTime") { return _parseLocal(this.$input.prop("value")) }
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
        if (this._hasCalendar()) {
            this.$input.datepicker("option", "dateFormat", datePickerDateFormat(locale))
        }
        this._configure()
    }

    get locale() {
        return this._locale
    }

    // The clock has no limits, so in time mode the two dates are ignored, and
    // the destroyed calendar is not asked for them. The native input's limits
    // are its min and max, which a mode switch drops with the input's mode.
    set minimumDate(date) {
        if (this._mode === "dateAndTime") { return this._setLimit("min", date) }
        if (this._mode === "time") { return }
        this.$input.datepicker("option", "minDate", date)
    }

    get minimumDate() {
        if (this._mode === "dateAndTime") { return _parseLocal(this.$input.attr("min")) }
        if (this._mode === "time") { return null }
        return this.$input.datepicker("option", "minDate")
    }

    set maximumDate(date) {
        if (this._mode === "dateAndTime") { return this._setLimit("max", date) }
        if (this._mode === "time") { return }
        this.$input.datepicker("option", "maxDate", date)
    }

    get maximumDate() {
        if (this._mode === "dateAndTime") { return _parseLocal(this.$input.attr("max")) }
        if (this._mode === "time") { return null }
        return this.$input.datepicker("option", "maxDate")
    }

    // "date" picks a day, "time" (Apple's .time) picks hours and minutes on a
    // clock, "dateAndTime" (Apple's .dateAndTime) picks both in the browser's
    // own control, "yearAndMonth" hides the calendar and picks a month.
    set datePickerMode(mode) {
        var previous = this._mode
        this._mode = modes.includes(mode) ? mode : "date"
        if (this._mode !== "yearAndMonth") { this._month = null }
        if (this._mode === "yearAndMonth" && previous !== "yearAndMonth") { this._month = _firstOfMonth(new Date()) }
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
        if (this._mode === "dateAndTime" && this._nativeInput) { return }
        this._removeNative()
        this.$input.datepicker("destroy")
        this._calendar = null
        if (this._mode === "time") {
            this._buildClock()
            return
        }
        if (this._mode === "dateAndTime") {
            this._buildNative()
            return
        }
        if (this._mode === "date") {
            this.$input.datepicker({...regional, dateFormat: datePickerDateFormat(this._locale), changeMonth: true, changeYear: true, onSelect: onSelect})
            this._calendar = _calendarOf(this._input)
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
        this._calendar = _calendarOf(this._input)
    }

    // The browser's datetime-local needs a writable input, and its picker opens
    // from showPicker(), which a click on any part of the field asks for, as the
    // calendar icon alone would leave the segments to typing. A selection is the
    // input's own change event, which reaches the element's valueChanged targets
    // by bubbling, so none is sent here; writing a date is not a selection.
    _buildNative() {
        var input = this.$input[0]
        this._nativeInput = {type: input.type, readOnly: input.readOnly}
        input.readOnly = false
        input.type = "datetime-local"
        this.$input.on("click.uidatepicker", () => {
            if (typeof input.showPicker !== "function") { return }
            try {
                input.showPicker()
            } catch (error) {
                if (!refusals.includes(error.name)) { throw error }
            }
        })
    }

    // The text input comes back as it was, empty: an ISO value is no text for the calendar to parse.
    _removeNative() {
        if (!this._nativeInput) { return }
        var input = this.$input[0]
        this.$input.off("click.uidatepicker")
        input.type = this._nativeInput.type
        input.readOnly = this._nativeInput.readOnly
        input.value = ""
        this._nativeInput = null
    }

    _setLimit(name, date) {
        if (date === null) {
            this.$input.removeAttr(name)
            return
        }
        this.$input.attr(name, _localText(date))
    }

    _hasCalendar() {
        return this._mode === "date" || this._mode === "yearAndMonth"
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
        var host = this.$el
        host.clockpicker({
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
        this._clock = host.data("clockpicker")
    }

    // The plugin puts a popover in the body and a resize listener on the window
    // the first time the clock opens, and keeps both until removed, so a picker
    // that goes with its controller must remove the clock too. The calendar is
    // one div the page shares, so an open one is closed with its picker.
    _dispose() {
        this._removeClock()
        this._removeNative()
        if (this._hasCalendar()) {
            this._restoreCalendar()
            this.$input.datepicker("hide")
            this.$input.datepicker("destroy")
        }
        super._dispose()
    }

    // The clock is removed through the plugin's own instance, kept at the
    // build, never through $el. A controller empties its element before it
    // disposes its views, and emptying wipes the plugin's data from the picker's
    // element: $el.clockpicker("remove") would then find no instance, make a
    // fresh one and leave the popover and the window listener where they were.
    // Emptying an element wipes the jQuery data of what is inside it and leaves
    // its classes, and the widget's destroy() then reads an instance that is not
    // there and throws. The instance kept at the build is put back first, so the
    // widget goes properly: its markup removed and an open calendar closed.
    _restoreCalendar() {
        if (!this._calendar || _calendarOf(this._input)) { return }
        $.data(this._input, "datepicker", this._calendar)
    }

    _removeClock() {
        if (!this._clock) { return }
        this._clock.remove()
        this._clock = null
    }
}


// The jQuery UI datepicker's instance, kept in the input's jQuery data; undefined
// where there is none, as with the stand-ins the tests use for the plugin.
function _calendarOf(input) {
    return typeof $.data === "function" ? $.data(input, "datepicker") : undefined
}


// "yyyy-MM-ddTHH:mm" in local time, the value a datetime-local input holds;
// "" for no date, which clears the field.
function _localText(date) {
    if (date === null || isNaN(date.getTime())) { return "" }
    var pad = (number, width) => String(number).padStart(width, "0")
    var day = pad(date.getFullYear(), 4) + "-" + pad(date.getMonth() + 1, 2) + "-" + pad(date.getDate(), 2)
    return day + "T" + pad(date.getHours(), 2) + ":" + pad(date.getMinutes(), 2)
}


// The local Date a datetime-local value names, with its seconds when it has
// them; null for no value or one that is not a real moment (a 30th of February).
function _parseLocal(text) {
    var parsed = /^(\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(text === undefined || text === null ? "" : text).trim())
    if (!parsed) { return null }
    var [year, month, day, hours, minutes, seconds] = parsed.slice(1).map((part) => Number(part || 0))
    var date = new Date(year, month - 1, day, hours, minutes, seconds)
    var isReal = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day && date.getHours() === hours
    return isReal ? date : null
}


// The first of the month of `date`, midnight local.
function _firstOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1)
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
