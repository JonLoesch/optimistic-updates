### Technologies used

Monorepo directory structure template from [modern-typescript-monorepo-example](https://github.com/bakeruk/modern-typescript-monorepo-example)

#### List of TODOs

- CTRL-F for more TODOs in source, there are a few
- Documentation
- Move to Github Pages / Jekyll
- Make sure react-query example actually works
- Debug / Stress test -- creating a bunch of items at once triggeres multiple refetches, and doesn't fully update till last one comes back????
- Look at CI
- Make `ResultOf` pattern not suck
- e2e tests for example apps
- Look into: @tanstack/query-devtools ("Developer tools to interact with and visualize the TanStack Query cache")
- Fill out the list of tech used
- Fill out example project READMEs
- example project -> codesandbox make sure it works
- rename to engine
- adjust signatures to match examples
  - `.inject(...)`
  - `.watchMutation()` => `injectWatch` should be alternate, not default
  - have explcit `{from, to, transform}`??
