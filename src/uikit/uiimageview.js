import { UIView } from "./uiview.js"


export class UIImageView extends UIView {

    set image(image) {
        $(this.selector).attr("src", image.named)
    }

    set backgroundImage(image) {
        $(this.selector).css("background-image", `url(${image.named})`);
    }
}
