---
"@buildpad/cli": minor
---

Customer hosts come from a branch variable, in Development and Production. In the tenancy mode `customer-tenants`, the `lib/customer-hosts.ts` that `external-oauth-engine-customers` writes no longer holds a hand-filled map. It reads the server variable `BUILDPAD_CUSTOMER_HOSTS`, JSON `{ "<slug>": "<tenant id>" }`:

- The map comes from the Platform's Customers page: **Update and redeploy** writes it on each Amplify branch of the app and redeploys. There is one value per branch: Development's customers on `main`, Production's on `production`. The same code serves both Environments, and a new customer is served once the member presses Update and redeploy.
- It is parsed once, on the server. A key that is not one DNS label, or a value that is not a non-empty string, is dropped. A missing, empty or unparsable value is the empty map (every customer host answers 404), logged once without the value.
- The variable is server-only. It has no `NEXT_PUBLIC_` name, and nothing sends it to the browser.
- The file also exports `tenantIdForSlug(slug): string | null`. `CUSTOMER_HOSTS` and `CUSTOMER_HOST_SUFFIX` keep their names and types, so `lib/oauth/tenant.ts` is unchanged. Set `CUSTOMER_HOST_SUFFIX` to the customer domain as before.
- `amplify.yml`: on install, `add` writes `BUILDPAD_CUSTOMER_HOSTS` into `.env.production`, the only way a server variable reaches a Next.js app on Amplify Hosting at run time. The new line goes beside the `BUILDPAD_ONBOARDING_KEY` line, else after the last step that writes `.env.production`:

  ```yaml
  - '[ -z "$BUILDPAD_CUSTOMER_HOSTS" ] || echo "BUILDPAD_CUSTOMER_HOSTS=$BUILDPAD_CUSTOMER_HOSTS" >> .env.production'
  ```

  With no `amplify.yml` in the project, or none that writes `.env.production`, `add` prints this line for you to add. Library modules can now list such variables in the registry (`serverEnv`).

**An app that committed a map should switch to the variable.** `lib/customer-hosts.ts` is the app's own file: the CLI never overwrites it, so an app installed with 3.9.0 keeps its hand-filled map. Note your `CUSTOMER_HOST_SUFFIX`, delete the file, and run `npx buildpad upgrade external-oauth-engine-customers`: it writes the generated file again (and treats the module's other files as any upgrade does). Set the suffix again, add the `amplify.yml` line above by hand (`upgrade` does not edit `amplify.yml`), and press Update and redeploy on the Customers page in each Environment. Avoid `add external-oauth-engine-customers` for this: a module named to `add` is copied over the app's edited files. An app that keeps its own lookup, such as `config/customer-hosts.ts`, can read the same variable, or re-export from this module.

The `scope` mode, and a project whose `project.json` has no `tenancy` member, install `external-oauth-engine` with exactly the same files as before.
