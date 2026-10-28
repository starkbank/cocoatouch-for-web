// A layout for jsdom, which has none: every rect, client size and scroll offset a table's code reads comes back from a model the test
// states, so the row arithmetic can be asserted to the pixel. Import it after test/dom.js.
//
// The model is vertical only:
//   - layout.table(table, {top, width, padding}) places a table at `top` in unscrolled document coordinates; `padding` is the inline
//     space between its border box and its content box, which a ResizeObserver does not count; its rows stack from there in
//     document order, each as tall as its data-height attribute, else its inline height (a spacer), else the `rowHeight` option;
//   - an element, or any ancestor, with display: none or [hidden] has no size, and neither do the rows in it;
//   - layout.box(element, {top, height}) gives an element a box of its own, layout.scroller(...) makes that box scroll its content, and
//     any other container takes the rect of the tables inside it, as a block of auto height does;
//   - a row whose computed display is not table-row (flex, grid, block) is a box, not a table row: the cells it holds are not columns,
//     and the row is one column of the table, the anonymous cell the browser wraps every such row in, as wide as it asks to be;
//   - the document scrolls by window.scrollY, which scrollTo and scrollBy clamp to the page, and rects are read in client coordinates.
// Scroll events and ResizeObserver reports are queued and delivered by layout.flushFrames(), in the order a browser's frame has them:
// scroll events, animation-frame callbacks, resize reports. Every read of layout and every mutation of the document is logged so a
// test can assert that a pass reads in one batch and then writes.
export function installLayout({innerHeight = 768, innerWidth = 1024, rowHeight = 0} = {}) {
    var win = globalThis.window
    var doc = globalThis.document
    var proto = win.Element.prototype
    var tables = new Map()
    var boxes = new Map()
    var pendingScrolls = new Set()
    var frames = new Map()
    var pendingResizes = []
    var observers = new Set()
    var log = []
    var scrollY = 0
    var nextFrame = 1
    var restores = []
    var anchored = null

    var rawComputed = win.getComputedStyle.bind(win)
    var writes = new win.MutationObserver(function() {})
    writes.observe(doc, {subtree: true, childList: true, attributes: true, characterData: true})

    function noteWrites() {
        if (writes.takeRecords().length === 0) { return }
        push("write")
        keepAnchorStill()
    }

    // What a browser's scroll anchoring does after layout changes above the anchored element: it scrolls by the drift, so the element
    // stays where the user saw it.
    function keepAnchorStill() {
        if (!anchored) { return }
        var drift = clientRect(anchored.element).top - anchored.top
        if (drift !== 0) { scrollElementTo(doc.documentElement, scrollY + drift) }
        anchored.top = clientRect(anchored.element).top
    }

    function push(kind) {
        if (log[log.length - 1] !== kind) { log.push(kind) }
    }

    function logged(read) {
        return function() {
            noteWrites()
            push("read")
            return read.apply(this, arguments)
        }
    }

    function patch(target, name, descriptor) {
        var original = Object.getOwnPropertyDescriptor(target, name)
        Object.defineProperty(target, name, Object.assign({configurable: true}, descriptor))
        restores.push(function() {
            if (original) { Object.defineProperty(target, name, original) } else { delete target[name] }
        })
    }

    function patchValue(target, name, value) {
        patch(target, name, {value: value, writable: true})
    }

    function isHidden(element) {
        for (var node = element; node && node.nodeType === 1; node = node.parentNode) {
            if (node.style && node.style.display === "none") { return true }
            if (node.hasAttribute("hidden")) { return true }
        }
        return false
    }

    function heightOfRow(row) {
        if (isHidden(row)) { return 0 }
        var declared = row.getAttribute("data-height")
        if (declared !== null) { return Number(declared) }
        return parseFloat(row.style.height) || rowHeight
    }

    function rowsOf(table) {
        return Array.from(table.querySelectorAll("tr"))
    }

    function sumRows(rows) {
        return rows.reduce(function(sum, row) { return sum + heightOfRow(row) }, 0)
    }

    function precedes(row, element) {
        return (element.compareDocumentPosition(row) & win.Node.DOCUMENT_POSITION_PRECEDING) !== 0 && !element.contains(row)
    }

    // Unscrolled document coordinates.
    function rectOf(element) {
        var empty = {top: 0, left: 0, width: 0, height: 0}
        if (isHidden(element)) { return empty }
        if (tables.has(element)) { return {top: tables.get(element).top, left: 0, width: tables.get(element).width, height: sumRows(rowsOf(element))} }
        if (boxes.has(element)) { return {top: boxes.get(element).top, left: 0, width: 1000, height: boxes.get(element).height} }
        var tag = element.tagName.toLowerCase()
        if (tag === "tr") { return rectOfRow(element) }
        if (tag === "td" || tag === "th") { return rectOfCell(element) }
        if (tag === "tbody" || tag === "thead" || tag === "tfoot") { return rectOfSection(element) }
        return rectOfContainer(element, empty)
    }

    function rectOfRow(row) {
        var measured = measuringWidth(row)
        if (measured !== null) { return {top: 0, left: 0, width: measured, height: 0} }
        var table = row.closest("table")
        if (!table || !tables.has(table)) { return {top: 0, left: 0, width: 0, height: heightOfRow(row)} }
        var before = rowsOf(table).filter(function(other) { return precedes(other, row) })
        return {top: tables.get(table).top + sumRows(before), left: 0, width: tables.get(table).width, height: heightOfRow(row)}
    }

    // The horizontal model: what a cell asks of its column comes from its data-min and data-max, or from the inline-block spans a
    // spacer's replay puts in it (their widths add up to its max-content, the widest is its min-content).
    function intrinsicOf(cell) {
        var min = cell.getAttribute("data-min")
        var max = cell.getAttribute("data-max")
        if (min !== null || max !== null) { return {min: Number(min || 0), max: Number(max || 0)} }
        var widths = Array.from(cell.querySelectorAll("span")).map(function(span) { return parseFloat(span.style.width) || 0 })
        return {min: widths.length ? Math.max.apply(null, widths) : 0, max: widths.reduce(function(sum, width) { return sum + width }, 0)}
    }

    // The border box is the content plus the cell's own horizontal padding and border, read unlogged from the style the page gives it.
    // A computed style costs a pass over every rule of the page, so a cell's extras are kept for its tag and class while the page's
    // style elements are as they were.
    var extrasCache = new Map()

    function extrasOf(cell) {
        var epoch = Array.from(doc.querySelectorAll("style")).map(function(style) { return style.textContent.length }).join(",")
        var key = cell.tagName + "|" + cell.className + "|" + epoch
        if (extrasCache.has(key)) { return extrasCache.get(key) }
        var style = rawComputed(cell)
        var total = 0
        for (var property of ["padding-left", "padding-right", "border-left-width", "border-right-width"]) { total += parseFloat(style.getPropertyValue(property)) || 0 }
        extrasCache.set(key, total)
        return total
    }

    // A cell sized by a width keyword, as the measuring box does, is as wide as that keyword says, whatever display it was given or
    // kept; so is a row that keeps its own display and is sized by the keyword, which asks for what the row itself says in data-min
    // and data-max.
    function measuringWidth(element) {
        var keyword = element.style.getPropertyValue("width")
        var display = element.style.getPropertyValue("display")
        if (element.tagName.toLowerCase() === "tr" ? display !== "" : display === "none") { return null }
        if (keyword === "max-content") { return intrinsicOf(element).max + extrasOf(element) }
        if (keyword === "min-content") { return intrinsicOf(element).min + extrasOf(element) }
        return null
    }

    // A row is a table row under these displays; under any other it is a box, and the browser wraps it, with the boxes beside it, in
    // one anonymous row and cell.
    function isBoxRow(row) {
        return !["table-row", "contents", "none", ""].includes(rawComputed(row).getPropertyValue("display"))
    }

    function rectOfCell(cell) {
        // a measured cell is laid out on its own, so its row's place among the others is not needed
        var measured = measuringWidth(cell)
        if (measured !== null) { return {top: 0, left: 0, width: measured, height: 0} }
        var row = rectOfRow(cell.parentNode)
        if (isBoxRow(cell.parentNode)) { return {top: row.top, left: 0, width: row.width, height: row.height} }
        var width = row.width / cell.parentNode.children.length
        return {top: row.top, left: width * Array.from(cell.parentNode.children).indexOf(cell), width: width, height: row.height}
    }

    function rectOfSection(section) {
        var table = section.closest("table")
        if (!table || !tables.has(table)) { return {top: 0, left: 0, width: 0, height: 0} }
        var before = rowsOf(table).filter(function(other) { return precedes(other, section) })
        return {top: tables.get(table).top + sumRows(before), left: 0, width: tables.get(table).width, height: sumRows(rowsOf(section))}
    }

    function rectOfContainer(element, empty) {
        var inside = Array.from(element.querySelectorAll("table")).filter(function(table) { return tables.has(table) })
        if (inside.length === 0) { return empty }
        var rects = inside.map(rectOf)
        var top = Math.min.apply(null, rects.map(function(rect) { return rect.top }))
        var bottom = Math.max.apply(null, rects.map(function(rect) { return rect.top + rect.height }))
        return {top: top, left: 0, width: rects[0].width, height: bottom - top}
    }

    function documentHeight() {
        var bottoms = Array.from(tables.keys()).map(function(table) { var rect = rectOf(table); return rect.top + rect.height })
        return Math.max.apply(null, [innerHeight].concat(bottoms))
    }

    function isRoot(element) {
        return element === doc.documentElement || element === doc.body
    }

    function scrollersAbove(element) {
        var found = []
        for (var node = element.parentNode; node && node.nodeType === 1; node = node.parentNode) {
            if (boxes.has(node) && boxes.get(node).scrolls) { found.push(node) }
        }
        return found
    }

    function clientRect(element) {
        if (isRoot(element)) { return {top: -scrollY, left: 0, width: innerWidth, height: documentHeight()} }
        var rect = rectOf(element)
        var shift = scrollY + scrollersAbove(element).reduce(function(sum, scroller) { return sum + boxes.get(scroller).scrollTop }, 0)
        return {top: rect.top - shift, left: rect.left, width: rect.width, height: rect.height}
    }

    function clientHeightOf(element) {
        if (element === doc.documentElement) { return innerHeight }
        if (boxes.has(element)) { return boxes.get(element).height }
        return clientRect(element).height
    }

    function scrollHeightOf(element) {
        if (isRoot(element)) { return documentHeight() }
        if (!boxes.has(element) || !boxes.get(element).scrolls) { return clientRect(element).height }
        var inside = Array.from(element.querySelectorAll("table")).filter(function(table) { return tables.has(table) })
        var bottoms = inside.map(function(table) { var rect = rectOf(table); return rect.top + rect.height })
        return Math.max.apply(null, [boxes.get(element).height].concat(bottoms.map(function(bottom) { return bottom - boxes.get(element).top })))
    }

    function scrollTopOf(element) {
        if (isRoot(element)) { return scrollY }
        return boxes.has(element) && boxes.get(element).scrolls ? boxes.get(element).scrollTop : 0
    }

    // Scrolling moves the position at once and queues the scroll event for the frame, as a browser does.
    function scrollElementTo(element, y) {
        var isPage = isRoot(element)
        var current = scrollTopOf(element)
        if (!isPage && !(boxes.has(element) && boxes.get(element).scrolls)) { return }
        var target = Math.max(0, Math.min(y, scrollHeightOf(element) - clientHeightOf(isPage ? doc.documentElement : element)))
        if (target === current) { return }
        if (isPage) { scrollY = target } else { boxes.get(element).scrollTop = target }
        pendingScrolls.add(isPage ? win : element)
        if (anchored) { anchored.top = clientRect(anchored.element).top }
    }

    function argumentTop(args, current) {
        if (typeof args[0] === "object" && args[0] !== null) { return args[0].top === undefined ? current : args[0].top }
        return args[1]
    }

    function argumentDelta(args) {
        if (typeof args[0] === "object" && args[0] !== null) { return args[0].top || 0 }
        return args[1] || 0
    }

    patch(win, "scrollY", {get: logged(function() { return scrollY })})
    patch(win, "pageYOffset", {get: logged(function() { return scrollY })})
    patchValue(win, "scrollTo", function() { scrollElementTo(doc.documentElement, argumentTop(arguments, scrollY)) })
    patchValue(win, "scroll", win.scrollTo)
    patchValue(win, "scrollBy", function() { scrollElementTo(doc.documentElement, scrollY + argumentDelta(arguments)) })
    patchValue(win, "innerHeight", innerHeight)
    patchValue(win, "innerWidth", innerWidth)
    patch(doc, "scrollingElement", {get: function() { return doc.documentElement }})
    patchValue(proto, "getBoundingClientRect", logged(function() {
        var rect = clientRect(this)
        return {x: rect.left, y: rect.top, top: rect.top, left: rect.left, bottom: rect.top + rect.height, right: rect.left + rect.width, width: rect.width, height: rect.height}
    }))
    patch(proto, "clientHeight", {get: logged(function() { return clientHeightOf(this) })})
    patch(proto, "clientWidth", {get: logged(function() { return isRoot(this) ? innerWidth : clientRect(this).width })})
    patch(proto, "clientTop", {get: logged(function() { return 0 })})
    patch(proto, "scrollHeight", {get: logged(function() { return scrollHeightOf(this) })})
    patch(proto, "scrollTop", {
        get: logged(function() { return scrollTopOf(this) }),
        set: function(value) { scrollElementTo(this, value) },
    })
    patchValue(proto, "scrollTo", function() { scrollElementTo(this, argumentTop(arguments, scrollTopOf(this))) })
    patchValue(proto, "scrollBy", function() { scrollElementTo(this, scrollTopOf(this) + argumentDelta(arguments)) })
    patchValue(win, "getComputedStyle", logged(win.getComputedStyle))
    patchValue(globalThis, "getComputedStyle", logged(globalThis.getComputedStyle))
    patchValue(globalThis, "requestAnimationFrame", requestFrame)
    patchValue(globalThis, "cancelAnimationFrame", function(id) { frames.delete(id) })
    patchValue(win, "requestAnimationFrame", requestFrame)
    patchValue(win, "cancelAnimationFrame", function(id) { frames.delete(id) })
    patchValue(globalThis, "ResizeObserver", FakeResizeObserver)
    patchValue(win, "ResizeObserver", FakeResizeObserver)
    restores.push(function() { writes.disconnect() })

    function requestFrame(callback) {
        var id = nextFrame++
        frames.set(id, callback)
        return id
    }

    function FakeResizeObserver(callback) {
        this._callback = callback
        this._targets = new Set()
        observers.add(this)
    }

    // A browser reports an observed element's size once as it starts to observe it, unless the element has none.
    FakeResizeObserver.prototype.observe = function(target) {
        this._targets.add(target)
        if (rectOf(target).width > 0) { pendingResizes.push(target) }
    }
    FakeResizeObserver.prototype.unobserve = function(target) { this._targets.delete(target) }
    FakeResizeObserver.prototype.disconnect = function() {
        this._targets.clear()
        observers.delete(this)
    }

    function deliverResizes() {
        var targets = Array.from(new Set(pendingResizes))
        pendingResizes = []
        for (var target of targets) {
            var rect = rectOf(target)
            var inset = tables.has(target) ? tables.get(target).padding : 0
            var content = [{inlineSize: rect.width - inset, blockSize: rect.height}]
            var border = [{inlineSize: rect.width, blockSize: rect.height}]
            var entry = {target: target, contentRect: {top: 0, left: 0, width: rect.width - inset, height: rect.height}, contentBoxSize: content, borderBoxSize: border}
            for (var observer of Array.from(observers)) {
                if (observer._targets.has(target)) { observer._callback([entry], observer) }
            }
        }
    }

    var layout = {
        table: function(table, {top, width = 1000, padding = 0}) {
            tables.set(table, {top: top, width: width, padding: padding})
        },

        box: function(element, {top, height}) {
            boxes.set(element, {top: top, height: height, scrolls: false, scrollTop: 0})
        },

        scroller: function(element, {top, height}) {
            boxes.set(element, {top: top, height: height, scrolls: true, scrollTop: 0})
        },

        // Changes a table's width or a box's height, then queues the report a ResizeObserver would send.
        resize: function(element, {width, height}) {
            if (width !== undefined && tables.has(element)) { tables.get(element).width = width }
            if (height !== undefined && boxes.has(element)) { boxes.get(element).height = height }
            pendingResizes.push(element)
        },

        // Turns on native scroll anchoring for this element, which Chrome and Firefox have and Safari lacks; null turns it off.
        anchorTo: function(element) {
            anchored = element ? {element: element, top: clientRect(element).top} : null
        },

        flushScroll: function() {
            var targets = Array.from(pendingScrolls)
            pendingScrolls.clear()
            for (var target of targets) {
                if (target === win) { doc.dispatchEvent(new win.Event("scroll", {bubbles: true})) } else { target.dispatchEvent(new win.Event("scroll")) }
            }
            return targets.length
        },

        // One frame. Returns how many animation-frame callbacks ran; callbacks they queue wait for the next frame.
        flushFrames: function() {
            layout.flushScroll()
            var callbacks = Array.from(frames.values())
            frames.clear()
            for (var callback of callbacks) { callback(callbacks.length) }
            deliverResizes()
            return callbacks.length
        },

        // The width each column of a table has at layout: the widest max-content and min-content of the single-span cells that are
        // laid out, rendered rows and spacers alike. A pure read of the model, not logged.
        columnWidths: function(table) {
            var columns = {min: [], max: []}
            for (var row of rowsOf(table)) {
                if (isHidden(row)) { continue }
                if (isBoxRow(row)) {
                    var own = intrinsicOf(row)
                    var ownExtras = extrasOf(row)
                    columns.min[0] = Math.max(columns.min[0] || 0, own.min + ownExtras)
                    columns.max[0] = Math.max(columns.max[0] || 0, own.max + ownExtras)
                    continue
                }
                Array.from(row.children).forEach(function(cell, index) {
                    if (cell.colSpan > 1) { return }
                    var intrinsic = intrinsicOf(cell)
                    var extras = extrasOf(cell)
                    columns.min[index] = Math.max(columns.min[index] || 0, intrinsic.min + extras)
                    columns.max[index] = Math.max(columns.max[index] || 0, intrinsic.max + extras)
                })
            }
            return columns
        },

        readWriteLog: function() {
            noteWrites()
            return log.slice()
        },

        clearLog: function() {
            writes.takeRecords()
            log.length = 0
        },

        restore: function() {
            while (restores.length > 0) { restores.pop()() }
        },
    }
    return layout
}
