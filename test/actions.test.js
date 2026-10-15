import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBAction, UIView, UIButton, UIViewController } from "../src/index.js"
import { Bind } from "../src/utils/bind.js"


// jsdom's own prototypes, which are not Node's: the spy wraps what the framework calls.
function countQueries(work) {
    var count = 0
    var prototypes = [window.Element.prototype, window.Document.prototype]
    var originals = prototypes.map((prototype) => prototype.querySelectorAll)
    prototypes.forEach(function(prototype, i) {
        prototype.querySelectorAll = function(...args) {
            count += 1
            return originals[i].apply(this, args)
        }
    })
    try {
        work()
    } finally {
        prototypes.forEach((prototype, i) => { prototype.querySelectorAll = originals[i] })
    }
    return count
}

// A view with one UIButton action per selector; each handler records the sender it got.
function actionHost(selectors) {
    class Host extends UIView {
        received = []
    }
    selectors.forEach(function(selector, i) {
        Host.prototype["tap" + i] = function(sender) { this.received.push({method: "tap" + i, sender: sender}) }
        IBAction(selector, UIButton)(Host.prototype, "tap" + i, {})
    })
    return Host
}

function twoCards(actions) {
    var ids = Array.from({length: actions}, (_, i) => "a" + i)
    var markup = (card) => "<div id=\"" + card + "\">" + ids.map((id) => "<button id=\"" + id + "\"></button>").join("") + "</div>"
    page(markup("card-a") + markup("card-b"))
    var Card = actionHost(ids.map((id) => "#" + id))
    return [new Card("#card-a"), new Card("#card-b")]
}

test("binding the actions of a class costs one query per class, however many actions it has", function() {
    var queriesFor = function(actions) {
        var cards = twoCards(actions)
        return countQueries(() => cards.forEach((card) => Bind.ibAction(card)))
    }
    var few = queriesFor(10)
    var many = queriesFor(40)
    assert.equal(many, few)
    assert.equal(few, 2)
})

test("binding class actions over many matching elements costs no query per sender", function() {
    var queriesFor = function(elements) {
        page("<div id=\"card\">" + "<a class=\"go\"></a>".repeat(elements) + "<i class=\"other\"></i></div>")
        var Card = actionHost([".go", ".other"])
        var card = new Card("#card")
        return countQueries(() => Bind.ibAction(card))
    }
    assert.equal(queriesFor(40), queriesFor(10))
})

test("the sender of an id action is the element of its own card, with its identifier", function() {
    page("<div id=\"card-a\"><button id=\"go\"></button></div><div id=\"card-b\"><button id=\"go\"></button></div>")
    var Card = actionHost(["#go"])
    var cardB = new Card("#card-b")
    Bind.ibAction(cardB)
    var inside = document.querySelectorAll("#go")[1]
    $(inside).trigger("click")
    assert.equal(cardB.received.length, 1)
    var sender = cardB.received[0].sender
    assert.ok(sender instanceof UIButton)
    assert.deepEqual(Array.from(sender.$el), [inside])
    assert.equal(sender.identifier, "go")
    assert.equal(sender.selector, "#card-b #go")
})

test("the senders of a class action are its matching elements, each named when it has no id", function() {
    page("<div id=\"card\"><a class=\"go\" id=\"first\"></a><a class=\"go\"></a><u><a class=\"go\"></a></u></div><a class=\"go\"></a>")
    var Card = actionHost([".go", "#filler"])
    var card = new Card("#card")
    Bind.ibAction(card)
    var inside = Array.from(document.querySelectorAll("#card .go"))
    assert.equal(inside.length, 3)
    inside.forEach((element) => $(element).trigger("click"))
    assert.equal(card.received.length, 3)
    card.received.forEach(function(entry, i) {
        assert.deepEqual(Array.from(entry.sender.$el), [inside[i]])
        assert.equal(entry.sender.identifier, inside[i].id)
    })
    assert.deepEqual(inside.map((element) => element.id), ["first", "card-tap0-1", "card-tap0-2"])
    $(document.querySelector("body > .go")).trigger("click")
    assert.equal(card.received.length, 3)
})

test("an action matching nothing binds no sender and leaves the others working", function() {
    page("<div id=\"card\"><b id=\"here\"></b></div>")
    var Card = actionHost(["#nothing", ".nothing", "#here"])
    var card = new Card("#card")
    Bind.ibAction(card)
    $("#here").trigger("click")
    assert.deepEqual(card.received.map((entry) => entry.method), ["tap2"])
})

test("one click runs the handler once, prevents the default and lets the event travel up", function() {
    page("<div id=\"outer\"><div id=\"card\"><b id=\"go\"></b><b id=\"filler\"></b></div></div>")
    var Card = actionHost(["#go", "#filler"])
    var card = new Card("#card")
    Bind.ibAction(card)
    var seenAbove = []
    document.getElementById("outer").addEventListener("click", (e) => seenAbove.push(e))
    var click = new window.MouseEvent("click", {bubbles: true, cancelable: true})
    document.getElementById("go").dispatchEvent(click)
    assert.equal(card.received.length, 1)
    assert.equal(click.defaultPrevented, true)
    assert.equal(seenAbove.length, 1)
    assert.equal(seenAbove[0], click)
})

test("binding the same card twice leaves one handler per element", function() {
    page("<div id=\"card\"><b id=\"go\"></b><b id=\"filler\"></b></div>")
    var Card = actionHost(["#go", "#filler"])
    var card = new Card("#card")
    Bind.ibAction(card)
    Bind.ibAction(card)
    $("#go").trigger("click")
    assert.equal(card.received.length, 1)
})

test("a control built by app code with a bare id has no lent element and still finds its own", function() {
    page("<div id=\"card-a\"><button id=\"go\"></button></div><div id=\"card-b\"><button id=\"go\"></button></div>")
    var button = new UIButton("#go")
    assert.equal(Bind._constructing, null)
    assert.deepEqual(Array.from(button.$el), [document.querySelector("#card-a #go")])
})

test("the lent element is gone once the sender is built, even when its init throws", function() {
    page("<div id=\"card\"><b id=\"go\"></b></div>")
    class Broken extends UIButton {
        init() { throw new Error("init") }
    }
    class Card extends UIView {
        tapped() {}
    }
    IBAction("#go", Broken)(Card.prototype, "tapped", {})
    assert.throws(() => Bind.ibAction(new Card("#card")), /init/)
    assert.equal(Bind._constructing, null)
})

test("a restored page binds the action of a revived view to its own element, once per click", function() {
    Bind._restorePrototypes.clear()
    var taps = []
    class Chip extends UIView {
        closeTapped(sender) { taps.push(sender) }
    }
    IBAction(".chip-close", UIButton)(Chip.prototype, "closeTapped", {})
    class Controller extends UIViewController {}
    page("<cocoatouch><div class=\"chip\"><a class=\"chip-close\" id=\"close-1\"></a></div></cocoatouch>")
    var controller = new Controller()
    controller.restore(controller)
    var queries = countQueries(() => $("#close-1").trigger("click"))
    assert.equal(taps.length, 1)
    assert.equal(taps[0].identifier, "close-1")
    assert.deepEqual(Array.from(taps[0].$el), [document.getElementById("close-1")])
    assert.equal(queries, 0)
})
