# Fixing WBS Date Fields Issue

## Issue Description

There's a mismatch between the TypeScript schema and the database schema for the WBS Items table:

- In the TypeScript schema, `startDate`, `endDate`, and `duration` fields are defined as optional
- In the database, `start_date`, `end_date`, and `duration` columns have `NOT NULL` constraints

This causes errors when creating Summary or WorkPackage type WBS items because the frontend code tries to set these date fields to `undefined` for these types, but the database rejects null values.

## Immediate Fix (Already Applied)

We've updated the frontend code to work around this issue by setting default date values for all WBS item types, even when they aren't displayed in the UI.

The fix is in `client/src/components/project/add-wbs-modal.tsx`, where we modified the useEffect hook to set default dates for Summary and WorkPackage types.

## Long-Term Solution

To properly fix this issue, the database schema needs to be updated to match the TypeScript definitions. We've created:

1. A Node.js script: `migrate-wbs-dates.cjs` that will update the Supabase/PostgreSQL schema
2. A new npm script: `db:migrate` to run this migration

### How to Apply the Database Fix

Run the following command to apply the database schema changes:

```bash
npm run db:migrate
```

This script will:
- Connect to your Supabase PostgreSQL database using the DATABASE_URL environment variable
- Alter the wbs_items table to make the date fields nullable
- Add appropriate comments to the columns

### Troubleshooting

If you encounter any issues:

1. Make sure your DATABASE_URL environment variable is set correctly
2. Check that you have the necessary permissions to alter the table schema
3. If needed, you can run the SQL statements directly in the Supabase SQL editor:

```sql
-- Alter the wbs_items table to make date fields nullable
ALTER TABLE wbs_items ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE wbs_items ALTER COLUMN end_date DROP NOT NULL;
ALTER TABLE wbs_items ALTER COLUMN duration DROP NOT NULL;

-- Comment explaining the change
COMMENT ON COLUMN wbs_items.start_date IS 'Start date (nullable, only required for Activity type)';
COMMENT ON COLUMN wbs_items.end_date IS 'End date (nullable, only required for Activity type)';
COMMENT ON COLUMN wbs_items.duration IS 'Duration in days (nullable, only required for Activity type)';
```

### After the Migration

Once the migration has been applied, you can revert the frontend workaround if desired by modifying the code in `client/src/components/project/add-wbs-modal.tsx` to set undefined values for date fields on Summary and WorkPackage items:

```typescript
// Update form fields based on WBS type
useEffect(() => {
  if (type === "Summary" || type === "WorkPackage") {
    // For Summary and WorkPackage: no dates
    form.setValue("startDate", undefined);
    form.setValue("endDate", undefined);
    form.setValue("duration", undefined);
  } else if (type === "Activity") {
    // For Activity: has dates but no budget
    form.setValue("budgetedCost", 0);
    
    // Set default dates if they're undefined
    if (!form.getValues("startDate")) {
      form.setValue("startDate", new Date());
    }
    if (!form.getValues("endDate")) {
      const newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + 7);
      form.setValue("endDate", newEndDate);
    }
    if (!form.getValues("duration")) {
      form.setValue("duration", 7);
    }
  }
}, [type, form]);
```

## Verification

After applying the fix, test creating all types of WBS items:
1. Summary (top-level and as child of another Summary)
2. WorkPackage (as child of a Summary)
3. Activity (as child of a WorkPackage)

All of these should now create successfully without database constraint errors. 