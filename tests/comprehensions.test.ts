import { assertPrint } from "./utils.test";

describe("comprehensions test", () => {
  assertPrint(
    "Empty comprehension",
    `
    a: Range = None
    a = [i for i in range(0,5) if False]
    while a.has_next():
      print(a.next())
  `,
    []
  );

  assertPrint(
    "Full comprehension",
    `
    a: Range = None
    a = [i for in range(0,5)]
    while a.has_next():
      print(a.next())
    `,
    ["0", "1", "2", "3", "4"]
  );
});
