// Entry point so the brief's literal command `node --test schedule-app/tests/unit/`
// works on Node 22, which resolves a directory argument to its index.js.
'use strict';
require('./model.test.js');
require('./storage.test.js');
