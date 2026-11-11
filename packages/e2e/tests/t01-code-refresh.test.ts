import { journey } from "../harness/index.js";
import { codeEditor } from "../harness/editor.js";
import { refreshChecks } from "../harness/refresh-checks.js";

// KNOBKIT.md task 1: the code editor keeps the cursor when its text is refreshed
journey("t01", (j) => refreshChecks(j, codeEditor));
