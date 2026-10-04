import "UIKit"
import "Foundation"
import { MenuView } from "../../uicomponents/menu/menuView.js"
import { NavigationDetailViewController } from "./navigationDetailViewController.js"


export class NavigationListViewController extends UIViewController {

    @IBOutlet("#menu", MenuView) menuView
    @IBOutlet("#navigation-log", UILabel) logLabel

    shows = 0

    viewDidLoad() {
        this.navigationItem.title = "Navigation"
    }

    @IBAction("#navigation-push", UIButton) pushTapped() {
        this.navigationController.pushViewController(new NavigationDetailViewController(), {animated: true})
    }

    // UINavigationControllerDelegate

    navigationControllerDidShowViewControllerAnimated(navigationController, viewController, animated) {
        this.shows += 1
        this.logLabel.text = `didShow #${this.shows}: ${viewController.navigationItem.title} · stack depth ${navigationController.viewControllers.length} · animated ${animated}`
    }
}
