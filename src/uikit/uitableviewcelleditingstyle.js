// UITableViewCell.EditingStyle: the style the commit hook is handed. The
// values are the strings a consumer compared against before, so comparing to
// "delete" keeps working; the constant is the contract.
export const UITableViewCellEditingStyle = Object.freeze({
    none: "none",
    delete: "delete",
    insert: "insert",
})
