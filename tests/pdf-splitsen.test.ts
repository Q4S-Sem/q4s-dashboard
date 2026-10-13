import assert from "node:assert/strict";
import test from "node:test";
import { groepeerPaginas } from "../src/lib/pdf-splitsen";

test("urenstaat + factuur in één PDF: pagina's per deel, overige bij de urenstaat", () => {
  assert.deepEqual(groepeerPaginas(["TIMESHEET", "FACTUUR"]), { uren: [0], factuur: [1] });
  assert.deepEqual(groepeerPaginas(["FACTUUR", "TIMESHEET", "OVERIG"]), { uren: [1, 2], factuur: [0] });
  // Geen combinatie → niet knippen.
  assert.equal(groepeerPaginas(["TIMESHEET", "TIMESHEET"]), null);
  assert.equal(groepeerPaginas(["FACTUUR", "OVERIG"]), null);
});
