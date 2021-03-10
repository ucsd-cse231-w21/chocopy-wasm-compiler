import { assertPrint } from "./utils.test";

describe("comprehensions test", () => {

  // assertPrint(
  //   "Always false comprehension",
  //   `
  //   a: Range = None
  //   a = [i for i in range(5) if False]
  //   while a.cur <= a.stop:
  //     print(a.cur)
  //     a.cur = a.cur + a.step
  // `,
  //   [""]
  // );
  //
  // assertPrint(
  //   "Full comprehension",
  //   `
  //   a: Range = None
  //   a = [i for i in range(0,5)]
  //   while a.has_next():
  //     print(a.next())
  //   `,
  //   ["0", "1", "2", "3", "4"]
  // );
  //
  // assertPrint(
  //   "Multiple comprehensions",
  //   `
  //   a: Range = None
  //   b: Range = None
  //
  //   a = [i for i in range(0,5)]
  //   while a.has_next():
  //     print(a.next())
  //
  //   b = [i for i in range(10,15)]
  //   while b.has_next():
  //     print(b.next())
  //   `,
  //   ["0", "1", "2", "3", "4", "10", "11", "12", "13", "14"]
  // );
  //
  // // TODO: These tests should pass once the expression in the comprehensions are actually evaluated.
  // assertPrint(
  //   "Expression comprehension",
  //   `
  //   a: Range = None
  //   a = [i * 4 for i in range(0,5)]
  //   while a.has_next():
  //     print(a.next())
  //   `,
  //   ["0", "4", "8", "12", "16"]
  // );
  //
  // assertPrint(
  //   "Function expression comprehensions",
  //   `
  //   a: Range = None
  //   a = [print(i) for i in range(0, 5)]
  //   `,
  //   ["0", "1", "2", "3", "4"]
  // );
});
