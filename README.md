# metal-promise

[![Build Status](https://travis-ci.org/metal/metal-promise.svg?branch=master)](https://travis-ci.org/metal/metal-promise)

```
/*!
 * Promises polyfill from Google's Closure Library in ES6.
 *
 *      Copyright 2013 The Closure Library Authors. All Rights Reserved.
 *
 * Promise support is not ready on all supported browsers,
 * therefore core.js is temporarily using Google's promises as polyfill. It
 * supports cancellable promises and has clean and fast implementation.
 */
 ```

## Updating

`metal-promise` is essentially a copy of google closure's Promise polyfill,
because of this there are certain steps that need to be taken in order to make
it compatible with the Metal ecosystem.

### Step 1 - Copy From Source

The source files are located in the https://github.com/google/closure-library/ repository.

Here is a list of the components that need to be copied.

1. Promise (CancellablePromise): https://github.com/google/closure-library/blob/master/closure/goog/promise/promise.js
2. Thenable: https://github.com/google/closure-library/blob/master/closure/goog/promise/thenable.js
3. FreeList: https://github.com/google/closure-library/blob/master/closure/goog/async/freelist.js

Current `closure-library` SHA of copied files: https://github.com/google/closure-library/commit/a02961362b67992f2fee13bf74672bd576d67af7

### Step 2 - Convert

These files contain many references to various `goog` globals that need to be
either removed or updated to a Metal alternative.

Check this commit range to see a full list of necessary changes.

https://github.com/metal/metal-promise/compare/2b195bc02d390da1203d50918613cc8f93a31070...2b4b990c61a9c4616779f75d169ac27d9dcc32bf

### Step 3 - Tests

When updating, check to see if any new features or methods have been added, if
so add any additional tests to cover that use case.

Google closure tests: https://github.com/google/closure-library/blob/master/closure/goog/promise/promise_test.js
