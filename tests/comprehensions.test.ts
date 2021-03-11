import { assertPrint } from "./utils.test";

describe("comprehensions test", () => {
  assertPrint(
    "Always false comprehension",
    `
    a: [int] = None
    i: int = 0
    item_in_list: int = 0

    a = [i for i in range(5) if False]
    for item_in_list in a:
      print(item_in_list)
  `,
    [""]
  );

  assertPrint(
    "Full comprehension",
    `
    a: [int] = None
    i: int = 0
    item_in_list: int = 0

    a = [i for i in range(5)]
    for item_in_list in a:
      print(item_in_list)
    `,
    ["0", "1", "2", "3", "4"]
  );

  assertPrint(
    "Multiple comprehensions",
    `
    a: [int] = None
    b: [int] = None
    i: int = 0
    item_in_list: int = 0

    a = [i for i in range(5)]
    for item_in_list in a:
      print(item_in_list)

    b = [i for i in range(15)]
    for item_in_list in b:
      print(item_in_list)
    `,
    [
      "0",
      "1",
      "2",
      "3",
      "4",
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
      "13",
      "14",
    ]
  );

  assertPrint(
    "Expression comprehension",
    `
    a: [int] = None
    i: int = 0
    item_in_list: int = 0

    a = [i * 4 for i in range(5)]
    for item_in_list in a:
      print(item_in_list)
    `,
    ["0", "4", "8", "12", "16"]
  );

  assertPrint(
    "Function expression comprehensions",
    `
    a: [int] = None
    i: int = 0

    def is_even(i : int) -> bool:
      return (i % 2) == 0

    a = [print(i) for i in range(5) if is_even(i)]
    `,
    ["0", "2", "4"]
  );
});
