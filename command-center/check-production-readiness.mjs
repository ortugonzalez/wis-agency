import { productionReadiness } from "./production-readiness.mjs";

const report = productionReadiness(process.env);
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.ready ? 0 : 2;

