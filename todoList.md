#### Docs stuff:

- http://localhost:3000/docs/getting-started
  - react-query app-wide integration
- http://localhost:3000/docs/guide/injections
  - Injections are the core of the Optimistic Update Engine
  - you can call inject as many times as you like during setup
  - Each inject has conceptually has two parameters:
    - The first (from,into) is for identifying a pair of endpoints and is adapater-specific
    - The second (transform) is for immutably altering the data
- Using Optimistic Updates -> Immutable Updates
  - Immutable updates are useful because ....
  - Gotchas to watch out for
  - `immer`
- http://localhost:3000/docs/guide/philosophy
  - ... mostly from old readme
- http://localhost:3000/docs/advanced/details
  - ... mostly from old readme
- http://localhost:3000/docs/advanced/cache
  - ... mostly from old readme
  - Move under advanced?
  - Move advaned under "using" section?
- http://localhost:3000/docs/examples/frontpage
- http://localhost:3000/docs/examples/react-query
  - Link to README of sub-project (and back)
  - Have Codesandbox embedded????
- http://localhost:3000/docs/examples/trpc
  - Link to README of sub-project (and back)
  - Have Codesandbox embedded????
- Make NPM pages have links to github repo
- Have version string in top left (with disclaimer in mouseover)

#### Later:

- react query kit
- optimisticArrayRemove, optimisticArrayInsert
- Make lint/prettier warnings not errors (i.e. not block git actions)
- Put example react query status in separate react root
- CTRL-F for more TODOs in source, there are a few
- Look at CI
- e2e tests for example apps
- Look into: @tanstack/query-devtools ("Developer tools to interact with and visualize the TanStack Query cache")
- Fill out the list of tech used
  - Monorepo directory structure template from [modern-typescript-monorepo-example](https://github.com/bakeruk/modern-typescript-monorepo-example)
- example project -> codesandbox make sure it works
