import findHTMLDependencies from "./index.js";

describe("find-html-dependencies", () => {
  test("gathers dependencies in srcset", () => {
    const dependencies = findHTMLDependencies(`
      <img
        srcset="
          elva-fairy-480w.jpg 480w,
          elva-fairy-480w.jpg 800w,
        "
        sizes="(max-width: 600px) 480px, 800px"
        src="elva-fairy-800w.jpg"
        alt="Elva dressed as a fairy"
      > 
    `);

    expect(dependencies).toEqual([
      { path: "elva-fairy-800w.jpg", range: [172, 191] },
      { path: "elva-fairy-480w.jpg", range: [39, 58] },
      { path: "elva-fairy-480w.jpg", range: [75, 94] },
    ]);
  });
  test("parses dependencies in meta", () => {
    const dependencies = findHTMLDependencies(`
      <meta property="og:type" content="website">
      <meta property="og:url" content="https://metatags.io/">
      <meta property="og:title" content="Meta Tags — Preview, Edit and Generate">
      <meta property="og:description" content="With Meta Tags you can edit and experiment with your content then preview how your webpage will look on Google, Facebook, Twitter and more!">
      <meta property="og:image" content="https://metatags.io/assets/meta-tags-16a33a6a8531e519cc0936fbba0ad904e52d35f34a46c97a2c9f6f7dd7d336f2.png">
      <meta name="msapplication-config" content="none" />
    `);

    expect(dependencies).toEqual([
      {
        path:
          "https://metatags.io/assets/meta-tags-16a33a6a8531e519cc0936fbba0ad904e52d35f34a46c97a2c9f6f7dd7d336f2.png",
        range: [425, 530],
      },
    ]);
  });
  test("parses dependencies from a tags", () => {
    const dependencies = findHTMLDependencies(`
      <a href='/another-page.html'>Take it</a>
      <a href='/no-extension'>     Skip it: no extension</a>
      <a href='#anchor.id'>           Skip it: anchor link</a>
    `);

    expect(dependencies).toEqual([
      { path: "/another-page.html", range: [16, 34] },
    ]);
  });

  test("ranges don't include whitespace", () => {
    const dependencies = findHTMLDependencies(`
      <img src=" asdf.png   " />
    `);

    expect(dependencies).toEqual([{ path: "asdf.png", range: [18, 26] }]);
  });

  test("skips empty attributes and data urls", () => {
    const dependencies = findHTMLDependencies(`
      <img src="" />
      <img src="data:image/gif;base64,R0lGODlhEAAQAMQAAORHHOVSKudfOulrSOp3WOyDZu6QdvCchPGolfO0o/XBs/fNwfjZ0frl3/zy7////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH5BAkAABAALAAAAAAQABAAAAVVICSOZGlCQAosJ6mu7fiyZeKqNKToQGDsM8hBADgUXoGAiqhSvp5QAnQKGIgUhwFUYLCVDFCrKUE1lBavAViFIDlTImbKC5Gm2hB0SlBCBMQiB0UjIQA7" />
    `);

    expect(dependencies).toEqual([]);
  });
});
