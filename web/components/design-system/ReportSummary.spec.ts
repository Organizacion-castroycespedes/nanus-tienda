import test from "node:test";
import assert from "node:assert/strict";
import { ReportSummary } from "./ReportSummary";

test("ReportSummary renders one compact band with four metric segments", () => {
  const element = ReportSummary({
    items: [
      { label: "Ventas", value: 4 },
      { label: "Total", value: "$ 100" },
      { label: "Pagado", value: "$ 80" },
      { label: "Saldo", value: "$ 20" },
    ],
  }) as { props: { children: unknown; className: string } };

  assert.match(element.props.className, /md:grid-cols-4/);
  assert.equal(Array.isArray(element.props.children), true);
  assert.equal((element.props.children as unknown[]).length, 4);
});
