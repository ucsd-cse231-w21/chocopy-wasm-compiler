## 2 examples

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

## Expected examples by March 11

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

## Description of challenges

Below are several biggest challenges:

- One big challenge is to coordinate with another builtin team to ensure my numpy import design is compatible with theirs. This requires a careful design and lengthy refinements of import mechanisms, such as tracking alias, supporting imported classes/functions/vars (versus a single ndarray class I originally envisioned). See more details in commits of `ast.ts` and `parser.ts`.

- The second challenge is to coordinate with other data structure teams such as lists. List is a fundamental data structure for numpy such as ndarray initialization. Also, knowing list's memory management design is useful in ensuring fast and consistent ndarray access/update in WASM heap.

- The third challenge is to test out two alternative solutions of implementing numpy functions: [Pyodide](https://github.com/iodide-project/pyodide) and [NumJs](https://github.com/nicolaspanel/numjs). We finally paused the Pyodide solution due to following reasons:

	- Pyodide requires a large dependency. Even though it was possible to only import Numpy package as in [pyodide-node](https://github.com/gabrielfreire/pyodide-node), Python standard libraries are still required.
	- Pyodide may cause conflicts when sharing the WASM linear memory with our compiler. One solution is to use multiprocessing, which however leads to communication overhead.
	- Directly using Pyodide's compiled Numpy WASM package requires sophisticated designs of memory management and list syntax, which are still in progress.    