import { assertPrint } from "./utils.test";

describe("comprehensions test", () => {
  // TODO: Not testable because there is no way to check if a list is empty
  // assertPrint(
  //   "Always false comprehension",
  //   `
  //   a: [int] = None
  //   i: int = 0
  //   item_in_list: int = 0
  //
  //   a = [i for i in range(5) if False]
  //   for item_in_list in a:
  //     print(item_in_list)
  // `,
  //   [""]
  // );

  assertPrint(
    "Full comprehension",
    `
    a: [int] = None
    i: int = 0
    item_in_list: int = 0

    a = [i for i in range(5)]
    print(a[0])
    print(a[1])
    print(a[2])
    print(a[3])
    print(a[4])
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
    print(a[0])
    print(a[1])
    print(a[2])
    print(a[3])
    print(a[4])

    b = [i for i in range(15)]
    print(b[0])
    print(b[1])
    print(b[2])
    print(b[3])
    print(b[4])
    print(b[5])
    print(b[6])
    print(b[7])
    print(b[8])
    print(b[9])
    print(b[10])
    print(b[11])
    print(b[12])
    print(b[13])
    print(b[14])
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
    print(a[0])
    print(a[1])
    print(a[2])
    print(a[3])
    print(a[4])
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
    print(a[0])
    print(a[1])
    print(a[2])
    `,
    ["0", "2", "4", "0", "2", "4"]
  );
});
