# Database Migrations with migrate-mongo

This document explains how database migrations work in the Skillswap backend using the `migrate-mongo` tool.

## Why migrate-mongo?

We use `migrate-mongo` because it's:
- **Purpose-built for MongoDB** (not a generic SQL tool adapted for NoSQL)
- **Popular and well-maintained** (2.5M+ weekly downloads)
- **Simple conventions** - numbered migration files in `migrations/` directory
- **Configuration-driven** - connects to MongoDB via environment variables
- **Framework agnostic** - uses native MongoDB driver, so migrations work even if we change from Mongoose to another ODM

## Migration Philosophy

### 1. Every change is a migration
Never alter production databases manually. All schema and data changes must go through migration files.

### 2. Migrations are forward-only in production
Rollbacks use new forward migrations, not reversing existing ones. This prevents drift between environments.

### 3. Schema and data migrations are separate
Never mix DDL (Data Definition Language) and DML (Data Manipulation Language) in one migration.
- **Schema migrations**: Create/drop collections, add/remove validators/indexes
- **Data migrations**: Insert/update/delete documents

### 4. Migrations are immutable once deployed
Never edit a migration that has run in production. To fix mistakes, create a new migration.

### 5. Use native MongoDB driver in migrations
Migrations must be frozen in time. Using Mongoose models would cause migrations to break when models evolve. The native driver ensures migrations always work.

## File Structure

```
skillswapBE/
├── migrations/
│   ├── 001-baseline-schema.js    # Captures current schema as starting point
│   ├── 002-add-user-avatar-field.js  # Example future migration
│   └── .gitkeep                  # Keeps folder tracked in git
├ migrate-mongo-config.js         # Configuration (reads MONGO_URI from .env)
└ package.json                    # Contains migration scripts
```

## Available Commands

All migration commands are available as npm scripts:

```bash
# Create a new migration file
npm run migrate:create <migration-name>
# Example: npm run migrate:create add-user-avatar
# Creates: migrations/002-add-user-avatar.js

# Apply pending migrations
npm run migrate:up

# Rollback the last applied migration
npm run migrate:down

# Show migration status (pending vs applied)
npm run migrate:status
```

## Writing Migrations

Each migration file exports an object with `up` and `down` functions:

```javascript
module.exports = {
  async up(db) {
    // Apply forward changes
    // Use db.collection('name') to access collections
    // Use native MongoDB driver methods
  },

  async down(db) {
    // Rollback changes made in up()
    // Should exactly reverse what up() did
  }
};
```

### Available in migration functions:
- `db`: MongoDB database instance (native driver)
- `db.collection('collectionName')`: Get a collection reference
- Standard MongoDB driver methods: `createIndex`, `insertOne`, `updateMany`, etc.

## Baseline Migration (001-baseline-schema.js)

The first migration captures the current schema state as our starting point. It:
- Creates all collections with JSON schema validators matching current Mongoose schemas
- Creates all indexes
- Creates the changelog collections used by migrate-mongo
- **Does not modify any data** - schema only

This approach means:
- Future migrations are **incremental** from current state
- We don't need to replay historical changes to get to current schema
- New developers can understand current state by looking at this migration

## Creating Schema Migrations

When adding/modifying fields or indexes:

1. **Create migration**: `npm run migrate:create add-field-to-user`
2. **In up()**: Add validator properties or create indexes
3. **In down()**: Remove validator properties or drop indexes
4. **Test locally** before deploying

Example - adding a field:
```javascript
async up(db) {
  // Modify user validator to add new field
  await db.runCommand({
    collMod: "users",
    validator: {
      $jsonSchema: {
        // ... existing validator ...
        properties: {
          // ... existing properties ...
          newField: { bsonType: "string" }
        }
      }
    }
  });
}

async down(db) {
  // Remove the field from validator
  await db.runCommand({
    collMod: "users",
    validator: {
      $jsonSchema: {
        // ... existing validator without newField ...
        properties: {
          // ... existing properties only ...
        }
      }
    }
  });
}
```

## Creating Data Migrations

For inserting, updating, or deleting documents:

1. **Create migration**: `npm run migrate:create backfill-user-ranks`
2. **In up()**: Use `updateMany`, `insertMany`, `deleteMany` as needed
3. **In down()**: Reverse the data changes exactly
4. **Include safety checks** - verify preconditions before making changes
5. **Consider batching** for large data sets to avoid locking

Example - setting default values:
```javascript
async up(db) {
  // Set default rank for users that don't have it
  const result = await db.collection('users').updateMany(
    { rank: { $exists: false } },
    { $set: { rank: "New Member" } }
  );
  console.log(`Updated ${result.modifiedCount} users with default rank`);
}

async down(db) {
  // Remove the rank we set (only if it matches our default)
  const result = await db.collection('users').updateMany(
    { rank: "New Member" },
    { $unset: { rank: "" } }
  );
  console.log(`Removed default rank from ${result.modifiedCount} users`);
}
```

## Testing Migrations

### Local Development
1. Ensure MongoDB is running (`mongod` or use MongoDB Atlas)
2. Copy `.env.example` to `.env` and fill in values
3. Run: `npm run migrate:up` to apply migrations
4. Verify changes in MongoDB Compass or mongosh
5. To test rollback: `npm run migrate:down` then `npm run migrate:up` again

### Production Considerations
- **Test against production-sized data** - a migration that works on 100 rows may lock on 10M
- **Schedule during low-traffic periods** for collections that will be locked
- **Monitor performance** - use `db.currentOp()` to check for long-running operations
- **Have a rollback plan** - test the down() migration thoroughly
- **Never mix schema and data changes** in the same migration

## Best Practices

### Naming Conventions
- Use descriptive, kebab-case names: `add-user-avatar`, `index-email-field`
- Prefix with numbers for ordering: `001`, `002`, etc. (handled automatically by migrate-mongo)
- Be specific: `add-index-to-user-email` vs `user-changes`

### Indexes
- Create indexes concurrently in production to avoid locks:
  ```javascript
  // In up():
  await db.collection('users').createIndex({ email: 1 });
  // Note: migrate-mongo doesn't have CONCURRENTLY option,
  // so for production you may need to use raw commands
  ```

### Validators
- Match your Mongoose schema validation exactly
- Include all required fields, enum values, min/max constraints
- Test validators with invalid data to ensure they work

### Documentation
- Each migration should have a clear comment explaining what it does
- For complex migrations, consider creating a design document first
- Link to related tickets/issues in migration comments

## Troubleshooting

### Migration Fails to Apply
1. Check MongoDB connection: verify MONGO_URI in .env
2. Ensure MongoDB server is running and accessible
3. Look at error message - usually indicates syntax or connection issue
4. Fix the migration file and retry

### Need to Modify Applied Migration
**Never modify an applied migration file.** Instead:
1. Create a new migration that reverses the unwanted change
2. Create another migration that implements the correct change
3. This maintains clean audit trail and reproducibility

### Stuck Lock
If you see "lock timeout exceeded":
1. Ensure no other migrate-mongo process is running
2. Manually delete the lock document: `db.changelog_lock.deleteMany({})`
3. Retry the migration

## Environment Variables

Migration configuration reads from:
- `MONGO_URI`: MongoDB connection string (required)
- Falls back to `mongodb://localhost:27017/skillswap` if not set

Example `.env`:
```
MONGO_URI=mongodb://localhost:27017/skillswap
```

## Integration with Mongoose

Although migrations use the native MongoDB driver, they should match your Mongoose schemas:
- Validators in migrations should match Mongoose schema validation
- Indexes in migrations should match Mongoose schema indexes
- When you update Mongoose schemas, create a corresponding migration
- This ensures database and application layers stay in sync

## Future Work

Consider adding:
- Pre-migration hooks for backups
- Migration validation against staging data
- Automated testing of migrations in CI
- Data migration helpers for common patterns (batch updates, etc.)

---

**Remember**: Migrations are your database's version control system. Treat them with the same care as your application code.