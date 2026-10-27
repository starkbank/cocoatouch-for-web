import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIView, UIControl, UIButton, UIAccessibilityTraits, UIViewController, IBAction, UIKeyCommand } from "../src/index.js"
import { Bind } from "../src/utils/bind.js"


const traits = UIAccessibilityTraits

function viewOn(markup, selector = "#subject") {
    page(markup)
    return new UIView(selector)
}

function subject() {
    return document.getElementById("subject")
}

function attributesOf(element) {
    return Object.fromEntries(Array.from(element.attributes).map((attribute) => [attribute.name, attribute.value]))
}

test("UIAccessibilityTraits holds the published cases, frozen, and none is an empty frozen array", function() {
    assert.deepEqual(Object.keys(traits).sort(), ["button", "header", "link", "none", "notEnabled", "selected"])
    assert.ok(Object.isFrozen(traits))
    assert.deepEqual(traits.none, [])
    assert.ok(Object.isFrozen(traits.none))
})

test("the default is none, and nothing is drawn", function() {
    var view = viewOn("<div id=\"subject\"></div>")
    assert.deepEqual(view.accessibilityTraits, [])
    assert.deepEqual(attributesOf(subject()), {id: "subject"})
})

test("button, link and header draw their role on an element whose native role differs, and clear again", function() {
    var view = viewOn("<div id=\"subject\"></div>")
    for (var [trait, role] of [[traits.button, "button"], [traits.link, "link"], [traits.header, "heading"]]) {
        view.accessibilityTraits = [trait]
        assert.equal(subject().getAttribute("role"), role, trait)
        assert.deepEqual(view.accessibilityTraits, [trait])
        view.accessibilityTraits = []
        assert.equal(subject().hasAttribute("role"), false, trait)
    }
})

test("a native button, link and heading get nothing for the trait they already are", function() {
    var cases = [
        ["<button id=\"subject\"></button>", traits.button],
        ["<input id=\"subject\" type=\"submit\">", traits.button],
        ["<input id=\"subject\" type=\"button\">", traits.button],
        ["<a id=\"subject\" href=\"/x\"></a>", traits.link],
        ["<h1 id=\"subject\"></h1>", traits.header],
        ["<h4 id=\"subject\"></h4>", traits.header],
    ]
    for (var [markup, trait] of cases) {
        var view = viewOn(markup)
        view.accessibilityTraits = [trait]
        assert.equal(subject().hasAttribute("role"), false, markup)
    }
})

test("an element whose native role is another one still gets the role: a link without href, a button element as a link, a heading as a button", function() {
    var anchor = viewOn("<a id=\"subject\"></a>")
    anchor.accessibilityTraits = [traits.link]
    assert.equal(subject().getAttribute("role"), "link")
    var withHref = viewOn("<a id=\"subject\" href=\"/x\"></a>")
    withHref.accessibilityTraits = [traits.button]
    assert.equal(subject().getAttribute("role"), "button")
    var heading = viewOn("<h2 id=\"subject\"></h2>")
    heading.accessibilityTraits = [traits.button]
    assert.equal(subject().getAttribute("role"), "button")
})

test("selected is aria-selected for an item under a listbox, tablist or grid, and aria-pressed for a toggle-like control", function() {
    for (var role of ["listbox", "tablist", "grid", "treegrid", "tree"]) {
        var item = viewOn("<div role=\"" + role + "\"><div id=\"subject\"></div></div>")
        item.accessibilityTraits = [traits.selected]
        assert.equal(subject().getAttribute("aria-selected"), "true", role)
        assert.equal(subject().hasAttribute("aria-pressed"), false, role)
        item.accessibilityTraits = []
        assert.equal(subject().hasAttribute("aria-selected"), false, role)
    }
    var native = viewOn("<button id=\"subject\"></button>")
    native.accessibilityTraits = [traits.selected]
    assert.equal(subject().getAttribute("aria-pressed"), "true")
    assert.equal(subject().hasAttribute("aria-selected"), false)
    native.accessibilityTraits = []
    assert.equal(subject().hasAttribute("aria-pressed"), false)
    var made = viewOn("<div id=\"subject\"></div>")
    made.accessibilityTraits = [traits.button, traits.selected]
    assert.equal(subject().getAttribute("role"), "button")
    assert.equal(subject().getAttribute("aria-pressed"), "true")
})

test("selected on an element that is neither an item of such a container nor toggle-like draws nothing", function() {
    var view = viewOn("<div id=\"subject\"></div>")
    view.accessibilityTraits = [traits.selected]
    assert.deepEqual(attributesOf(subject()), {id: "subject"})
    assert.deepEqual(view.accessibilityTraits, [traits.selected], "the set is kept")
})

test("notEnabled is aria-disabled on a view that is not a control, and clears", function() {
    var view = viewOn("<div id=\"subject\"></div>")
    view.accessibilityTraits = [traits.notEnabled]
    assert.equal(subject().getAttribute("aria-disabled"), "true")
    view.accessibilityTraits = []
    assert.equal(subject().hasAttribute("aria-disabled"), false)
})

test("notEnabled never touches a control's isEnabled, and a control's own disabled state is drawn by isEnabled alone", function() {
    page("<button id=\"subject\">go</button>")
    var button = new UIButton("#subject")
    button.accessibilityTraits = [traits.notEnabled]
    assert.equal(button.isEnabled, true)
    assert.equal(subject().hasAttribute("disabled"), false)
    assert.equal(subject().hasAttribute("aria-disabled"), false)
    button.isEnabled = false
    button.accessibilityTraits = []
    assert.equal(button.isEnabled, false, "clearing the traits does not enable it")
    assert.equal(subject().hasAttribute("disabled"), true)
    page("<div id=\"subject\"></div>")
    var control = new UIControl("#subject")
    control.accessibilityTraits = [traits.notEnabled]
    assert.equal(control.isEnabled, true)
})

test("selected leaves a control's isSelected and its selected class alone", function() {
    page("<div id=\"subject\" role=\"button\"></div>")
    var control = new UIControl("#subject")
    control.accessibilityTraits = [traits.selected]
    assert.equal(control.isSelected, false)
    assert.equal(subject().classList.contains("selected"), false)
    control.isSelected = true
    control.accessibilityTraits = []
    assert.equal(control.isSelected, true)
    assert.equal(subject().classList.contains("selected"), true)
})

test("a combination draws every trait it can, and the next set removes what left it", function() {
    var view = viewOn("<div role=\"tablist\"><div id=\"subject\"></div></div>")
    view.accessibilityTraits = [traits.button, traits.selected, traits.notEnabled]
    assert.deepEqual(attributesOf(subject()), {id: "subject", role: "button", tabindex: "0", "aria-selected": "true", "aria-disabled": "true"})
    view.accessibilityTraits = [traits.selected]
    assert.deepEqual(attributesOf(subject()), {id: "subject", "aria-selected": "true"})
    view.accessibilityTraits = [traits.header, traits.notEnabled]
    assert.deepEqual(attributesOf(subject()), {id: "subject", role: "heading", "aria-disabled": "true"})
})

test("none, and the empty array, clear everything the traits drew", function() {
    var view = viewOn("<div role=\"listbox\"><div id=\"subject\"></div></div>")
    view.accessibilityTraits = [traits.link, traits.selected, traits.notEnabled]
    view.accessibilityTraits = traits.none
    assert.deepEqual(attributesOf(subject()), {id: "subject"})
    assert.deepEqual(view.accessibilityTraits, [])
})

test("when several traits want the role, the most specific wins: header, then link, then button", function() {
    var view = viewOn("<div id=\"subject\"></div>")
    view.accessibilityTraits = [traits.button, traits.link]
    assert.equal(subject().getAttribute("role"), "link")
    view.accessibilityTraits = [traits.button, traits.link, traits.header]
    assert.equal(subject().getAttribute("role"), "heading")
    view.accessibilityTraits = [traits.button]
    assert.equal(subject().getAttribute("role"), "button")
})

test("the getter returns a frozen copy of the set, and duplicates collapse", function() {
    var view = viewOn("<div id=\"subject\"></div>")
    var given = [traits.button, traits.button, traits.header]
    view.accessibilityTraits = given
    given.push(traits.link)
    assert.deepEqual(view.accessibilityTraits, [traits.button, traits.header])
    assert.ok(Object.isFrozen(view.accessibilityTraits))
})

test("the traits touch no other attribute: label, value, expanded status, id and class stay", function() {
    var view = viewOn("<div id=\"subject\" class=\"card\" aria-label=\"Card\"></div>")
    view.accessibilityValue = "3"
    view.accessibilityExpandedStatus = 1
    view.accessibilityTraits = [traits.button, traits.notEnabled]
    view.accessibilityTraits = []
    assert.deepEqual(attributesOf(subject()), {id: "subject", class: "card", "aria-label": "Card", "aria-valuetext": "3", "aria-expanded": "true"})
})

test("a value that is not an array of the cases is refused with Apple's signature, and changes nothing", function() {
    var view = viewOn("<div id=\"subject\"></div>")
    view.accessibilityTraits = [traits.button]
    for (var bad of ["button", [traits.button, "searchField"], [3], null, undefined, {}, 1]) {
        assert.throws(() => { view.accessibilityTraits = bad }, (error) => error instanceof TypeError && /accessibilityTraits/.test(error.message), String(bad))
    }
    assert.equal(subject().getAttribute("role"), "button")
})

test("a re-resolved element gets the traits back when the view is placed again, and a view made in code draws them when placed", function() {
    var view = viewOn("<div id=\"subject\"></div>")
    view.accessibilityTraits = [traits.header]
    page("<div id=\"subject\"></div>")
    assert.equal(subject().hasAttribute("role"), false)
    view.didMoveToSuperview()
    assert.equal(subject().getAttribute("role"), "heading")
    class Made extends UIView {}
    Made.nib = "<div class=\"made\"></div>"
    var made = new Made()
    made.accessibilityTraits = [traits.link, traits.notEnabled]
    view.addSubview(made)
    var element = document.querySelector(".made")
    assert.equal(element.getAttribute("role"), "link")
    assert.equal(element.getAttribute("aria-disabled"), "true")
})

function press(key) {
    var event = new window.KeyboardEvent("keydown", {key: key, bubbles: true, cancelable: true})
    subject().dispatchEvent(event)
    return event
}

function settled() {
    return new Promise((resolve) => setTimeout(resolve, 0))
}

function counted(view) {
    var taps = {count: 0}
    view.$el.on("click", function() { taps.count += 1 })
    return taps
}

test("the button and link traits put an element that is not focusable in the tab order, and leaving them takes it out", function() {
    var view = viewOn("<div id=\"subject\"></div>")
    for (var trait of [traits.button, traits.link]) {
        view.accessibilityTraits = [trait]
        assert.equal(subject().getAttribute("tabindex"), "0", trait)
        view.accessibilityTraits = traits.none
        assert.equal(subject().hasAttribute("tabindex"), false, trait)
    }
    view.accessibilityTraits = [traits.header]
    assert.equal(subject().hasAttribute("tabindex"), false)
})

test("an element that is already focusable keeps its own tab order", function() {
    for (var markup of ["<button id=\"subject\"></button>", "<a id=\"subject\" href=\"/x\"></a>", "<div id=\"subject\" tabindex=\"-1\"></div>"]) {
        var view = viewOn(markup)
        var before = subject().getAttribute("tabindex")
        view.accessibilityTraits = [traits.button, traits.link]
        assert.equal(subject().getAttribute("tabindex"), before, markup)
        view.accessibilityTraits = traits.none
        assert.equal(subject().getAttribute("tabindex"), before, markup)
    }
})

test("Return taps a view with the button or link trait and Space taps only the button, without scrolling", async function() {
    var view = viewOn("<div id=\"subject\"></div>")
    var taps = counted(view)
    view.accessibilityTraits = [traits.button]
    press("Enter")
    assert.equal(press(" ").defaultPrevented, true)
    await settled()
    assert.equal(taps.count, 2)
    view.accessibilityTraits = [traits.link]
    press("Enter")
    assert.equal(press(" ").defaultPrevented, false)
    await settled()
    assert.equal(taps.count, 3)
    view.accessibilityTraits = traits.none
    press("Enter")
    await settled()
    assert.equal(taps.count, 3)
})

test("a key command the page binds to Return takes the key, so the focused view is not tapped, as a native button is not", async function() {
    var fired = []
    class Page extends UIViewController {
        submit() { fired.push("submit") }
    }
    IBAction(UIKeyCommand.inputReturn)(Page.prototype, "submit", {})
    var controller = new Page()
    Bind.ibAction(controller)
    try {
        var view = viewOn("<div id=\"subject\"></div>")
        var taps = counted(view)
        view.accessibilityTraits = [traits.button]
        press("Enter")
        await settled()
        assert.deepEqual(fired, ["submit"])
        assert.equal(taps.count, 0)
    } finally {
        controller._dispose()
    }
})

test("accessibilityActivate answering true handles the activation, so no tap is sent", async function() {
    class Activated extends UIView {
        activations = 0
        accessibilityActivate() {
            this.activations += 1
            return true
        }
    }
    page("<div id=\"subject\"></div>")
    var view = new Activated("#subject")
    var taps = counted(view)
    view.accessibilityTraits = [traits.button]
    press("Enter")
    await settled()
    assert.equal(view.activations, 1)
    assert.equal(taps.count, 0)
    assert.equal(new UIView("#subject").accessibilityActivate(), false)
})

test("a view with the notEnabled trait is not activated from the keyboard", async function() {
    var view = viewOn("<div id=\"subject\"></div>")
    var taps = counted(view)
    view.accessibilityTraits = [traits.button, traits.notEnabled]
    press("Enter")
    press(" ")
    await settled()
    assert.equal(taps.count, 0)
})

test("a native button is left to the browser's own keyboard", async function() {
    var view = viewOn("<button id=\"subject\"></button>")
    var taps = counted(view)
    view.accessibilityTraits = [traits.button]
    press("Enter")
    await settled()
    assert.equal(taps.count, 0)
})

test("Return on a UIButton drawn on a div with the link trait sends its touchUpInside actions, and not while it is disabled", async function() {
    page("<div id=\"subject\"></div>")
    var button = new UIButton("#subject")
    var sent = []
    button.addTarget(null, {action: function() { sent.push("tapped") }, for: UIControl.Event.touchUpInside})
    button.accessibilityTraits = [traits.link]
    press("Enter")
    await settled()
    assert.deepEqual(sent, ["tapped"])
    button.isEnabled = false
    press("Enter")
    await settled()
    assert.deepEqual(sent, ["tapped"])
})
