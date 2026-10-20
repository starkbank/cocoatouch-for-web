// The application and the key window belong to the document, not to a copy of
// this package: a page that loads two bundles has one document, and Symbol.for
// gives both bundles the same key, so the second finds what the first made.
export const applicationKey = Symbol.for("cocoatouch.UIApplication")
export const keyWindowKey = Symbol.for("cocoatouch.keyWindow")
