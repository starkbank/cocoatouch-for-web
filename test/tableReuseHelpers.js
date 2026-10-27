// Shared by the tableViewReuse*.test.js files: a table of identical-height rows laid out by test/fakeLayout.js.
import { page } from "./dom.js"
import { installLayout } from "./fakeLayout.js"
import { IBOutlet, UILabel, UIView, UITableView, UITableViewCell, IndexPath } from "../src/index.js"


export var counters = {constructed: 0, prepared: 0, disposed: []}

export class Row extends UITableViewCell {

    init() {
        counters.constructed++
    }

    prepareForReuse() {
        counters.prepared++
    }

    _dispose() {
        counters.disposed.push({id: this._$el && this._$el[0] ? this._$el[0].id : null, connected: !!(this._$el && this._$el[0] && this._$el[0].isConnected)})
        super._dispose()
    }
}
Row.nib = "<tr data-height=\"95\"><td id=\"table-cell-selected\"><input type=\"checkbox\"></td><td id=\"title\"></td><td><div id=\"options\"></div><button id=\"delete-button\"></button></td></tr>"
IBOutlet("#title", UILabel)(Row.prototype, "titleLabel", {})
IBOutlet("#options", UIView)(Row.prototype, "optionsView", {})

export class Other extends UITableViewCell {}
Other.nib = "<tr data-height=\"50\"><td id=\"title\"></td></tr>"
IBOutlet("#title", UILabel)(Other.prototype, "titleLabel", {})

export function at(...rows) {
    return rows.map((row) => new IndexPath({row}))
}

// Builds the page, the layout, the table and its data source, in the order a site does: the table is placed before the data source is
// set, because setting it loads the rows, and the frame that setting the delegate scheduled is run, so a test starts settled. `model.count` and `model.identifier(row)` are what the data source answers; `model.asked` are the rows it was asked to display and `model.measured` the rows it was asked for only to measure them; `model.widthsOf(row)` is the [min, max] of each cell, as the fake layout reads them.
export function setup({count = 1000, innerHeight = 900, top = 100, padding = 0, container = false, box = null, hidden = false, delegate = null, estimatedRowHeight, identifier = () => "row", heightOf = null, widthsOf = null} = {}) {
    counters.constructed = 0
    counters.prepared = 0
    counters.disposed.length = 0
    var open = container ? "<div id=\"container\" style=\"overflow-x: scroll; overflow-y: auto; transform: rotateX(180deg)\">" : ""
    var close = container ? "</div>" : ""
    var boxOpen = box ? "<div id=\"box\" style=\"overflow-y: auto\">" : ""
    var boxClose = box ? "</div>" : ""
    page("<style>td, th { padding: 0 }</style>" + boxOpen + open + "<table id=\"table\"><thead><tr data-height=\"30\"><th>h</th></tr></thead><tbody></tbody></table>" + close + boxClose)
    var layout = installLayout({innerHeight})
    layout.table(document.getElementById("table"), {top, padding})
    if (box) { layout.scroller(document.getElementById("box"), box) }
    var table = new UITableView("#table")
    if (hidden) { table.isHidden = true }
    var model = {count, identifier, asked: [], measured: [], onAsk: null, widthsOf}
    var events = []
    table.register(Row, {forCellReuseIdentifier: "row"})
    table.register(Other, {forCellReuseIdentifier: "other"})
    if (estimatedRowHeight !== undefined) { table.estimatedRowHeight = estimatedRowHeight }
    table.delegate = Object.assign({
        tableViewWillDisplayCellForRowAtIndexPath(tableView, cell, indexPath) {
            events.push(["will", indexPath.row, cell.titleLabel ? cell.titleLabel.$el.text() : null])
        },
        tableViewDidEndDisplayingCellForRowAtIndexPath(tableView, cell, indexPath) {
            events.push(["end", indexPath.row])
        },
    }, delegate)
    table.dataSource = {
        tableViewNumberOfRowsInSection: () => model.count,
        tableViewCellForRowAtIndexPath(tableView, indexPath) {
            var cell = tableView.dequeueReusableCell({withIdentifier: model.identifier(indexPath.row), for: indexPath})
            // A cell that waits in the queue under a reusable-<n> id is being measured; one under cell-<row> is being displayed.
            ;(/^reusable-/.test(cell.$el[0].id) ? model.measured : model.asked).push(indexPath.row)
            if (model.widthsOf) {
                model.widthsOf(indexPath.row).forEach(function(entry, index) {
                    cell.$el[0].children[index].setAttribute("data-min", String(entry[0]))
                    cell.$el[0].children[index].setAttribute("data-max", String(entry[1]))
                })
            }
            cell.titleLabel.text = "Row " + indexPath.row
            if (heightOf) { cell.$el[0].setAttribute("data-height", String(heightOf(indexPath.row))) }
            if (model.onAsk) { model.onAsk(indexPath.row, cell) }
            return cell
        },
    }
    // The rows that are not rendered are measured one chunk a frame, so a test starts once every frame has run.
    for (var quiet = 0, frames = 0; quiet < 2 && frames < 300; frames++) { quiet = layout.flushFrames() > 0 ? 0 : quiet + 1 }
    return {table, layout, model, events}
}

export function rowsBody() {
    var table = document.getElementById("table")
    return table.tBodies[table.tBodies.length - 1]
}

export function renderedIds() {
    return Array.from(rowsBody().children).filter((element) => /^cell-/.test(element.id)).map((element) => element.id)
}

export function renderedRows() {
    return renderedIds().map((id) => Number(id.slice(5)))
}

export function spacers() {
    return Array.from(rowsBody().children).filter((element) => element.id === "")
}

export function scrollTo(layout, y) {
    window.scrollTo(0, y)
    layout.flushFrames()
}

export function rows(table) {
    return table.indexPathsForVisibleRows.map((indexPath) => indexPath.row)
}

export function click(element) {
    element.dispatchEvent(new window.MouseEvent("click", {bubbles: true, cancelable: true}))
}
