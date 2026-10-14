// PDFKit's notification names, published on NSNotification.Name as Apple's
// `extension NSNotification.Name` does. Raw values are the strings Apple's
// constants carry. Only the names PDFKit actually posts are published:
// Apple's PDFViewDisplayBoxChanged, PDFViewVisiblePagesChanged,
// PDFViewAnnotationHit and PDFViewCopyPermission would be observers that wait
// forever, because nothing here can ever post them.
import { defineNotificationNames } from "../foundation/nsnotification.js"


defineNotificationNames({
    PDFViewDocumentChanged: "PDFViewDocumentChanged",
    PDFViewPageChanged: "PDFViewPageChanged",
    PDFViewScaleChanged: "PDFViewScaleChanged",
    PDFViewSelectionChanged: "PDFViewSelectionChanged",
    PDFViewDisplayModeChanged: "PDFViewDisplayModeChanged",
    PDFDocumentDidBeginFind: "PDFDocumentDidBeginFind",
    PDFDocumentDidFindMatch: "PDFDocumentDidFindMatch",
    PDFDocumentDidEndFind: "PDFDocumentDidEndFind",
})


// The userInfo key DidFindMatch carries its PDFSelection under, Apple's
// PDFDocumentFoundSelectionKey. The other PDFKit notifications carry no
// userInfo at all, so this is the only key PDFKit publishes.
export const PDFDocumentFoundSelectionKey = "PDFDocumentFoundSelection"
