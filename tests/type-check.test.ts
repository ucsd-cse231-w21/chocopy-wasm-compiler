import { assertTC, assertTCFail } from "./utils.test";
import { NUM, BOOL, NONE, CALLABLE, CLASS } from "../utils";
import { skipPartiallyEmittedExpressions } from "typescript";

describe("type-check", () => {
  assertTC(
    "var callable[[], None]",
    `
        f: Callable[[], None] = None
        f`,
    CALLABLE([], NONE)
  );

  assertTC(
    "var callable[[int, bool], A]",
    `
        f: Callable[[int, bool], A] = None
        f`,
    CALLABLE([NUM, BOOL], CLASS("A"))
  );

  assertTC(
    "nest-fun-tc",
    `
        def f(x: int) -> int:
            def inc() -> int:
                return x + 1
            return inc()
        f(5)`,
    NUM
  );

  assertTC(
    "double-nest-fun-tc",
    `
        def f(x : int) -> int:
            def g(y : int) -> int:
                def k(z: int) -> int:
                    return z
                return x + k(5)
            return g(10) + g(7)
        f(6)`,
    NUM
  );

  assertTC(
    "ret-callable-fun-tc1",
    `
        def f(x : int) -> Callable[[int], bool]:
            def g(y : int) -> bool:
                return x > y
            return g
        f(6)`,
    CALLABLE([NUM], BOOL)
  );

  assertTC(
    "ret-callable-fun-tc2",
    `
        def f(x : int) -> Callable[[int], bool]:
            def g(y : int) -> bool:
                return x > y
            return g
        f(6)(5)`,
    BOOL
  );

  assertTC(
    "arg-ret-callable-fun-tc",
    `
        def f(x : int) -> Callable[[int], bool]:
            def g(y : int) -> bool:
                return x > y
            return g

        def id(c : Callable[[int], bool]) -> Callable[[int], bool]:
            return c

        id(f(10))(5)`,
    BOOL
  );

  assertTCFail(
    "bad assign type callable",
    `
        f: Callable[[int], bool] = None
        def g(x:int)->int:
            return 4
        f = g`
  );

  assertTC(
    "method-field-callable-tc",
    `
        class A(object):
            x:Callable[[int],Callable[[],bool]] = None

        def f(x:int)->Callable[[],bool]:
            def g()->bool:
                return x > 5
            return g
        a:A = None
        a.x = f
        a.x(5)()`,
    BOOL
  );

});

describe.skip("lambda", function() {
  assertTC(
    "lambda-no-arg-tc",
    `
        x:Callable[[],int] = None
        x = lambda : 10
        x()`,
    NUM
  );

  assertTC(
    "lambda-1-arg-tc",
    `
        x:Callable[[int], bool] = None
        x = lambda a : True
        x(1)`,
    BOOL
  );

  // TODO: lambda expression not fully implemented
  assertTC(
    "lambda-args-tc",
    `
        x:Callable[[int, bool],] = None
        x = lambda a,b : None
        x(1, True)`,
    NONE
  );

  assertTC(
    "ret-lambda-fun-tc1",
    `
        def f(x:int)->Callable[[bool],int]:
            return lambda a: x
        f(4)`,
    CALLABLE([BOOL], NUM)
  );

  assertTC(
    "ret-lambda-fun-tc2",
    `
        def f(x:int)->Callable[[bool],int]:
            return lambda a: x
        f(4)(True)`,
    NUM
  );
})
