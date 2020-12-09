import parse from "codsen-parser";
import { selectAll, selectOne } from "css-select";
import { prepare, adapter } from "./index.js";

describe("css-select-codsen-parser", () => {
  test("integration test", () => {
    const ast = prepare(
      parse(`
        <div id="greeting">
          Hello <span class="name" data-attribute>Alice</span>
          Hello <span class="name">Bob</span>
        </div>
      `)
    );

    // queries attribute existence, attribute value, sibling, text,
    const query = "#greeting span[data-attribute] + span.name:icontains(bob)";
    const nodes = selectAll(query, ast, { adapter });
    expect(nodes).toMatchSnapshot();

    const node = selectOne(query, ast, { adapter });
    expect(node).toMatchSnapshot();
  });
});
