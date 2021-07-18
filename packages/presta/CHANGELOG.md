# presta

## 0.35.1

### Patch Changes

- [`17ba054`](https://github.com/sure-thing/presta/commit/17ba054a323e44a6c62270cc74dbd88eba8cdfa8) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Adds additional export of getCurrentPrestaInstance

## 0.35.0

### Minor Changes

- [#105](https://github.com/sure-thing/presta/pull/105) [`bb4c1d0`](https://github.com/sure-thing/presta/commit/bb4c1d0d3505bd99639eec8d244e4a1763c77458) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - - adds `postbuild` event for adapter plugin use
  - adds support for rudimentary plugins
  - adds and fixes a few types

### Patch Changes

- [#105](https://github.com/sure-thing/presta/pull/105) [`c47957c`](https://github.com/sure-thing/presta/commit/c47957c6b9c4c97f578094a3e991a2aaeaaf8670) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Require cache was not being cleared during watch

## 0.34.6

### Patch Changes

- [`0e6130e`](https://github.com/sure-thing/presta/commit/0e6130e3ceb3f5bcac3b9ac94ff95b590400f05f) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Test new changeset config

## 0.34.5

### Patch Changes

- 0d514fd: New tiny-glob package was returning relative filepaths — the opposite of previous library, matched.

## 0.34.4

### Patch Changes

- ff08a59: Test changesets with new config

## 0.34.3

### Patch Changes

- Test changeset with new config

## 0.34.2

### Patch Changes

- Previous build was published using es-mime-types, which is ESM an was not transpiled. This release reverts to mime-types and installs the TypeScript types required to use it.

## 0.34.1

### Patch Changes

- Setup changesets
