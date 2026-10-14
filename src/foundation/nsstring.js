// Foundation's NSString.CompareOptions (an OptionSet). A frozen namespace, not
// a class: `class NSString` would invite `new NSString()` and claim a string
// implementation that is not here.
//
// Four cases, not Apple's nine. .anchored, .numeric, .widthInsensitive,
// .forcedOrdering and .regularExpression are honoured nowhere in this package,
// and a case that silently does nothing is the lie these rules exist to
// prevent; each lands with the member that honours it.
const CompareOptions = Object.freeze({
    caseInsensitive: "caseInsensitive",
    literal: "literal",
    backwards: "backwards",
    diacriticInsensitive: "diacriticInsensitive",
})


export const NSString = Object.freeze({CompareOptions})
