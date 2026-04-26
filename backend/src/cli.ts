#!/usr/bin/env node

import { runCli } from "./cli-lib.js";

const exitCode = await runCli(process.argv);
process.exit(exitCode);
