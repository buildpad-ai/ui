# @buildpad/services

Service classes for Buildpad projects. DaaS-compatible services for fields, collections, permissions, and DaaS API configuration.

## Installation

```bash
pnpm add @buildpad/services
```

## Peer Dependencies

- `@buildpad/types` workspace:*

## Usage

```typescript
import { 
  FieldsService, 
  CollectionsService, 
  PermissionsService 
} from '@buildpad/services';
```

## FieldsService

Read field definitions for collections.

```typescript
import { FieldsService } from '@buildpad/services';

const fieldsService = new FieldsService();

// Get all fields for a collection
const fields = await fieldsService.readAll('products');

// Get a specific field
const field = await fieldsService.readOne('products', 'title');

// Get fields with specific interface
const inputFields = fields.filter(f => f.meta?.interface === 'input');
```

## CollectionsService

Read collection metadata.

```typescript
import { CollectionsService } from '@buildpad/services';

const collectionsService = new CollectionsService();

// Get all collections
const collections = await collectionsService.readAll();

// Get a specific collection
const products = await collectionsService.readOne('products');

// Check if collection exists
const exists = await collectionsService.exists('products');
```

## PermissionsService

Get field-level permissions for the current user.

```typescript
import { PermissionsService, type FieldPermissions } from '@buildpad/services';

const permissionsService = new PermissionsService();

// Get permissions for a collection and action
const permissions: FieldPermissions = await permissionsService.getFieldPermissions(
  'products', 
  'update'
);

// Check if user can edit a field
if (permissions.title) {
  // User can edit title field
}

// Get all readable fields
const readableFields = await permissionsService.getFieldPermissions('products', 'read');
```

## API Request

Low-level API request function used by all services. Supports both proxy mode (Next.js) and direct DaaS mode (Storybook/testing).

```typescript
import { apiRequest } from '@buildpad/services';

// GET request
const data = await apiRequest<Product[]>('/api/items/products');

// POST request
const created = await apiRequest<Product>('/api/items/products', {
  method: 'POST',
  body: JSON.stringify({ title: 'New Product' }),
});

// With query parameters
const filtered = await apiRequest<{ data: Product[] }>('/api/items/products?limit=10');
```

## DaaS Context Provider

For environments without Next.js API routes (like Storybook), use `DaaSProvider` to enable direct DaaS API access.

```typescript
import { DaaSProvider, setGlobalDaaSConfig } from '@buildpad/services';

// React context approach (recommended)
<DaaSProvider config={{ url: 'https://xxx.buildpad-daas.xtremax.com', token: 'your-token' }}>
  <VForm collection="articles" />
</DaaSProvider>

// Global config for non-React contexts
setGlobalDaaSConfig({ 
  url: 'https://xxx.buildpad-daas.xtremax.com', 
  token: 'your-token' 
});
```

### DaaS Configuration Exports

| Export | Description |
|--------|-------------|
| `DaaSProvider` | React provider for direct DaaS API access |
| `useDaaSContext` | Hook to access DaaS configuration |
| `useIsDirectDaaSMode` | Hook to check if direct mode is enabled |
| `setGlobalDaaSConfig` | Set global config for non-React contexts |
| `getGlobalDaaSConfig` | Get current global config |
| `buildApiUrl` | Build URL respecting DaaS config |
| `getApiHeaders` | Get headers with auth token |

### Proxy Mode vs Direct Mode

| Mode | Use Case | How it works |
|------|----------|--------------|
| **Proxy Mode** | Next.js apps | Requests go to `/api/*` routes, server proxies to DaaS |
| **Direct Mode** | Storybook, tests | Requests go directly to DaaS URL with Bearer token |

The `apiRequest` function automatically handles both modes based on the DaaS configuration.

## API Reference

### FieldsService

| Method | Description |
|--------|-------------|
| `readAll(collection)` | Get all fields for a collection |
| `readOne(collection, field)` | Get a specific field |

### CollectionsService

| Method | Description |
|--------|-------------|
| `readAll()` | Get all collections |
| `readOne(collection)` | Get a specific collection |
| `exists(collection)` | Check if collection exists |

### PermissionsService

| Method | Description |
|--------|-------------|
| `getFieldPermissions(collection, action)` | Get field permissions for action |

## Related Packages

- [@buildpad/types](../types) - TypeScript types used by services
- [@buildpad/hooks](../hooks) - React hooks that use these services

## Auth Module (Server-Side)

Server-side authentication and authorization utilities for Next.js API routes.

### Setup

Configure the auth module in your app initialization:

```typescript
// lib/supabase/auth-config.ts
import { configureAuth } from '@buildpad/services/auth';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';

export function initializeAuth() {
  configureAuth({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    getHeaders: () => headers(),
    getCookies: () => cookies(),
    createServerClient,
    createClient,
  });
}
```

### Authentication

Supports three authentication methods:
- Cookie-based sessions (browser)
- JWT Bearer tokens (API clients)
- Static tokens (programmatic access)

```typescript
import { 
  createAuthenticatedClient,
  getCurrentUser,
  isAdmin,
  getUserRole,
  AuthenticationError 
} from '@buildpad/services/auth';

// Get authenticated Supabase client and user
const { supabase, user } = await createAuthenticatedClient();

// Get current user
const user = await getCurrentUser();

// Check admin access
const isAdminUser = await isAdmin();

// Get user's role
const roleId = await getUserRole();
```

### Permission Enforcement

```typescript
import { 
  enforcePermission,
  getAccessibleFields,
  validateFieldsAccess,
  filterResponseFields,
  getPermissionFilters,
  applyFilterToQuery,
  PermissionError 
} from '@buildpad/services/auth';

// Enforce permission (throws if denied)
const { user, isAdmin } = await enforcePermission({
  collection: 'articles',
  action: 'read',
});

// Get allowed fields for user
const fields = await getAccessibleFields('articles', 'read');
// Returns: ['id', 'title', 'content'] or ['*'] for all

// Validate write fields before update
const { allowed, forbiddenFields } = await validateFieldsAccess(
  ['title', 'admin_field'],
  'articles',
  'update'
);

// Filter response data by permissions
const filtered = await filterResponseFields(data, 'articles', 'read');

// Get item-level permission filters
const filter = await getPermissionFilters('articles', 'read');
if (filter) {
  query = applyFilterToQuery(query, filter);
}
```

Permission filters **fail closed**. `getPermissionFilters` resolves `$CURRENT_USER`,
`$CURRENT_ROLE`, `$CURRENT_ROLES`, `$CURRENT_POLICIES` and `$NOW`; if a filter
uses anything it cannot enforce (an unknown operator, a relational path such as
`{ owner: { id: { _eq: … } } }`, an unresolvable variable such as
`$CURRENT_USER.email`, a non-array `_in`, …) it returns a deny-all filter.
`applyFilterToQuery` throws `UnsupportedPermissionFilterError` — a
`PermissionError` with `statusCode` 403 — for such filters before touching the
query, so never run the query when it throws.

### API Route Example

```typescript
// app/api/items/[collection]/route.ts
import { initializeAuth } from '@/lib/supabase/auth-config';
import {
  createAuthenticatedClient,
  enforcePermission,
  filterResponseFields,
  getPermissionFilters,
  applyFilterToQuery,
  AuthenticationError,
  PermissionError,
} from '@buildpad/services/auth';

initializeAuth();

export async function GET(request, { params }) {
  try {
    const { collection } = await params;
    
    // 1. Enforce permission
    const { isAdmin } = await enforcePermission({ collection, action: 'read' });
    
    // 2. Build query
    const { supabase } = await createAuthenticatedClient();
    let query = supabase.from(collection).select('*');
    
    // 3. Apply permission filters
    if (!isAdmin) {
      const filter = await getPermissionFilters(collection, 'read');
      if (filter) query = applyFilterToQuery(query, filter);
    }
    
    const { data } = await query;
    
    // 4. Filter response fields
    const result = isAdmin ? data : await filterResponseFields(data, collection, 'read');
    
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
```

### Auth API Reference

| Export | Description |
|--------|-------------|
| `configureAuth(config)` | Initialize auth module with Supabase config |
| `createAuthenticatedClient()` | Get authenticated Supabase client + user |
| `getCurrentUser()` | Get current authenticated user |
| `isAdmin()` | Check if user has admin access |
| `getUserRole()` | Get user's role ID |
| `getUserProfile()` | Get full user profile |
| `getAccountability()` | Get accountability info for audit logging |
| `enforcePermission(check)` | Enforce permission or throw error |
| `getAccessibleFields(collection, action)` | Get allowed fields for action |
| `validateFieldsAccess(fields, collection, action)` | Validate write field access |
| `filterFields(data, allowedFields)` | Filter object fields |
| `filterFieldsArray(data[], allowedFields)` | Filter array of objects |
| `filterResponseFields(data, collection, action)` | Auto-filter by permissions |
| `getPermissionFilters(collection, action)` | Get item-level filters |
| `applyFilterToQuery(query, filter)` | Apply filter to Supabase query (throws `UnsupportedPermissionFilterError` if it cannot be enforced) |
| `resolveFilterDynamicValues(filter, userId, roleId, { roles, policies, now })` | Resolve $CURRENT_USER, $CURRENT_ROLE(S), $CURRENT_POLICIES, $NOW (throws if unresolvable) |
| `UnsupportedPermissionFilterError` | 403 `PermissionError` for filters that cannot be enforced |
| `AuthenticationError` | Error class for auth failures |
| `PermissionError` | Error class for permission failures |

