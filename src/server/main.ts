// The server part: keeps the project's panels and runs their widgets'
// scripts, one Node process per server, started on the first call.
// `@hyperpane/sdk/server` is always the server's own copy.

import { serve } from '@hyperpane/sdk/server';
import { widgets } from './plugin.ts';

// A script may start a promise it never waits for, and that may fail
// after its run has ended: say so in the log, rather than let Node end the
// process (and every other run with it).
process.on('unhandledRejection', (reason) => {
  console.error('A script’s promise failed with nobody waiting for it:', reason);
});

serve(widgets);
