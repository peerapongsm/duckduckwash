// Display labels for service keys and expense categories, shared between the
// report logic, the xlsx export, and (indirectly, via resolved labels) the UI.
export const SERVICE_LABELS: Record<string, string> = {
  wash_dry_fold: 'Wash / Dry / Fold',
  wash_dry_fold_iron: 'Wash / Dry / Fold / Iron',
  iron: 'Iron',
  dry_clean: 'Dry clean'
}

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  supplies: 'Supplies',
  utilities: 'Utilities',
  rent: 'Rent',
  food: 'Food',
  salary: 'Salary',
  other: 'Other'
}
