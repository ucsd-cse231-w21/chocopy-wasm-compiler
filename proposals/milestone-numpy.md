## Highlights (*3/11 submission*)
This project highlights three key compiler designs:

- Extending Numpy support for the Chocopy compiler. This may greatly attract the data science community, as well as enable large-scale in-browser matrix operations. See more in `numpy.ts`.

- Standardizing TypeSciept (TS) package import design. Though WebAssembly (WASM) runs fast, its functionality development is still at the early stage, which can be easily complemented by existing JS/TS packages. See more in `ast.ts` and `parser.ts`.

- Managing memory and its coordination between WASM and TS heaps. Compared to WASM heaps, TS heaps still have great advantages in supporting complex data structures and reducing IO overhead for TS builtins. This project will demonstrate how ndarray's field and lists data structure can be managed efficiently in WASM and TS heaps, respectively. See more in `compiler.ts`. 

## Final examples (*3/11 submission*)
Overall, we completed 13 examples as outlined below, including 10 examples proposed on 3/4 with some minor updates and 3 more examples. All examples below and their REPLs are tested via `tests\numpy.test.ts`.

- Example below tests the import statement and its alias wrapper. The returned type is expected to be of class `numpy` and have value type of `None`. 

```
import numpy as np
np
```

- Example below tests numpy 1drray initialization. The returned type is expected to be of class `numpy_ndarray`. Further REPLs `a.data` should give a list type with TS heap offset at `0` and `print(a.flatten().tolist())` should print a flattened list of values `1, 2`. Note that `flatten()` and `tolist()` are both fully implemented ndarray methods and are particularly handy for testing and printing.

```
import numpy as np
a : np.ndarray = None
a = np.array([1,2])
a
```

- Example below tests numpy 2drray initialization. The returned type is expected to be of class `numpy_ndarray`. Further REPLs `a.data` should give a list type with TS heap offset at `0` and `print(a.flatten().tolist())` should print a flattened list of values `1, 2, 3, 4, 5, 6`.

```
import numpy as np
a : np.ndarray = None
a = np.array([[1,2,3], [4,5,6]])
a
```

- Example below tests numpy *signed* 2drray initialization. It should print a flattened list of values `-1, 2, -3, -4, 5, -6`.

```
import numpy as np
b : np.ndarray = None
b = np.array([[-1,2,-3], [-4,5,-6]])
print(b.flatten().tolist())
```

- Example below tests numpy 2drray shape field access. The returned value is expected as `2`. Further REPL `a.shape1` should give `3`. Note that here we split list-typed shape field as two values for simplification, as well as for demonstrating field lookup from WASM heap as normal class objects.

```
import numpy as np
a : np.ndarray = None
a = np.array([[1,2,3], [4,5,6]])
a.shape0
```

- Example below tests numpy 2drray element-wise add operation, equivalently `a.add(b)`. The returned type is expected to be of class `numpy_ndarray`. Further REPL `print((a+b).flatten().tolist())` should print a flattened list of values `0, 4, 0, 0, 10, 0`.

```
import numpy as np
a : np.ndarray = None
b : np.ndarray = None
a = np.array([[1,2,3], [4,5,6]])
b = np.array([[-1,2,-3], [-4,5,-6]])
a+b
```

- Example below tests numpy 2drray element-wise add operation when shape mismatch between (2,3) and (2,2) will cause an error. This error will be checked dynamically during `add()` call run-time. 

```
import numpy as np
b : np.ndarray = None
c : np.ndarray = None
b = np.array([[-1,2,-3], [-4,5,-6]])
c = np.array([[1,2], [4,5]])
b+c
```

- Example below tests numpy 2drray matrix multiplication operation, equivalently `c.dot(b)`. The returned type is expected to be of class `numpy_ndarray`. Further REPL `print((c@b).flatten().tolist())` should print a flattened list of values `-9, 12, -15, -24, 33, -42`.

```
 import numpy as np
 b : np.ndarray = None
 c : np.ndarray = None
 b = np.array([[-1,2,-3], [-4,5,-6]])
 c = np.array([[1,2], [4,5]])
 c@b
```

- Example below tests numpy 2drray matrix multiplication operation when shape mismatch between (2,2) and (3,3) will cause an error. This error will be checked dynamically during `dot()` call run-time. 

```
import numpy as np
c : np.ndarray = None
d : np.ndarray = None
c = np.array([[1,2], [4,5]])
d = np.array([[-1,2,-3], [-4,5,-6], [7,8,9]])
c@d
```

- Example below tests numpy 2drray data field access with multiple globals. The returned value is expected as `0`, the TS heap offset of the list-typed data. Further REPL `d.data` should give `1`. 

```
import numpy as np
c : np.ndarray = None
d : np.ndarray = None
c = np.array([[1,2], [4,5]])
d = np.array([[-1,2,-3], [-4,5,-6], [7,8,9]])
c.data
```

- Example below tests numpy 2drray element-wise integer-divide operation, equivalently `a.divide(b)`. This should print a flattened list of values `-1, 1, -1, -1, 1, -1`.

```
import numpy as np
a : np.ndarray = None
b : np.ndarray = None
a = np.array([[1,2,3], [4,5,6]])
b = np.array([[-1,2,-3], [-4,5,-6]])
print((a//b).flatten().tolist())
```

- Example below tests numpy 2drray element-wise multiplication operation, equivalently `a.multiply(b)`. This should print a flattened list of values `-1, 4, -9, -16, 25, -36`.

```
import numpy as np
a : np.ndarray = None
b : np.ndarray = None
a = np.array([[1,2,3], [4,5,6]])
b = np.array([[-1,2,-3], [-4,5,-6]])
print((a*b).flatten().tolist())
```

- Example below tests numpy 2drray element-wise subtraction operation, equivalently `a.subtract(b)`. This should print a flattened list of values `2, 0, 6, 8, 0, 12`.

```
import numpy as np
a : np.ndarray = None
b : np.ndarray = None
a = np.array([[1,2,3], [4,5,6]])
b = np.array([[-1,2,-3], [-4,5,-6]])
print((a-b).flatten().tolist())
```

- Example below tests numpy 2drray element-wise power operation, equivalently `b.pow(a)`. This should print a flattened list of values `-1, 4, -27, 256, 3125, 46656`.

```
import numpy as np
a : np.ndarray = None
b : np.ndarray = None
a = np.array([[1,2,3], [4,5,6]])
b = np.array([[-1,2,-3], [-4,5,-6]])
print((b**a).flatten().tolist())
```

## 3 more examples requiring more extensions (*3/11 submission*)

- Example below will demonstrate the interaction between ndarray objects and other types such as number. This extension requires updated type checking to allow numbers assigned to ndarrays, upcasting numbers as ndarrays, and [broadcasting](https://numpy.org/doc/stable/user/theory.broadcasting.html#array-broadcasting-in-numpy) numbers to full-dimension ndarrays. **See latest commits [here](https://github.com/bensonlyu/chocopy-wasm-compiler/commit/fdeb785bdc71f5db87a563a490fff037ca2e5411) and a small fix [here](https://github.com/bensonlyu/chocopy-wasm-compiler/commit/d1e02b6d0e3886f32e1b0c755ad84bfdb9c7f39e)**. 

```
import numpy as np
a : np.ndarray = None
a = np.array([[1,2,3], [4,5,6]])
10+a
```

- Example below will demonstrate creating ndarrays above 2 dimensions. This extension requires updating ndarray field signature, `numpy_array` method, and other shape match checking implementations.

```
import numpy as np
a : np.ndarray = None
a = np.array([[[[1,2]], [[3,4]], [[5,6]]]])
```

- Example below will demonstrate creating ndarrays directly from a list-type variable. This requires more coordination with the lists and memory management team on how to access the list content and make it efficient. 

```
import numpy as np
b: list = None
a : np.ndarray = None
b = [1,2]
a = np.array(b)
```

## 2 examples (*3/4 submission*)

Tests are automated in `tests\numpy.test.ts`.

- Example below tests the import statement and its alias wrapper. The returned type is expected to be of class `numpy$import`.  

```
import numpy as np
np
```

- Example below tests numpy initialization. The returned type is expected to be of class `numpy`. 

```
import numpy as np
a : np = None
a = np.array(10)
a
``` 

- The example above is indeed parsed by `parser.ts` as 

```
class numpy$import: 
	def array(self, object) : numpy : 
		...
np : numpy$import = None

class numpy: 
	<dtype, shape fields> 
	<add(), dot() methods> 

a: numpy = None
a = np.array(10)
``` 

## Expected examples by March 11 (*3/4 submission*)

- Example below tests 1D ndarray initialization. Initialization is parsed the same way as class initialization and each ndarray object will have fields storing its dtype, shape, pointer to ndarray, etc. For now, the given list will be parsed as ndarray in brute force. List elements will be saved in heap. Type information will also be stored for type checking.

```
import numpy as np
a : np = np.array([1,2])
``` 

- Example below tests 2D ndarray initialization. Note that here the given list is double-nested.

```
import numpy as np
a : np = np.array([[1,2,3], [4,5,6]])
``` 

- Example below tests 2D ndarray initialization. Note that list elements may be signed.

```
import numpy as np
b : np = np.array([[-1,2,-3], [-4,5,-6]])
``` 

- Example below tests ndarray field lookup of the object's shape. Compiling procedures will similar to field lookup. Note that the shape will be dynamically determined based on the given list during initialization.

```
import numpy as np
a : np = np.array([[1,2,3], [4,5,6]]) 
a.shape 
``` 

- Example below tests ndarray element-wise operation of plus. This will be treated as a method call of `a.__add__(b)`, which will return a new ndarray object with its fields dynamically updated as well, such as ndarray pointer. 

```
import numpy as np
a : np = np.array([[1,2,3], [4,5,6]]) 
b : np = np.array([[-1,2,-3], [-4,5,-6]]) 
a+b
``` 

- Example below tests ndarray element-wise operation of plus with shape match. This will first access object fields via heap in TS and check if all dimensions are the same. Example below should give an error of shape mismatch between (2,2) and (2,3).

```
import numpy as np
c : np = np.array([[1,2], [4,5]]) 
b : np = np.array([[-1,2,-3], [-4,5,-6]])
c+b
``` 

## If-possible examples by March 11

- Example below tests ndarray matrix operation of dot product. This will be treated as a method call of `c.dot(b)`, which will return a new ndarray object with its fields dynamically updated as well, such as ndarray pointer. 

```
import numpy as np
c : np = np.array([[1,2], [4,5]]) 
b : np = np.array([[-1,2,-3], [-4,5,-6]]) 
c@b
``` 

- Example below tests ndarray matrix operation of dot product with shape match. This will first access object fields via heap in TS and check if the 2nd dimension of 1st object match the 1st dimension of 2nd object. Example below should give an error of dimension mismatch between (2,2) and (3,3).

```
import numpy as np
c : np = np.array([[1,2], [4,5]]) 
d : np = np.array([[-1,2,-3], [-4,5,-6], [7,8,9]])
c@d
``` 

## Description of challenges (*3/4 submission*)

Below are several biggest challenges:

- One big challenge is to coordinate with another builtin team to ensure my numpy import design is compatible with theirs. This requires a careful design and lengthy refinements of import mechanisms, such as tracking alias, supporting imported classes/functions/vars (versus a single ndarray class I originally envisioned). See more details in commits of `ast.ts` and `parser.ts`.

- The second challenge is to coordinate with other data structure teams such as lists. List is a fundamental data structure for numpy such as ndarray initialization. Also, knowing list's memory management design is useful in ensuring fast and consistent ndarray access/update in WASM heap.

- The third challenge is to test out two alternative solutions of implementing numpy functions: [Pyodide](https://github.com/iodide-project/pyodide) and [NumJs](https://github.com/nicolaspanel/numjs). We finally paused the Pyodide solution due to following reasons:

	- Pyodide requires a large dependency. Even though it was possible to only import Numpy package as in [pyodide-node](https://github.com/gabrielfreire/pyodide-node), Python standard libraries are still required.
	- Pyodide may cause conflicts when sharing the WASM linear memory with our compiler. One solution is to use multiprocessing, which however leads to communication overhead.
	- Directly using Pyodide's compiled Numpy WASM package requires sophisticated designs of memory management and list syntax, which are still in progress.    