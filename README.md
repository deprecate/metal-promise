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

## Use

### Simple use case

```javascript
import CancellablePromise from 'metal-promise';

new CancellablePromise(function(resolve, reject) {
  asyncFunction(function(err) {
    if (err) {
      reject(err);
    }
    else {
      resolve();
    }
  });
})
.then(function() {
  // Invoked once resolved
})
.catch(function(err) {
  // Invoked once rejected
});
```

### Progress tracking

In addition to Google Closure's implementation of Promise,
the `ProgressPromise` class is also provided for tracking the progress of an
async process.

```javascript
import {ProgressPromise} from 'metal-promise';

new ProgressPromise(function(resolve, reject, progress) {
  progress(0.3);
  progress(0.5);
  progress(0.7);
  progress(0.9);

  setTimeout(function() {
    resolve();
  }, 100);
})
.progress(progress => {
  // Will invoke 4 times, 0.3, 0.5, 0.7, 0.9
})
.then(function() {
  // Invoked after all progress calls
});
```

Note that the `progress` function must be invoked with a number
between `0` and `1`.

```javascript
progress(2); // TypeError: The progress percentage should be a number between 0 and 1
```

It also cannot be invoked with a smaller number than the previous call.

```javascript
progress(0.3);
progress(0.1); // Error: The progress percentage can't be lower than the previous percentage
```

### Advanced use cases

To see more advanced documentation, please visit Google Closure
Library's [documentation](https://google.github.io/closure-library/api/goog.Promise.html);

## Setup

1. Install a recent release of [NodeJS](https://nodejs.org/en/download/) if you
don't have it yet.

2. Install local dependencies:

  ```
  npm install
  ```

3. Run the tests:

  ```
  npm test
  ```

## Contributing

Check out the [contributing guidelines](https://github.com/metal/metal-promise/blob/master/CONTRIBUTING.md) for more information.
