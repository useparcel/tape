import findCSSDependencies from "./index.js";
describe("find-css-dependencies", () => {
  test("parses @import dependencies", () => {
    const dependencies = findCSSDependencies(`
      @import '/reset.css';
      @import '/another-reset.css';
    `);

    expect(dependencies).toEqual([
      { path: "/reset.css", range: [16, 26] },
      { path: "/another-reset.css", range: [44, 62] },
    ]);
  });

  test("parses url() dependencies", () => {
    const dependencies = findCSSDependencies(`
      body {
        background: url(
          "my-image-on-a-new-line.png"
        );
        background: url(my-image-no-quotes.png);
        background: url("my-image-double-quotes.png");
        background: url(my-image-end-quote.png");
        background: url("my-image-is-invalid.png);
      }
    `);

    expect(dependencies).toEqual([
      { path: "my-image-on-a-new-line.png", range: [50, 76] },
      { path: "my-image-no-quotes.png", range: [113, 135] },
      { path: "my-image-double-quotes.png", range: [163, 189] },
      { path: 'my-image-end-quote.png"', range: [217, 240] },
      { path: "my-image-is-invalid.png", range: [268, 291] },
    ]);
  });

  test("parses multiple url() dependencies", () => {
    const dependencies = findCSSDependencies(`
      background-image: url(img_flwr.gif), url(paper.gif);
      background-image:
        url(some-weird-whitespace.gif)
      ,
        url(
          seriously.gif
        );
    `);

    expect(dependencies).toEqual([
      { path: "img_flwr.gif", range: [29, 41] },
      { path: "paper.gif", range: [48, 57] },
      { path: "some-weird-whitespace.gif", range: [96, 121] },
      { path: "seriously.gif", range: [154, 167] },
    ]);
  });

  test("skips empty dependencies", () => {
    const dependencies = findCSSDependencies(`
      background-image: url(""), url();
      @import '';
      @import "   ";
      @import url();
      @import url("");
    `);

    expect(dependencies).toEqual([]);
  });

  test("skips data url dependencies and anchors", () => {
    const dependencies = findCSSDependencies(`
      background: url("data:image/gif;base64,R0lGODlhEAAQAMQAAORHHOVSKudfOulrSOp3WOyDZu6QdvCchPGolfO0o/XBs/fNwfjZ0frl3/zy7////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH5BAkAABAALAAAAAAQABAAAAVVICSOZGlCQAosJ6mu7fiyZeKqNKToQGDsM8hBADgUXoGAiqhSvp5QAnQKGIgUhwFUYLCVDFCrKUE1lBavAViFIDlTImbKC5Gm2hB0SlBCBMQiB0UjIQA7");
      filter: url('#svg');
    `);

    expect(dependencies).toEqual([]);
  });

  test("ranges don't include whitespace", () => {
    const dependencies = findCSSDependencies(`
      @import '   /reset.css  ';
    `);

    expect(dependencies).toEqual([{ path: "/reset.css", range: [19, 29] }]);
  });
});
