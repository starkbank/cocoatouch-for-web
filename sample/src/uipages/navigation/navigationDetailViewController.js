import "UIKit"
import "Foundation"


export class NavigationDetailViewController extends UIViewController {

    @IBOutlet("#navigation-detail-depth", UILabel) depthLabel

    constructor() {
        super()
        this.navigationItem.title = "Detail"
        var activity = new NSUserActivity({activityType: NSUserActivityTypeBrowsingWeb})
        activity.webpageURL = "/navigation/detail"
        this.userActivity = activity
    }

    viewDidAppear(animated) {
        this.depthLabel.text = `Stack depth ${this.navigationController.viewControllers.length} · appeared animated: ${animated}`
    }

    @IBAction("#navigation-pop", UIButton) popTapped() {
        this.navigationController.popViewController({animated: true})
    }
}
