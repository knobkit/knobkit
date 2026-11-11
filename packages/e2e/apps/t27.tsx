import { file, knobkit } from "knobkit";
import { recorder } from "./_rec.js";

const rec = recorder();
const link = file({ name: "report.csv", url: "data:text/csv,a%2Cb%0A1%2C2%0A" });

export const app = knobkit({ title: "t27", widgets: [link, rec.widget] });
