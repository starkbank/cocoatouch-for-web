import { NSObject } from "../foundation/nsobject.js"
import { CMTime } from "../coremedia/cmtime.js"
import { AVURLAsset } from "./avasset.js"


const Status = Object.freeze({
    unknown: "unknown",
    readyToPlay: "readyToPlay",
    failed: "failed",
})


// What a player plays: an asset plus the playback state the player reports
// on it. The player owning the item keeps status, duration and error current.
export class AVPlayerItem extends NSObject {

    static get Status() {
        return Status
    }

    static get didPlayToEndTimeNotification() {
        return "AVPlayerItemDidPlayToEndTime"
    }

    static get failedToPlayToEndTimeNotification() {
        return "AVPlayerItemFailedToPlayToEndTime"
    }

    // AVPlayerItem(url:) or AVPlayerItem(asset:)
    constructor({url, asset}) {
        super()
        this.asset = asset || new AVURLAsset({url})
        this.status = Status.unknown
        this.duration = CMTime.indefinite
        this.error = null
    }
}
