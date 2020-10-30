import Tape from "../index.js";

test("adds 1 + 2 to equal 3", () => {
  expect(() => new Tape()).toThrow(/entry/);
});

test("adds 1 + 2 to equal 4", () => {
  expect(() => new Tape({ entry: "/" })).toThrow(/files/);
});

test("adds 1 + 2 to equal 5", () => {
  const tape = new Tape({
    entry: "/index.html",
    files: {
      "/index.html": {
        content: "test",
      },
    },
  });

  expect(async () => await tape.build()).toBeTruthy();
});
