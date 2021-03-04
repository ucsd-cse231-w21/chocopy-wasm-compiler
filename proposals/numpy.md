## Introduction

This project implements a subset of Numpy with focus on the most popular scalar and matrix operations. Two alternative solutions will be explored:

- Run commands in WASM via [Pyodide](https://github.com/iodide-project/pyodide), which interfaces compiled Numpy packages in WASM. This solution was paused due to following reasons:

	- Pyodide requires a large dependency. Even though it was possible to only import Numpy package as in [pyodide-node](https://github.com/gabrielfreire/pyodide-node), Python standard libraries are still required.
	- Pyodide may cause conflicts when sharing the WASM linear memory with our compiler. One solution is to use multiprocessing, which however leads to communication overhead.
	- Directly using Pyodide's compiled Numpy WASM package requires sophisticated designs of memory management and list syntax, which are still in progress.   

- Run commands in JS via [NumJs](https://github.com/nicolaspanel/numjs), which emulates Numpy functionalities in JS.

Considering the given AST limitations, one-person workload, and compatibility with other teams, we will restrict our implementations by making several key assumptions:

- Numpy only imports a single class of [ndarray](https://numpy.org/doc/stable/reference/arrays.ndarray.html). I.e., Numpy is treated as a Class in our AST. Also, ndarray's methods should be powerful enough to cover most daily usages, especially scalar and matrix operations.
- All ndarray object's dtype is int32 only. This is consistent with our codebase. Also, ndarray boolean and none dtypes are ignored due to its rare daily usages.
- All ndarray object's max dimension is two. This should also be sufficient for daily usages.
- The only Numpy function is numpy.array(), which is treated as the constructor of ndarray class.
- All implementations will base on the original version of fork only. E.g. lists will be interfaced by brute-force for now.

Assumptions above may be further relaxed or restricted depending on project progress.

## 10 examples

- Example below tests the import statement. Each import statement is assumed to follow the format of `import numpy as asname`, where `asname` will be saved in environment for future lookups during ndarray construction and type registration.

```
import numpy as np
```

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

- Example below tests ndarray transpose. The transpose procedure is a method call of transpose(), which will return a new ndarray object with its fields dynamically updated, such as shape and ndarray pointer. We will refrain from allowing `a.T` as it will cause unnecessary conflict with field lookup syntax. The alternative solution of precomputing the transpose of a matrix and save its pointer as a field is also redundant.

```
import numpy as np
a : np = np.array([[1,2,3], [4,5,6]]) 
a.transpose()
``` 

- Example below tests ndarray element-wise operation of plus. This will be treated as a method call of `a.__add__(b)`, which will return a new ndarray object with its fields dynamically updated as well, such as ndarray pointer. 

```
import numpy as np
a : np = np.array([[1,2,3], [4,5,6]]) 
b : np = np.array([[-1,2,-3], [-4,5,-6]]) 
a+b
``` 

- Example below tests ndarray matrix operation of dot product. This will be treated as a method call of `c.dot(b)`, which will return a new ndarray object with its fields dynamically updated as well, such as ndarray pointer. 

```
import numpy as np
c : np = np.array([[1,2], [4,5]]) 
b : np = np.array([[-1,2,-3], [-4,5,-6]]) 
c@b
``` 

- Example below tests ndarray element-wise operation of plus with shape match. This will first access object fields via heap in TS and check if all dimensions are the same. Example below should give an error of shape mismatch between (2,2) and (2,3).

```
import numpy as np
c : np = np.array([[1,2], [4,5]]) 
b : np = np.array([[-1,2,-3], [-4,5,-6]])
c+b
``` 

- Example below tests ndarray matrix operation of dot product with shape match. This will first access object fields via heap in TS and check if the 2nd dimension of 1st object match the 1st dimension of 2nd object. Example below should give an error of dimension mismatch between (2,2) and (3,3).

```
import numpy as np
c : np = np.array([[1,2], [4,5]]) 
d : np = np.array([[-1,2,-3], [-4,5,-6], [7,8,9]])
c@d
``` 

## Testing

Testing will include a mixture of 2 methods. One is writing test cases where program returns will be checked similar to PA3. For ndarray returns, they will be returned in a similar format of list by calling the `a.tolist()` method. Due to the incompleteness nature of builtin implementation, manual tests will also be implemented to check edge cases, running time, etc.

## AST edits

We try our best to minimize AST edits, which will help merge with other branches and generalize this project for future developments. Thus, only a few minor edits will be needed:

- A new type of Stmt will be added as `{ a?: A, tag: "import", package: string, asname: string}`. 

- A new enum of BinOp will be added as `Dot`, which indicates the matrix operation of dot product, i.e. `@`. Scalar operations between scalar and ndarrays will reuse existing enums. 

## Additional files

A few new files will be created to interface Pyodide or NumJS:

- `np_ini.ts`, which includes functions to create new ndarray instances in TS and save fields and element pointers inside the global environment passed by `compiler.ts`. ndarray elemnts will be stored in a shared heap with WASM for future interface with the list team.
- `np_methods.ts`, which wraps ndarray methods inside the importObject. Again, returnee ndarray elemnts will also be stored in a shared heap with WASM.
- `np_runner.ts`, which will coordinate other logistics with Pyodide or NumJs, such as Numpy environment bootstrap.
- `np\`, which contains related code or example files.  

## Edits to existing codebase

A few modifications will be made to existing files:

- `ast.ts`. See the AST edits section.
- `parser.ts`, which includes the following updates:

	- When the stmt `import numpy as asname` is encountered, a new class will be created: asname (e.g. `np`). 
	- np will be the real ndarray class that has fields such as shape and dtype. np class type will also be used for type checking. As other class methods, a list of ndarray's common methods will be added as functions but with empty bodies. 
	- A global list of builtin class names, including np, will be maintained in `parser.ts`, which will help convert `np.array()` to stmt type `construct` as `np()`.
	- Note that np class's name may be overwritten but its content will be not be created twice in a single program to avoid overhead.

- `compiler.ts`, which includes the following updates:

	- When the construct stmt of ndarray is encountered, it will call methods in `np_ini.ts` to directly initialize the instance by passing the global environment.
	- A new case of `print` will be added to allow print formated ndarrays. 
	- For other field lookups and method calls of ndarray objects, compiling procedures will be same as normal objects'.

- `runner.ts`, which includes following updates:

	- A specific function is needed to check if last returnee expression is of type `np` and if so, return a flattened list of ndarray elements, as implemented in Pyodide.

## Value representation and memory layout

No additional value representations are needed.

The heap of global variables or objects will be same as the original one.

A new heap, which is maintained by `np_*.ts`, will be created to store ndarray elements, which may potentially be interfaced with the list team's implementation.

## Milestones

- By March 4, following 2 examples are expected to work:

```
import numpy as np
```

```
import numpy as np
a : np = np.array([1,2])
```  