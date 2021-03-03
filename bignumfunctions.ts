import { encodeLiteral, decodeLiteral } from "./compiler";
export const bignumfunctions = 
`
(func $$bignum_neg
  (param $x i32)
  (result i32) 
  (local $addr i32)
  (local $i i32)
  (local.get $x)
  (i32.const 1)
  (i32.and)
  (if
    (then
      (i32.const 0)
      (local.get $x)
      ${decodeLiteral.join("\n")}
      (i32.sub)
      ${encodeLiteral.join("\n")}
      (local.set $x)
    )
    (else
      (i32.load (i32.const 0))
      (local.set $addr)
      (local.get $addr)
      (i32.const 1)
      (i32.load (local.get $x))
      (i32.sub)
      (i32.store)
      (i32.add (local.get $addr) (i32.const 4))
      (i32.add (local.get $x) (i32.const 4))
      (i32.load)
      (local.set $i)
      (i32.store (local.get $i) )
      (local.set $addr (i32.add (local.get $addr) (i32.const 8)))
      (local.set $x (i32.add (local.get $x) (i32.const 8)))
      (loop
        (local.get $i)
        (if
          (then
            (local.get $addr)
            (local.get $x)
            (i32.load)
            (i32.store)
            (local.set $addr (i32.add (local.get $addr) (i32.const 4)))
            (local.set $x (i32.add (local.get $x) (i32.const 4)))
            (local.set $i (i32.sub (local.get $i) (i32.const 1)))
            (br 1)
          )
        )
      )
      (i32.const 0)
      (i32.const 0)
      (i32.load)
      (local.set $x)
      (local.get $addr)
      (i32.store)
    )
  )
  (local.get $x)
)

`
;
