import { NSObject } from "./nsobject.js"
import { identifierConforms } from "../uniformtypeidentifiers/uttype.js"
import { registerFile, registerDirectory, registered } from "./fileregistry.js"
import { required, typed, StringType, FunctionType } from "../utils/required.js"


// Foundation's NSItemProvider, as a dropped item: what a drop session's
// UIDragItem carries. The framework makes them; the app asks one whether it
// conforms to a type and loads it as a file. Before the drop the browser shows
// only kinds and MIME types, so a provider made then answers conformance and
// loads nothing; the same provider gains its file, or folder, in the drop.
export class NSItemProvider extends NSObject {

    _identifier = null
    _name = null
    _file = null
    _entry = null
    _url = null
    _flavours = null

    // What the provider holds: the one type of a dropped item, or the flavours
    // of a paste, in the order the framework registered them.
    get registeredTypeIdentifiers() {
        if (this._flavours !== null) { return Object.keys(this._flavours) }
        return this._identifier === null ? [] : [this._identifier]
    }

    // The name without its extension, as Apple's: the file name stays with
    // FileManager.displayName. null while the drag has not shown it.
    get suggestedName() {
        if (this._name === null) { return null }
        var dot = this._name.lastIndexOf(".")
        return dot > 0 ? this._name.slice(0, dot) : this._name
    }

    /**
     * @param {string} typeIdentifier
     * @returns {boolean}
     */
    hasItemConformingToTypeIdentifier(typeIdentifier) {
        typed(typeIdentifier, "typeIdentifier", StringType, "NSItemProvider.hasItemConformingToTypeIdentifier", "Apple's is hasItemConformingToTypeIdentifier(_:); write provider.hasItemConformingToTypeIdentifier(UTType.pdf.identifier).")
        return this.registeredTypeIdentifiers.some((identifier) => identifierConforms(identifier, typeIdentifier))
    }

    // Only a paste has data to give, and a browser shows a paste's clipboard
    // for the length of the event alone, so the framework reads it there and
    // this handler runs before the call returns, where Apple's runs later. The
    // bytes are UTF-8 and a copy each time. A type the item does not hold, a
    // dropped file included, answers a null data and an Error.
    /**
     * @param {object} options
     * @param {string} options.forTypeIdentifier
     * @param {Function} options.completionHandler
     */
    loadDataRepresentation({forTypeIdentifier, completionHandler} = {}) {
        var signature = "Apple's is loadDataRepresentation(forTypeIdentifier:completionHandler:); write provider.loadDataRepresentation({forTypeIdentifier: UTType.html.identifier, completionHandler: (data, error) => {}})."
        required(forTypeIdentifier, "forTypeIdentifier", StringType, "NSItemProvider.loadDataRepresentation", signature)
        required(completionHandler, "completionHandler", FunctionType, "NSItemProvider.loadDataRepresentation", signature)
        var held = this._flavours === null ? undefined : this._flavours[forTypeIdentifier]
        if (held === undefined) {
            completionHandler(null, new Error(`The item holds no data for ${forTypeIdentifier}.`))
            return
        }
        completionHandler(held.slice(), null)
    }

    // The completion handler gets a registered file: URL (see FileManager) and
    // a null error, or a null URL and an Error when the item does not conform
    // or cannot be loaded yet. It runs after this call returns, as Apple's does.
    /**
     * @param {object} options
     * @param {string} options.forTypeIdentifier
     * @param {Function} options.completionHandler
     */
    loadFileRepresentation({forTypeIdentifier, completionHandler} = {}) {
        var signature = "Apple's is loadFileRepresentation(forTypeIdentifier:completionHandler:); write provider.loadFileRepresentation({forTypeIdentifier: UTType.pdf.identifier, completionHandler: (url, error) => {}})."
        required(forTypeIdentifier, "forTypeIdentifier", StringType, "NSItemProvider.loadFileRepresentation", signature)
        required(completionHandler, "completionHandler", FunctionType, "NSItemProvider.loadFileRepresentation", signature)
        var answer = this._answer(forTypeIdentifier)
        Promise.resolve().then(() => completionHandler(answer.url, answer.error))
    }

    // Registers at the first call, so an item that never loads leaves nothing
    // held, and answers the same URL after, one registry entry however often
    // it is asked; a URL the app removed is registered again.
    _answer(typeIdentifier) {
        if (!this.hasItemConformingToTypeIdentifier(typeIdentifier)) {
            return {url: null, error: new Error(`The item does not conform to ${typeIdentifier}.`)}
        }
        if (this._url && registered(this._url.href)) { return {url: this._url, error: null} }
        if (this._entry && this._entry.isDirectory) {
            this._url = registerDirectory({name: this._entry.name, entry: this._entry})
            return {url: this._url, error: null}
        }
        if (!this._file) {
            return {url: null, error: new Error("The item can be loaded only while the drop is performed.")}
        }
        this._url = registerFile(this._file)
        return {url: this._url, error: null}
    }
}


// How the framework makes a provider: what it knows of the item at that moment.
export function itemProviderFor({identifier, name = null, file = null, entry = null}) {
    var provider = new NSItemProvider()
    fillItemProvider(provider, {identifier: identifier, name: name, file: file, entry: entry})
    return provider
}


// The drop gives a provider the file it could not hold at enter, in place: the
// object the delegate captured then is the one that loads in performDrop.
export function fillItemProvider(provider, {identifier, name = null, file = null, entry = null}) {
    provider._identifier = identifier
    provider._name = name
    provider._file = file
    provider._entry = entry
    provider._url = null
}


// A paste's provider: one UTF-8 flavour per type identifier, the bytes already
// capped by the caller.
export function itemProviderForFlavours({flavours}) {
    var provider = new NSItemProvider()
    provider._flavours = Object.assign(Object.create(null), flavours)
    return provider
}
