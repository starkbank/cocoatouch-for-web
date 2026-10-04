import "./setup.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UIButton, UIView, UIControl, UITextField, UIImageView, UILabel, UIImage, UITapGestureRecognizer, UIHoverGestureRecognizer, UIGestureRecognizer, UITableView, UITableViewCell, UIDevice, UIUserInterfaceIdiom, UIControlEvent, UIControlState, UIDatePicker } from "../src/index.js"
import { datePickerDateFormat, datePickerRegional } from "../src/uikit/datepickerlocale.js"
import { Bind } from "../src/utils/bind.js"
import { DispatchGroup, IndexPath, Locale, NSRange, NSNotFound, UIPickerView, UIColor, UITableViewScrollPosition, UISwitch, UIProgressView, UIScrollView, UISearchTextField, UISearchToken, CGPoint } from "../src/index.js"
import { NSString } from "../src/utils/nsstring.js"


test("DispatchGroup notifies once every entered task has left, even when notify comes last", function() {
    var group = new DispatchGroup()
    var done = 0
    group.enter()
    group.enter()
    group.notify(function() { done += 1 })
    group.leave()
    assert.equal(done, 0)
    group.leave()
    assert.equal(done, 1)
    var late = new DispatchGroup()
    late.enter()
    late.leave()
    late.notify(function() { done += 1 })
    assert.equal(done, 2)
})

test("IndexPath carries row and section, item aliases row", function() {
    var indexPath = new IndexPath({row: 3, section: 1})
    assert.equal(indexPath.item, 3)
    assert.equal(new IndexPath({item: 2}).row, 2)
    assert.equal(new IndexPath({row: 0}).section, 0)
    assert.ok(indexPath.isEqual(new IndexPath({row: 3, section: 1})))
    assert.ok(!indexPath.isEqual(new IndexPath({row: 3})))
})

test("Locale exposes its language and region; the date picker keeps the formats", function() {
    var brazil = new Locale("pt-BR")
    assert.equal(brazil.languageCode, "pt")
    assert.equal(brazil.regionCode, "BR")
    assert.equal(datePickerDateFormat(brazil), "dd/mm/yy")
    assert.equal(datePickerRegional(brazil).monthNames[0], "Janeiro")
    assert.equal(datePickerDateFormat(new Locale("fr")), "mm/dd/yy")
})

test("UIDevice.current tells the interface idiom from the user agent", function() {
    Object.defineProperty(globalThis, "navigator", {value: {userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"}, configurable: true})
    UIDevice._current = undefined
    assert.equal(UIDevice.current.userInterfaceIdiom, UIUserInterfaceIdiom.phone)
    Object.defineProperty(globalThis, "navigator", {value: {userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"}, configurable: true})
    UIDevice._current = undefined
    assert.equal(UIDevice.current.userInterfaceIdiom, UIUserInterfaceIdiom.pad)
    Object.defineProperty(globalThis, "navigator", {value: {userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)"}, configurable: true})
    UIDevice._current = undefined
    assert.equal(UIDevice.current.userInterfaceIdiom, UIUserInterfaceIdiom.mac)
    assert.equal(UIDevice.current, UIDevice.current)
})

test("UIUserInterfaceIdiom has only Apple's cases: no web", function() {
    assert.equal(UIUserInterfaceIdiom.web, undefined)
    assert.deepEqual(Object.keys(UIUserInterfaceIdiom).sort(), ["mac", "pad", "phone", "unspecified"])
})

test("NSString.cleanScript defers to DOMPurify when the page loads it", function() {
    assert.equal(NSString.cleanScript("a<script>x</script>b"), "ab")
    globalThis.DOMPurify = {sanitize: function(text) { return "purified:" + text }}
    assert.equal(NSString.cleanScript("hi"), "purified:hi")
    delete globalThis.DOMPurify
})

test("UIButton.showsActivityIndicator swaps the title for a spinner and restores it", function() {
    var button = new UIButton("#send")
    button.setTitle("Send", {for: UIControlState.normal})
    button.showsActivityIndicator = true
    assert.ok(button.showsActivityIndicator)
    assert.match(button.$el.html(), /fa-spin/)
    button.showsActivityIndicator = true
    button.showsActivityIndicator = false
    assert.equal(button.$el.html(), "Send")
    assert.ok(!button.showsActivityIndicator)
})


test("addTarget calls the action with the target and the control", function() {
    var button = new UIButton("#b")
    var seen = null
    var target = {}
    button.addTarget(target, {action: function(t, control) { seen = {t: t, control: control} }, for: UIControlEvent.touchUpInside})
    button.sendActions({for: UIControlEvent.touchUpInside})
    assert.equal(seen.t, target)
    assert.equal(seen.control, button)
})

test("a tap gesture recognizer runs its action on the target with itself as argument", function() {
    var view = new UIView("#card")
    var seen = null
    var target = {name: "controller"}
    var tap = new UITapGestureRecognizer({target: target, action: function(recognizer) { seen = {self: this, recognizer: recognizer} }})
    view.addGestureRecognizer(tap)
    view.$el.trigger("click")
    assert.equal(seen.self, target)
    assert.equal(seen.recognizer, tap)
    assert.equal(tap.view, view)
})

test("a hover recognizer reports began, changed and ended for a mouse and ignores touches", function() {
    var view = new UIView("#menu")
    var states = []
    view.addGestureRecognizer(new UIHoverGestureRecognizer({target: {}, action: function(recognizer) { states.push(recognizer.state) }}))
    var el = view.$el
    el._handlers.pointerenter({originalEvent: {pointerType: "touch"}})
    el._handlers.pointerenter({originalEvent: {pointerType: "mouse"}})
    el._handlers.pointermove({originalEvent: {pointerType: "mouse"}})
    el._handlers.pointerleave({originalEvent: {pointerType: "mouse"}})
    assert.deepEqual(states, [UIGestureRecognizer.State.began, UIGestureRecognizer.State.changed, UIGestureRecognizer.State.ended])
})

test("a view's init hook runs when it is constructed", function() {
    class Ready extends UIView { init() { this.ready = true } }
    assert.equal(new Ready("#r").ready, true)
})

class RowCell extends UITableViewCell {}
RowCell.nib = "<tr><td id=\"title\"></td></tr>"

function tableWithRows(count) {
    var table = new UITableView("#table")
    table.register(RowCell, {forCellReuseIdentifier: "row"})
    var dequeued = []
    table.dataSource = {
        tableViewNumberOfRowsInSection: function() { return count },
        tableViewCellForRowAtIndexPath: function(tableView, indexPath) {
            var cell = tableView.dequeueReusableCell({withIdentifier: "row", for: indexPath})
            dequeued.push(cell)
            return cell
        }
    }
    return {table: table, dequeued: dequeued}
}

test("reloadData dequeues one registered cell per row, bound to its row", function() {
    var setup = tableWithRows(3)
    assert.equal(setup.dequeued.length, 3)
    assert.ok(setup.dequeued[0] instanceof RowCell)
    assert.equal(setup.dequeued[1].reuseIdentifier, "row")
    assert.equal(setup.table.indexPath({for: setup.dequeued[2]}).row, 2)
    assert.equal(setup.table.cellForRow({at: new IndexPath({row: 1})}), setup.dequeued[1])
    assert.equal(setup.table.numberOfRows({inSection: 0}), 3)
    assert.equal(setup.dequeued[0].next, setup.table)
})

test("selection follows allowsMultipleSelection and reports through indexPathsForSelectedRows", function() {
    var table = tableWithRows(3).table
    table.selectRow({at: 0, animated: false, scrollPosition: UITableViewScrollPosition.none})
    table.selectRow({at: new IndexPath({row: 2}), animated: false, scrollPosition: UITableViewScrollPosition.none})
    assert.deepEqual(table.indexPathsForSelectedRows.map(function(p) { return p.row }), [2])
    assert.equal(table.indexPathForSelectedRow.row, 2)
    table.allowsMultipleSelection = true
    table.selectRow({at: 0, animated: false, scrollPosition: UITableViewScrollPosition.none})
    assert.deepEqual(table.indexPathsForSelectedRows.map(function(p) { return p.row }), [2, 0])
    table.deselectRow({at: 2, animated: false})
    assert.deepEqual(table.indexPathsForSelectedRows.map(function(p) { return p.row }), [0])
    table.deselectRow({at: 0, animated: false})
    assert.equal(table.indexPathForSelectedRow, null)
})

test("editing state is a property with an iOS-style setter", function() {
    var table = tableWithRows(1).table
    assert.equal(table.isEditing, false)
    table.setEditing(true, {animated: false})
    assert.equal(table.isEditing, true)
})

test("an image view asks a lottie player on the page to load the animation", function() {
    var view = new UIImageView("#animation")
    var loaded = []
    view._$el = $("<lottie-player></lottie-player>")
    view._$el[0] = {load: function(src) { loaded.push(src) }}
    view.image = new UIImage({named: "/static/intro.json"})
    assert.deepEqual(loaded, ["/static/intro.json"])
})

test("a view class with a nib fills the empty element it is created on", function() {
    class Field extends UIView {}
    Field.nib = "<input class=\"inner\">"
    var originalJQuery = globalThis.$
    var el = originalJQuery("#password")
    el.children = function() { return {length: 0} }
    globalThis.$ = function(selector) { return selector === "#password" ? el : originalJQuery(selector) }
    var field = new Field("#password")
    globalThis.$ = originalJQuery
    assert.equal(el.html(), "<input class=\"inner\">")
    assert.equal(field.selector, "#password")
})

test("alpha and isHidden set inside UIView.animate fade instead of switching", function() {
    var view = new UIView("#fading")
    var el = view.$el
    var calls = []
    el.stop = function() { return el }
    el.delay = function() { return el }
    el.fadeTo = function(duration, value) { calls.push(["fadeTo", duration, value]); return el }
    el.fadeOut = function(duration) { calls.push(["fadeOut", duration]); return el }
    UIView.animate({withDuration: 0.5, animations: function() {
        view.alpha = 1
        view.isHidden = true
    }})
    view.alpha = 0.5
    assert.deepEqual(calls, [["fadeTo", 500, 1], ["fadeOut", 500]])
})

test("tag lives on the element and sendActions fires the mapped event", function() {
    var control = new UIControl("#control")
    var el = control.$el
    var attrs = {}, fired = []
    el.attr = function(name, value) { if (value === undefined) { return attrs[name] } attrs[name] = String(value); return el }
    el.trigger = function(event) { fired.push(event); return el }
    assert.equal(control.tag, 0)
    control.tag = 3
    assert.equal(control.tag, 3)
    control.sendActions({for: UIControlEvent.editingChanged})
    control.sendActions({for: UIControlEvent.touchUpInside})
    assert.deepEqual(fired, ["input", "click"])
})

test("insertSubview places a view's nib without restyling it and links it", function() {
    var parent = new UIView("#parent")
    var child = UIView.loadFromNib("<span>hi</span>")
    var appended = []
    var el = parent.$el
    el.children = function() { return {length: 0} }
    el.append = function(inserted) { appended.push(inserted.html()); return el }
    parent.insertSubview(child, {at: 0})
    assert.equal(appended.length, 1)
    assert.ok(appended[0].indexOf("<span>hi</span>") !== -1)
    assert.deepEqual(parent.subviews, [child])
    assert.equal(child.superview, parent)
    child.removeFromSuperview()
    assert.deepEqual(parent.subviews, [])
})

test("views answer first responder and text fields expose their selection", function() {
    var field = new UITextField("#field")
    var el = field.$el
    var focused = []
    el.trigger = function(event) { focused.push(event); return el }
    el.is = function(selector) { return selector === ":focus" && focused[focused.length - 1] === "focus" }
    el[0] = {selectionStart: 2, selectionEnd: 4, setSelectionRange: function(s, e) { this.selectionStart = s; this.selectionEnd = e }}
    field.becomeFirstResponder()
    assert.ok(field.isFirstResponder)
    assert.deepEqual(field.selectedTextRange, {start: 2, end: 4})
    field.selectedTextRange = {start: 1, end: 1}
    assert.deepEqual(field.selectedTextRange, {start: 1, end: 1})
    field.resignFirstResponder()
    assert.ok(!field.isFirstResponder)
})

test("accessibilityIdentifier renames a view's element and re-targets the view", function() {
    var view = new UIView("#outer .inner")
    var el = view.$el
    var attrs = {}
    el.attr = function(name, value) { if (arguments.length > 1) { attrs[name] = value; return el } return attrs[name] }
    view.accessibilityIdentifier = "outer-inner"
    assert.equal(view.accessibilityIdentifier, "outer-inner")
    assert.equal(view.identifier, "outer-inner")
    assert.equal(view.selector, "#outer-inner")
    assert.equal(view.$el.attr("id"), "outer-inner")
})

test("outlets and added subviews receive ids from their owner without the app naming them", function() {
    class Field extends UIView {}
    IBOutlet(".inner", UITextField)(Field.prototype, "textField", {})
    var field = new Field("#password")
    var inner = field.$el.find(".inner")
    var attrs = {}
    inner.attr = function(name, value) { if (arguments.length > 1) { attrs[name] = value; return inner } return attrs[name] }
    field.$el.find = function() { return inner }
    Bind.ibOutlet(field)
    assert.equal(field.textField.identifier, "password-text-field")
    assert.equal(field.textField.selector, "#password-text-field")
    var box = new UIView("#boxes")
    var first = new UIView(), second = new UIView()
    box.addSubview(first)
    box.addSubview(second)
    assert.equal(first.identifier, "boxes-1")
    assert.equal(second.identifier, "boxes-2")
})

test("UIImageView paints a non-media element with the image as background and gives media a source", function() {
    var box = new UIImageView("#box")
    var css = {}, attrs = {}
    box._$el = {0: {tagName: "DIV"}, length: 1, css: function(name, value) { css[name] = value; return this }, attr: function(name, value) { attrs[name] = value; return this }}
    box.image = new UIImage({named: "/bg.jpg"})
    assert.deepEqual(css, {"background-image": "url(/bg.jpg)"})
    assert.deepEqual(attrs, {})
    var photo = new UIImageView("#photo")
    var photoAttrs = {}
    photo._$el = {0: {tagName: "IMG"}, length: 1, css: function() { return this }, attr: function(name, value) { photoAttrs[name] = value; return this }}
    photo.image = new UIImage({named: "/photo.jpg"})
    assert.deepEqual(photoAttrs, {src: "/photo.jpg"})
})

test("UILabel shrinks its font to fit when adjustsFontSizeToFitWidth is on, down to the minimum scale", function() {
    var label = new UILabel("#price")
    var element = {tagName: "H3", style: {}, offsetParent: {}, clientWidth: 101, scrollWidth: 200}
    globalThis.getComputedStyle = function() { return {fontSize: "48px"} }
    label._$el = {0: element, length: 1, html: function() { return this }, text: function() { return "" }}
    label.text = "R$ 2.915.820"
    assert.equal(element.style.fontSize, undefined)
    label.adjustsFontSizeToFitWidth = true
    label.minimumScaleFactor = 16 / 48
    label.text = "R$ 2.915.820"
    assert.equal(element.style.fontSize, "24px")
    element.scrollWidth = 1000
    label.text = "R$ 2.915.820.000.000"
    assert.equal(element.style.fontSize, "16px")
    delete globalThis.getComputedStyle
})

test("UIControl reflects isEnabled as the disabled attribute and isSelected as the selected class", function() {
    var control = new UIControl("#toggle")
    var attrs = {}, classes = new Set()
    control._$el = {0: {}, length: 1, css: function() { return this }, attr: function(name, value) { attrs[name] = value; return this }, removeAttr: function(name) { delete attrs[name]; return this }, hasClass: function(c) { return classes.has(c) }, toggleClass: function(c, on) { on ? classes.add(c) : classes.delete(c); return this }}
    control.isEnabled = false
    assert.deepEqual(attrs, {disabled: ""})
    assert.equal(control.isEnabled, false)
    control.isEnabled = true
    assert.deepEqual(attrs, {})
    assert.equal(control.isSelected, false)
    control.isSelected = true
    assert.equal(control.isSelected, true)
    control.isSelected = false
    assert.equal(classes.size, 0)
})

test("accessibilityLabel round-trips through aria-label, and through alt on an image", function() {
    var box = new UIView("#box")
    var attrs = {}
    box._$el = {0: {tagName: "DIV"}, length: 1, attr: function(name, value) { if (arguments.length > 1) { attrs[name] = value; return this } return attrs[name] }, removeAttr: function(name) { delete attrs[name]; return this }}
    assert.equal(box.accessibilityLabel, null)
    box.accessibilityLabel = "Close"
    assert.deepEqual(attrs, {"aria-label": "Close"})
    assert.equal(box.accessibilityLabel, "Close")
    box.accessibilityLabel = null
    assert.deepEqual(attrs, {})
    var photo = new UIImageView("#photo")
    var photoAttrs = {}
    photo._$el = {0: {tagName: "IMG"}, length: 1, attr: function(name, value) { if (arguments.length > 1) { photoAttrs[name] = value; return this } return photoAttrs[name] }, removeAttr: function(name) { delete photoAttrs[name]; return this }}
    photo.accessibilityLabel = "A credit card"
    assert.deepEqual(photoAttrs, {alt: "A credit card"})
    assert.equal(photo.accessibilityLabel, "A credit card")
})

// jQuery UI is not on the test page: the stand-in records the datepicker
// options so the test can drive the picker's onSelect as the widget would,
// and its off() really removes a handler, so removeTarget is observable.
function withDatepickerStub(run) {
    var original = globalThis.$
    var options = {}
    globalThis.$ = function(selector) {
        var el = original(selector)
        el.off = function(event) { delete el._handlers[event.split(".")[0]]; return el }
        el.datepicker = function(method, name, value) {
            if (typeof method === "object") { Object.assign(options, method) }
            if (method === "option" && value !== undefined) { options[name] = value }
            if (method === "setDate") { options.date = name }
            if (method === "getDate") { return options.date || null }
            return el
        }
        return el
    }
    try { run(options) } finally { globalThis.$ = original }
}

test("UIDatePicker.addTarget runs the action on the target with the picker as the sender, removeTarget undoes it, other events bind", function() {
    withDatepickerStub(function(options) {
        var picker = new UIDatePicker("#when")
        var seen = []
        var target = {name: "form"}
        var action = function(t, sender) { seen.push({self: this, t: t, sender: sender}) }
        picker.addTarget(target, {action: action, for: UIControlEvent.valueChanged})
        options.onSelect("01/02/2026")
        assert.equal(seen.length, 1)
        assert.equal(seen[0].self, target)
        assert.equal(seen[0].t, target)
        assert.equal(seen[0].sender, picker)
        picker.removeTarget(target, {action: action, for: UIControlEvent.valueChanged})
        options.onSelect("01/03/2026")
        assert.equal(seen.length, 1)
        var began = 0
        picker.addTarget(target, {action: function() { began += 1 }, for: UIControlEvent.editingDidBegin})
        picker.$el.trigger("focus")
        assert.equal(began, 1)
    })
})

test("UIButton keeps a title per state, draws the current state's, and falls back to the normal title", function() {
    var button = new UIButton("#save")
    var html = ""
    var attrs = {}
    button._$el = {0: {}, length: 1, html: function(value) { if (value === undefined) { return html } html = value; return this }, text: function() { return html }, css: function() { return this }, attr: function(name, value) { attrs[name] = value; return this }, removeAttr: function(name) { delete attrs[name]; return this }, hasClass: function() { return false }, toggleClass: function() { return this }}
    button.setTitle("Save", {for: UIControlState.normal})
    button.setTitle("Saving", {for: UIControlState.disabled})
    assert.equal(button.currentTitle, "Save")
    button.isEnabled = false
    assert.equal(button.currentTitle, "Saving")
    assert.equal(button.title({for: UIControlState.normal}), "Save")
    assert.equal(button.title({for: UIControlState.selected}), "Save")
    var plain = new UIButton("#plain")
    var plainHtml = ""
    plain._$el = {0: {}, length: 1, html: function(value) { if (value === undefined) { return plainHtml } plainHtml = value; return this }, text: function() { return plainHtml }, css: function() { return this }, attr: function() { return this }, removeAttr: function() { return this }, hasClass: function() { return false }, toggleClass: function() { return this }}
    plain.setTitle("Send", {for: UIControlState.normal})
    plain.isEnabled = false
    assert.equal(plain.currentTitle, "Send")
})

test("UIControl.state is the active cases, isHighlighted round-trips, and UIControlState has Apple's cases", function() {
    assert.deepEqual([UIControlState.highlighted, UIControlState.selected, UIControlState.focused], ["highlighted", "selected", "focused"])
    var control = new UIControl("#toggle")
    var classes = new Set(), attrs = {}
    control._$el = {0: {}, length: 1, css: function() { return this }, attr: function(name, value) { attrs[name] = value; return this }, removeAttr: function(name) { delete attrs[name]; return this }, hasClass: function(c) { return classes.has(c) }, toggleClass: function(c, on) { on ? classes.add(c) : classes.delete(c); return this }}
    assert.deepEqual(control.state, [UIControlState.normal])
    assert.ok(Object.isFrozen(control.state))
    control.isEnabled = false
    assert.deepEqual(control.state, [UIControlState.disabled])
    control.isEnabled = true
    control.isSelected = true
    assert.deepEqual(control.state, [UIControlState.selected])
    assert.equal(control.isHighlighted, false)
    control.isHighlighted = true
    assert.equal(control.isHighlighted, true)
    assert.ok(classes.has("highlighted"))
    assert.deepEqual(control.state, [UIControlState.highlighted, UIControlState.selected])
    control.isEnabled = false
    assert.deepEqual(control.state, [UIControlState.highlighted, UIControlState.selected, UIControlState.disabled])
    control.isHighlighted = false
    assert.ok(!classes.has("highlighted"))
})

test("NSRange carries location and length, and NSNotFound is a Foundation global", function() {
    var range = new NSRange({location: 2, length: 3})
    assert.equal(range.location, 2)
    assert.equal(range.length, 3)
    assert.equal(NSNotFound, Number.MAX_SAFE_INTEGER)
    assert.equal(NSRange.NSNotFound, undefined)
})

// Swift lets a subclass hold `var title` beside `title(for:)`; JavaScript has
// one namespace, so the field shadows the method on the instance, and the
// framework's own drawing must not go through it.
test("a UIButton subclass that declares its own title member still draws, redraws and reports its title", function() {
    class MenuItem extends UIButton {
        title = ""
    }
    var item = new MenuItem("#item")
    var html = ""
    item._$el = {0: {}, length: 1, html: function(value) { if (value === undefined) { return html } html = value; return this }, text: function() { return html }, css: function() { return this }, attr: function() { return this }, removeAttr: function() { return this }, hasClass: function() { return false }, toggleClass: function() { return this }}
    item.title = "Overview"
    item.setTitle(item.title, {for: UIControlState.normal})
    assert.equal(html, "Overview")
    assert.equal(item.currentTitle, "Overview")
    item.isSelected = true
    item.isEnabled = false
    assert.equal(item.currentTitle, "Overview")
    assert.equal(item.title, "Overview")
    var plain = new UIButton("#plain-title")
    plain._$el = {0: {}, length: 1, html: function() { return this }, text: function() { return "" }, css: function() { return this }, attr: function() { return this }, removeAttr: function() { return this }, hasClass: function() { return false }, toggleClass: function() { return this }}
    plain.setTitle("Save", {for: UIControlState.normal})
    assert.equal(plain.title({for: UIControlState.normal}), "Save")
    assert.equal(plain.title({for: UIControlState.selected}), "Save")
})

// Apple requires these labels; JavaScript cannot refuse at compile time, so
// the call refuses, naming the method and the Swift signature.
function stubbed(control) {
    control._$el = {0: {}, length: 1, html: function() { return this }, text: function() { return "" }, css: function() { return this }, attr: function() { return this }, removeAttr: function() { return this }, hasClass: function() { return false }, toggleClass: function() { return this }, trigger: function() { return this }, on: function() { return this }, off: function() { return this }, prop: function() { return 0 }, empty: function() { return this }, append: function() { return this }, find: function() { return {length: 0, each: function() {}, off: function() { return this }, on: function() { return this }} }}
    return control
}

test("setTitle, title, setTitleColor and titleColor require the state", function() {
    var button = stubbed(new UIButton("#required"))
    var cases = [
        [() => button.setTitle("Save"), "UIButton.setTitle", "setTitle(_:for:)"],
        [() => button.setTitle("Save", {}), "UIButton.setTitle", "setTitle(_:for:)"],
        [() => button.title(), "UIButton.title", "title(for:)"],
        [() => button.title({}), "UIButton.title", "title(for:)"],
        [() => button.setTitleColor(UIColor.white), "UIButton.setTitleColor", "setTitleColor(_:for:)"],
        [() => button.setTitleColor(UIColor.white, {}), "UIButton.setTitleColor", "setTitleColor(_:for:)"],
        [() => button.titleColor(), "UIButton.titleColor", "titleColor(for:)"],
        [() => button.titleColor({}), "UIButton.titleColor", "titleColor(for:)"],
    ]
    for (var [call, method, signature] of cases) {
        assert.throws(call, (error) => error instanceof TypeError && error.message.indexOf(method) !== -1 && error.message.indexOf(signature) !== -1, method)
    }
})

test("sendActions, removeTarget, numberOfRows and selectedRow require their label", function() {
    var control = stubbed(new UIControl("#required-control"))
    var isTypeError = (error) => error instanceof TypeError && /requires a/.test(error.message)
    assert.throws(() => control.sendActions(), isTypeError)
    assert.throws(() => control.sendActions({}), isTypeError)
    var target = {}
    var action = function() {}
    assert.throws(() => control.removeTarget(target), isTypeError)
    assert.throws(() => control.removeTarget(target, {action: action}), isTypeError)
    var picker = stubbed(new UIPickerView("#required-picker"))
    assert.throws(() => picker.numberOfRows(), isTypeError)
    assert.throws(() => picker.selectedRow(), isTypeError)
    var table = stubbed(new UITableView("#required-table"))
    assert.throws(() => table.numberOfRows(), isTypeError)
    assert.throws(() => table.numberOfRows({}), isTypeError)
})

test("the nine still behave when the label is given", function() {
    var button = stubbed(new UIButton("#labelled"))
    var html = ""
    button._$el.html = function(value) { if (value === undefined) { return html } html = value; return this }
    button._$el.text = function() { return html }
    button.setTitle("Save", {for: UIControlState.normal})
    button.setTitle("Saving", {for: UIControlState.disabled})
    assert.equal(button.title({for: UIControlState.normal}), "Save")
    assert.equal(button.title({for: UIControlState.selected}), "Save")
    assert.equal(button.currentTitle, "Save")
    button.isEnabled = false
    assert.equal(button.currentTitle, "Saving")
    button.setTitleColor(UIColor.black, {for: UIControlState.disabled})
    assert.equal(button.titleColor({for: UIControlState.disabled}).cgColor, "#000000")
    var fired = []
    button.addTarget({}, {action: function() { fired.push("tap") }, for: UIControlEvent.touchUpInside})
    button._$el.trigger = function(event) { fired.push(event); return this }
    button.sendActions({for: UIControlEvent.touchUpInside})
    assert.deepEqual(fired, ["click"])
    button.removeTarget({}, {for: UIControlEvent.touchUpInside})
    var picker = stubbed(new UIPickerView("#labelled-picker"))
    assert.equal(picker.numberOfRows({inComponent: 0}), 0)
    assert.equal(picker.selectedRow({inComponent: 0}), 0)
    var table = stubbed(new UITableView("#labelled-table"))
    assert.equal(table.numberOfRows({inSection: 0}), 0)
})

// The animated: and at: labels Apple requires; the guard names the method and
// the Swift signature, as for the state labels.
var isRequiredError = (error) => error instanceof TypeError && /requires a/.test(error.message)

function datepickerStubbed(run) {
    withDatepickerStub(run)
}

test("the animated members require animated:", function() {
    var toggle = stubbed(new UISwitch("#req-switch"))
    var progress = stubbed(new UIProgressView("#req-progress"))
    var scroll = stubbed(new UIScrollView("#req-scroll"))
    var table = stubbed(new UITableView("#req-table"))
    var cases = [
        [() => toggle.setOn(true), "UISwitch.setOn", "setOn(_:animated:)"],
        [() => toggle.setOn(true, {}), "UISwitch.setOn", "setOn(_:animated:)"],
        [() => progress.setProgress(0.5), "UIProgressView.setProgress", "setProgress(_:animated:)"],
        [() => progress.setProgress(0.5, {}), "UIProgressView.setProgress", "setProgress(_:animated:)"],
        [() => table.setEditing(true), "UITableView.setEditing", "setEditing(_:animated:)"],
        [() => table.setEditing(true, {}), "UITableView.setEditing", "setEditing(_:animated:)"],
        [() => scroll.setContentOffset(CGPoint.zero), "UIScrollView.setContentOffset", "setContentOffset(_:animated:)"],
        [() => scroll.setContentOffset(CGPoint.zero, {}), "UIScrollView.setContentOffset", "setContentOffset(_:animated:)"],
    ]
    for (var [call, method, signature] of cases) {
        assert.throws(call, (error) => isRequiredError(error) && error.message.indexOf(method) !== -1 && error.message.indexOf(signature) !== -1, method)
    }
    datepickerStubbed(function() {
        var picker = new UIDatePicker("#req-date")
        assert.throws(() => picker.setDate(new Date()), (error) => isRequiredError(error) && error.message.indexOf("UIDatePicker.setDate") !== -1 && error.message.indexOf("setDate(_:animated:)") !== -1)
        assert.throws(() => picker.setDate(new Date(), {}), isRequiredError)
    })
})

test("the picker and table row members require every label Apple requires", function() {
    var picker = stubbed(new UIPickerView("#req-picker"))
    assert.throws(() => picker.selectRow(1, {animated: false}), (error) => isRequiredError(error) && /inComponent/.test(error.message))
    assert.throws(() => picker.selectRow(1, {inComponent: 0}), (error) => isRequiredError(error) && /animated/.test(error.message))
    assert.throws(() => picker.selectRow(1), isRequiredError)
    var table = stubbed(new UITableView("#req-rows"))
    assert.throws(() => table.selectRow({animated: false, scrollPosition: UITableViewScrollPosition.none}), (error) => isRequiredError(error) && /\bat\b/.test(error.message))
    assert.throws(() => table.selectRow({at: 0, scrollPosition: UITableViewScrollPosition.none}), (error) => isRequiredError(error) && /animated/.test(error.message))
    assert.throws(() => table.selectRow({at: 0, animated: false}), (error) => isRequiredError(error) && /scrollPosition/.test(error.message))
    assert.throws(() => table.deselectRow({animated: false}), (error) => isRequiredError(error) && /\bat\b/.test(error.message))
    assert.throws(() => table.deselectRow({at: 0}), (error) => isRequiredError(error) && /animated/.test(error.message))
})

test("insertToken and insertSubview require at:", function() {
    var field = stubbed(new UISearchTextField("#req-search"))
    assert.throws(() => field.insertToken(new UISearchToken({text: "a"})), (error) => isRequiredError(error) && /UISearchTextField.insertToken/.test(error.message) && /insertToken\(_:at:\)/.test(error.message))
    assert.throws(() => field.insertToken(new UISearchToken({text: "a"}), {}), isRequiredError)
    var parent = new UIView("#req-parent")
    assert.throws(() => parent.insertSubview(new UIView()), (error) => isRequiredError(error) && /UIView.insertSubview/.test(error.message) && /insertSubview\(_:at:\)/.test(error.message))
    assert.throws(() => parent.insertSubview(new UIView(), {}), isRequiredError)
})

test("the eleven still behave when the labels are given", function() {
    var toggle = stubbed(new UISwitch("#ok-switch"))
    var checked = false
    toggle._$el.prop = function(name, value) { if (value === undefined) { return checked } checked = value; return this }
    toggle.setOn(true, {animated: false})
    assert.equal(toggle.isOn, true)
    var progress = stubbed(new UIProgressView("#ok-progress"))
    var css = {}
    var bar = {stop: function() { return bar }, css: function(name, value) { css[name] = value; return bar }, animate: function() { css.animated = true; return bar }}
    progress._$el.width = function() { return 200 }
    progress._$el.children = function() { return bar }
    progress.setProgress(0.5, {animated: false})
    assert.equal(css.left, 100)
    var picker = stubbed(new UIPickerView("#ok-picker"))
    var selectedIndex = 0
    picker._$el.prop = function(name, value) { if (value === undefined) { return selectedIndex } selectedIndex = value; return this }
    picker.selectRow(2, {inComponent: 0, animated: false})
    assert.equal(picker.selectedRow({inComponent: 0}), 2)
    var setup = tableWithRows(3)
    setup.table.selectRow({at: 1, animated: false, scrollPosition: UITableViewScrollPosition.none})
    assert.equal(setup.table.indexPathForSelectedRow.row, 1)
    setup.table.deselectRow({at: 1, animated: false})
    assert.equal(setup.table.indexPathForSelectedRow, null)
    setup.table.setEditing(true, {animated: false})
    assert.equal(setup.table.isEditing, true)
    assert.equal(UITableView.ScrollPosition, UITableViewScrollPosition)
    assert.deepEqual(Object.keys(UITableViewScrollPosition).sort(), ["bottom", "middle", "none", "top"])
})
