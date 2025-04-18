# Manual Test Plan for WBS Hierarchy Implementation

## Test Case 1: Add Top-Level WBS Item
1. Navigate to the WBS structure page
2. Click "Add WBS Item" button
3. Verify that Parent WBS is set to "No Parent (Top Level)"
4. Verify that WBS Type dropdown shows only "Summary" option and is disabled
5. Fill in the Name and Description fields
6. Verify that date fields are not shown (only Summary items are allowed at top level)
7. Submit the form
8. Verify the new item appears in the WBS tree with type "Summary"

## Test Case 2: Add Child to a Summary WBS Item
1. Locate a Summary item in the WBS tree
2. Click the "+" button to add a child
3. Verify that Parent WBS is set to the summary item
4. Verify that WBS Type dropdown allows selection of "Summary" and "WorkPackage"
5. Select "WorkPackage" as the type
6. Fill in the Name, Description, and Budget fields
7. Verify that date fields are not shown (WorkPackage items don't have dates)
8. Submit the form
9. Verify the new item appears as a child of the Summary item with type "WorkPackage"

## Test Case 3: Add Child to a WorkPackage WBS Item
1. Locate a WorkPackage item in the WBS tree
2. Click the "+" button to add a child
3. Verify that Parent WBS is set to the WorkPackage item
4. Verify that WBS Type dropdown shows only "Activity" option and is disabled
5. Fill in the Name and Description fields
6. Verify that Budget field is disabled (Activity items don't have budget)
7. Verify that date fields are shown (Activity items have dates)
8. Fill in Start Date, Duration/End Date
9. Submit the form
10. Verify the new item appears as a child of the WorkPackage item with type "Activity"

## Test Case 4: Changing Parent WBS Updates Type Options
1. Click "Add WBS Item" button
2. Initially, verify WBS Type shows only "Summary" option
3. Change Parent WBS to a Summary item
4. Verify that WBS Type options update to show "Summary" and "WorkPackage"
5. Change Parent WBS to a WorkPackage item
6. Verify that WBS Type options update to show only "Activity"
7. Change Parent WBS back to "No Parent (Top Level)"
8. Verify that WBS Type options update to show only "Summary" again

## Test Case 5: Activity Item Can't Have Children
1. Locate an Activity item in the WBS tree
2. Verify that it doesn't have a "+" button to add children
3. Alternatively, verify it has a disabled "+" button

## Expected Results
- The WBS hierarchy should enforce the rule that:
  - Top-level items can only be "Summary" type
  - Under Summary items, you can add either "Summary" or "WorkPackage" items
  - Under WorkPackage items, you can only add "Activity" items
  - Activity items cannot have children
- The form should dynamically update to show/hide fields based on the selected type:
  - Summary and WorkPackage items can have budget but no dates
  - Activity items can have dates but no budget 