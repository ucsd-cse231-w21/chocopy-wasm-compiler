// -*- mode: typescript; typescript-indent-level: 2; -*-

import { ClassEnv } from './env';

export var funcs: Array<Array<string>> = [
`    (func $str$endswith (param $string i64)  (param $suffix i64)  (result i64)
        (local $$last i64)
        (local $start i64)
        (local $iter i64)
        (local.get $suffix)
        (call $str$len)
        
        (local.get $string)
        (call $str$len)
        
        (i64.gt_s)
        (i64.extend_i32_s)
        (if
            (i32.wrap/i64) (then
                (i64.const 4611686018427387904) ;; False
                (return)
                )
            (else
                )
            
            )
        (local.get $string)
        (call $str$len)
        
        (local.get $suffix)
        (call $str$len)
        
        (i64.sub)
        (local.set $start)
        (local.get $start)
        (local.set $iter)
        (block (loop
                (local.get $iter)
                (local.get $string)
                (call $str$len)
                
                (i64.lt_s)
                (i64.extend_i32_s)
                (i32.wrap/i64)
                (i32.const 1)
                (i32.xor)
                (br_if 1)
                (local.get $suffix)
                (local.get $iter)
                (local.get $start)
                (i64.sub)
                (i64.const 2305843009213693952) ;; Missing argument replaced with None
                (i64.const 2305843009213693952) ;; Missing argument replaced with None
                (i64.const 1) ;; Number of argument explicitly specified
                (call $str$slice)
                (local.get $string)
                (local.get $iter)
                (i64.const 2305843009213693952) ;; Missing argument replaced with None
                (i64.const 2305843009213693952) ;; Missing argument replaced with None
                (i64.const 1) ;; Number of argument explicitly specified
                (call $str$slice)
                (call $str$neq)
                (if
                    (i32.wrap/i64) (then
                        (i64.const 4611686018427387904) ;; False
                        (return)
                        )
                    (else
                        )
                    
                    )
                (local.get $iter)
                (i64.const 1) ;; int
                (i64.add)
                (local.set $iter)
                (br 0)
                ))
        (i64.const 4611686018427387905) ;; True
        (return)
        )

`.split("\n"),
  
  `(func $str$startswith (param $string i64)  (param $prefix i64)  (result i64)
      (local $$last i64)
      (local $iter i64)
      (local.get $prefix)
      (call $str$len)
      
      (local.get $string)
      (call $str$len)
      
      (i64.gt_s)
      (i64.extend_i32_s)
      (if
          (i32.wrap/i64) (then
			  (i64.const 4611686018427387904) ;; False
			  (return)
			  )
        (else
         )
        
        )
      (i64.const 0) ;; int
      (local.set $iter)
      (block (loop
              (local.get $iter)
              (local.get $prefix)
              (call $str$len)
              
              (i64.lt_s)
              (i64.extend_i32_s)
              (i32.wrap/i64)
              (i32.const 1)
              (i32.xor)
              (br_if 1)
              (local.get $prefix)
              (local.get $iter)
              (i64.const 2305843009213693952) ;; Missing argument replaced with None
              (i64.const 2305843009213693952) ;; Missing argument replaced with None
              (i64.const 1) ;; Number of argument explicitly specified
              (call $str$slice)
              (local.get $string)
              (local.get $iter)
              (i64.const 2305843009213693952) ;; Missing argument replaced with None
              (i64.const 2305843009213693952) ;; Missing argument replaced with None
              (i64.const 1) ;; Number of argument explicitly specified
              (call $str$slice)
              (call $str$neq)
              (if
                  (i32.wrap/i64) (then
				  (i64.const 4611686018427387904) ;; False
				  (return)
				  )
                (else
                 )
                
                )
              (local.get $iter)
              (i64.const 1) ;; int
              (i64.add)
              (local.set $iter)
              (br 0)
              ))
      (i64.const 4611686018427387905) ;; True
      (return)
)

`.split("\n")
];

