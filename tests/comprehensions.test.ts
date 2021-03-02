import { assertPrint } from "./utils.test";

describe("comprehensions test", () => {
  assertPrint(
    "Empty comprehension",
    `
    a: Range = [i for i in range(5) if False]
    while a.hasNext():
      print(a.next())
  `,
    []
  );

  assertPrint(
    "Full comprehension",
    `
    a: Range = [i for in range(5)]
    while a.hasNext():
      print(a.next())
    `,
    ["0", "1", "2", "3", "4"]
  );
});
