import "./uicomponents/index.js"
import "./uipages/index.js"
import { HomeViewController } from "./uipages/home/homeViewController.js"
import { ButtonsViewController } from "./uipages/buttons/buttonsViewController.js"
import { LabelsViewController } from "./uipages/labels/labelsViewController.js"
import { TextFieldsViewController } from "./uipages/textFields/textFieldsViewController.js"
import { CustomViewsViewController } from "./uipages/customViews/customViewsViewController.js"
import { TableViewViewController } from "./uipages/tableView/tableViewViewController.js"


const routes = {
    "/": HomeViewController,
    "/buttons": ButtonsViewController,
    "/labels": LabelsViewController,
    "/text-fields": TextFieldsViewController,
    "/custom-views": CustomViewsViewController,
    "/table-view": TableViewViewController,
}

// The page hosts one root controller at a time. Presenting the next one
// dismisses the current one first, releasing everything it observed.
export function present() {
    var Controller = routes[window.location.pathname] || HomeViewController
    var controller = new Controller()
    controller.present(controller)
}

window.addEventListener("popstate", present)
