import { journey } from "../harness/index.js";
import { textBox } from "../harness/editor.js";
import { refreshChecks } from "../harness/refresh-checks.js";

// KNOBKIT.md task 2: the six checks of task 1, on the multi-line text box
journey("t02", (j) => refreshChecks(j, textBox));
