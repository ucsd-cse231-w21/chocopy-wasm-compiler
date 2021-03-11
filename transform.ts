import {
  Assignable,
  AssignTarget,
  BinOp,
  Class,
  ClosureDef,
  Destructure,
  Expr,
  FunDef,
  Location,
  Program,
  Stmt,
  Type,
} from "./ast";
import { NONE } from "./utils";
import * as compiler from "./compiler";

type CurrentScope =
  | Program<[Type, Location]>
  | FunDef<[Type, Location]>
  | ClosureDef<[Type, Location]>;

function transformComprehension(
  comprehension: Expr<[Type, Location]>,
  current_scope: CurrentScope,
  env: compiler.GlobalEnv
): [CurrentScope, Expr<[Type, Location]>] {
  if (comprehension.tag !== "comprehension") {
    throw new Error("Expected a comprehension expression");
  }

  if (comprehension.field.tag !== "id") {
    throw new Error("Unsupported comprehension expression");
  }

  // To generate a unique name for this temporary comprehension list variable, we use:
  // 1. the number of local vars currently defined in the current scope + number of globals
  //    - this guarantees unique names across different comprehensions in different repl entries
  // 2. the exact location of the comprehension expression
  //    - this guarantees unique names across different comprehensions within the same repl entry

  let num_vars_defined_in_current_scope = `${env.globals.size}_${current_scope.inits.length}`;
  let tmp_lst_name = `$tmp_comp_list_${num_vars_defined_in_current_scope}_${comprehension.a[1].line}_${comprehension.a[1].col}_${comprehension.a[1].length}`;

  // Add this new temporary name to the current scope's list of var inits
  current_scope.inits.push({
    a: [NONE, comprehension.a[1]],
    name: tmp_lst_name,
    type: comprehension.a[0], // { tag: "list", content_type: comprehension.expr.a[0] },
    value: { tag: "none" },
  });

  // tmp_lst_name = []             # set tmp_lst_name to be [] right before this comprehension
  let tmp_lst_set_empty_stmt: Stmt<[Type, Location]> = {
    a: [NONE, comprehension.a[1]],
    tag: "assignment",
    destruct: {
      valueType: comprehension.a,
      isDestructured: false,
      targets: [
        {
          starred: false,
          ignore: false,
          target: { a: comprehension.a, tag: "id", name: tmp_lst_name },
        },
      ],
    },
    value: {
      a: comprehension.a,
      tag: "list-expr",
      contents: [],
    },
  };

  // default if condition is always true
  let if_cond: Expr<[Type, Location]> = {
    a: comprehension.a,
    tag: "literal",
    value: { tag: "bool", value: true },
  };
  // if user specified an if condition, then we use that
  if (comprehension.cond) {
    if_cond = comprehension.cond;
  }

  // if ...:
  //   tmp_lst = tmp_lst + [expr]
  let if_stmt: Stmt<[Type, Location]> = {
    a: comprehension.a,
    tag: "if",
    cond: if_cond,
    thn: [
      // tmp_lst = tmp_lst + [expr]
      {
        a: [NONE, comprehension.a[1]],
        tag: "assignment",
        destruct: {
          valueType: comprehension.a,
          isDestructured: false,
          targets: [
            {
              starred: false,
              ignore: false,
              target: { a: comprehension.a, tag: "id", name: tmp_lst_name },
            },
          ],
        },
        value: {
          a: comprehension.a,
          tag: "binop",
          op: BinOp.Plus,
          left: { a: comprehension.a, tag: "id", name: tmp_lst_name },
          right: { a: comprehension.a, tag: "list-expr", contents: [comprehension.expr] },
        },
      },
    ],
    els: [],
  };

  /*
  for (field) in (iterable):
      if (cond):
          tmp_lst_name = tmp_lst_name + [expr]
   */
  let for_loop: Stmt<[Type, Location]> = {
    tag: "for",
    a: comprehension.a,
    name: comprehension.field.name,
    iterable: comprehension.iter,
    body: [if_stmt],
  };

  let tmp_lst_expr: Expr<[Type, Location]> = { a: comprehension.a, tag: "id", name: tmp_lst_name };

  let block_stmts: Array<Stmt<[Type, Location]>> = [tmp_lst_set_empty_stmt, for_loop];

  let tmp_lst_set_cleanup_stmt: Stmt<[Type, Location]> = {
    a: [NONE, comprehension.a[1]],
    tag: "assignment",
    destruct: {
      valueType: comprehension.a,
      isDestructured: false,
      targets: [
        {
          starred: false,
          ignore: false,
          target: { a: comprehension.a, tag: "id", name: tmp_lst_name },
        },
      ],
    },
    value: {
      a: comprehension.a,
      tag: "literal",
      value: {
        tag: "none",
      },
    },
  };

  // Note: "tmp_lst_name = None" at the end does NOT update the stack's topmost reference to the list in the heap,
  // but will enable gc to garbage collect this tmp list name

  /*
  tmp_lst_name = []
  for (field) in (iterable):
    if (cond):
        tmp_lst_name = tmp_lst_name + [expr]
  tmp_lst_name
  tmp_lst_name = None
 */
  let block: Expr<[Type, Location]> = {
    tag: "comprehension_block",
    a: comprehension.a,
    expr: tmp_lst_expr,
    block: block_stmts,
    cleanup_stmt: tmp_lst_set_cleanup_stmt,
  };
  return [current_scope, block];
}

function transformAssignable(
  assignable: Assignable<[Type, Location]>,
  current_scope: CurrentScope,
  env: compiler.GlobalEnv
): [CurrentScope, Assignable<[Type, Location]>] {
  switch (assignable.tag) {
    case "bracket-lookup":
      [current_scope, assignable.obj] = transformExpr(assignable.obj, current_scope, env);
      [current_scope, assignable.key] = transformExpr(assignable.key, current_scope, env);
      return [current_scope, assignable];

    case "lookup":
      [current_scope, assignable.obj] = transformExpr(assignable.obj, current_scope, env);
      return [current_scope, assignable];

    default:
      return [current_scope, assignable];
  }
}

function transformAssignTarget(
  assignTarget: AssignTarget<[Type, Location]>,
  current_scope:
    | Program<[Type, Location]>
    | FunDef<[Type, Location]>
    | ClosureDef<[Type, Location]>,
  env: compiler.GlobalEnv
): [CurrentScope, AssignTarget<[Type, Location]>] {
  [current_scope, assignTarget.target] = transformAssignable(
    assignTarget.target,
    current_scope,
    env
  );
  return [current_scope, assignTarget];
}

function transformDestructure(
  destructure: Destructure<[Type, Location]>,
  current_scope:
    | Program<[Type, Location]>
    | FunDef<[Type, Location]>
    | ClosureDef<[Type, Location]>,
  env: compiler.GlobalEnv
): [CurrentScope, Destructure<[Type, Location]>] {
  for (let i = 0; i < destructure.targets.length; i++) {
    [current_scope, destructure.targets[i]] = transformAssignTarget(
      destructure.targets[i],
      current_scope,
      env
    );
  }
  return [current_scope, destructure];
}

function transformStmt(
  stmt: Stmt<[Type, Location]>,
  current_scope:
    | Program<[Type, Location]>
    | FunDef<[Type, Location]>
    | ClosureDef<[Type, Location]>,
  env: compiler.GlobalEnv
): [CurrentScope, Stmt<[Type, Location]>] {
  switch (stmt.tag) {
    case "assignment":
      [current_scope, stmt.destruct] = transformDestructure(stmt.destruct, current_scope, env);
      [current_scope, stmt.value] = transformExpr(stmt.value, current_scope, env);
      return [current_scope, stmt];

    case "return":
      [current_scope, stmt.value] = transformExpr(stmt.value, current_scope, env);
      return [current_scope, stmt];

    case "expr":
      [current_scope, stmt.expr] = transformExpr(stmt.expr, current_scope, env);
      return [current_scope, stmt];

    case "if":
      [current_scope, stmt.cond] = transformExpr(stmt.cond, current_scope, env);
      for (let i in stmt.thn) {
        [current_scope, stmt.thn[i]] = transformStmt(stmt.thn[i], current_scope, env);
      }
      for (let i in stmt.els) {
        [current_scope, stmt.els[i]] = transformStmt(stmt.els[i], current_scope, env);
      }
      return [current_scope, stmt];

    case "while":
      [current_scope, stmt.cond] = transformExpr(stmt.cond, current_scope, env);
      for (let i in stmt.body) {
        [current_scope, stmt.body[i]] = transformStmt(stmt.body[i], current_scope, env);
      }
      return [current_scope, stmt];

    case "field-assign":
      [current_scope, stmt.obj] = transformExpr(stmt.obj, current_scope, env);
      [current_scope, stmt.value] = transformExpr(stmt.value, current_scope, env);
      return [current_scope, stmt];

    case "for":
      [current_scope, stmt.iterable] = transformExpr(stmt.iterable, current_scope, env);
      for (let i in stmt.body) {
        [current_scope, stmt.body[i]] = transformStmt(stmt.body[i], current_scope, env);
      }
      return [current_scope, stmt];

    case "bracket-assign":
      [current_scope, stmt.obj] = transformExpr(stmt.obj, current_scope, env);
      [current_scope, stmt.key] = transformExpr(stmt.key, current_scope, env);
      [current_scope, stmt.value] = transformExpr(stmt.value, current_scope, env);
      return [current_scope, stmt];

    default:
      return [current_scope, stmt];
  }
}

function transformExpr(
  expr: Expr<[Type, Location]>,
  current_scope:
    | Program<[Type, Location]>
    | FunDef<[Type, Location]>
    | ClosureDef<[Type, Location]>,
  env: compiler.GlobalEnv
): [CurrentScope, Expr<[Type, Location]>] {
  switch (expr.tag) {
    case "binop":
    case "builtin2":
      [current_scope, expr.left] = transformExpr(expr.left, current_scope, env);
      [current_scope, expr.right] = transformExpr(expr.right, current_scope, env);
      return [current_scope, expr];

    case "uniop":
      [current_scope, expr.expr] = transformExpr(expr.expr, current_scope, env);
      return [current_scope, expr];

    case "comprehension_block":
      for (let i in expr.block) {
        [current_scope, expr.block[i]] = transformStmt(expr.block[i], current_scope, env);
      }
      [current_scope, expr.expr] = transformExpr(expr.expr, current_scope, env);
      [current_scope, expr.cleanup_stmt] = transformStmt(expr.cleanup_stmt, current_scope, env);
      return [current_scope, expr];

    case "bracket-lookup":
      [current_scope, expr.obj] = transformExpr(expr.obj, current_scope, env);
      [current_scope, expr.key] = transformExpr(expr.key, current_scope, env);
      return [current_scope, expr];

    case "builtin1":
      [current_scope, expr.arg] = transformExpr(expr.arg, current_scope, env);
      return [current_scope, expr];

    case "call":
      for (let i in expr.arguments) {
        [current_scope, expr.arguments[i]] = transformExpr(expr.arguments[i], current_scope, env);
      }
      return [current_scope, expr];

    case "lookup":
      [current_scope, expr.obj] = transformExpr(expr.obj, current_scope, env);
      return [current_scope, expr];

    case "method-call":
      [current_scope, expr.obj] = transformExpr(expr.obj, current_scope, env);
      for (let i in expr.arguments) {
        [current_scope, expr.arguments[i]] = transformExpr(expr.arguments[i], current_scope, env);
      }
      return [current_scope, expr];

    case "lambda":
      [current_scope, expr.ret] = transformExpr(expr.ret, current_scope, env);
      return [current_scope, expr];

    case "comprehension":
      return transformComprehension(expr, current_scope, env);

    case "call_expr":
      [current_scope, expr.name] = transformExpr(expr.name, current_scope, env);
      for (let i in expr.arguments) {
        [current_scope, expr.arguments[i]] = transformExpr(expr.arguments[i], current_scope, env);
      }
      return [current_scope, expr];

    case "list-expr":
      for (let i in expr.contents) {
        [current_scope, expr.contents[i]] = transformExpr(expr.contents[i], current_scope, env);
      }
      return [current_scope, expr];

    case "slicing":
      [current_scope, expr.name] = transformExpr(expr.name, current_scope, env);
      [current_scope, expr.start] = transformExpr(expr.start, current_scope, env);
      [current_scope, expr.end] = transformExpr(expr.end, current_scope, env);
      [current_scope, expr.stride] = transformExpr(expr.stride, current_scope, env);
      return [current_scope, expr];

    case "dict":
      for (let i in expr.entries) {
        [current_scope, expr.entries[i][0]] = transformExpr(expr.entries[i][0], current_scope, env);
        [current_scope, expr.entries[i][1]] = transformExpr(expr.entries[i][1], current_scope, env);
      }
      return [current_scope, expr];

    default:
      return [current_scope, expr];
  }
}

function transformClass(
  c: Class<[Type, Location]>,
  current_scope:
    | Program<[Type, Location]>
    | FunDef<[Type, Location]>
    | ClosureDef<[Type, Location]>,
  env: compiler.GlobalEnv
): [CurrentScope, Class<[Type, Location]>] {
  for (let i in c.methods) {
    [current_scope, c.methods[i]] = transformFunDef(c.methods[i], current_scope, env);
  }

  return [current_scope, c];
}

function transformFunDef(
  funcDef: FunDef<[Type, Location]>,
  current_scope:
    | Program<[Type, Location]>
    | FunDef<[Type, Location]>
    | ClosureDef<[Type, Location]>,
  env: compiler.GlobalEnv
): [CurrentScope, FunDef<[Type, Location]>] {
  let original_scope = current_scope;
  current_scope = funcDef;

  for (let i in funcDef.body) {
    [current_scope, funcDef.body[i]] = transformStmt(funcDef.body[i], current_scope, env);
  }

  for (let i in funcDef.funs) {
    [current_scope, funcDef.funs[i]] = transformFunDef(funcDef.funs[i], current_scope, env);
  }

  current_scope = original_scope;
  return [current_scope, funcDef];
}

function transformClosureDef(
  closureDef: ClosureDef<[Type, Location]>,
  current_scope:
    | Program<[Type, Location]>
    | FunDef<[Type, Location]>
    | ClosureDef<[Type, Location]>,
  env: compiler.GlobalEnv
): [CurrentScope, ClosureDef<[Type, Location]>] {
  let original_scope = current_scope;
  current_scope = closureDef;

  for (let i in closureDef.body) {
    [current_scope, closureDef.body[i]] = transformStmt(closureDef.body[i], current_scope, env);
  }

  current_scope = original_scope;
  return [current_scope, closureDef];
}

/**
 * This function takes a typed Program AST and the compiler env (before the current repl entry is run),
 * and uses this to transform the typed Program AST into another typed Program AST.
 *
 * This is useful for traversing the Program AST to add any additional local temp variables directly to the AST as needed.
 * For example, when doing list comprehensions (e.g., [i for i in range(10)]),
 * we use this to define temporary list variables in the appropriate scopes where all the comprehensions are.
 *
 * By following this approach for comprehensions, for example, we were able to not need to worry about how lists are managed with wasm.
 *
 * This will be called in runner.ts, right after "tc(program)" and before compiler.compile(...)
 * @param program   The type-checked program, Program<[Type, Location]>
 * @param env       The compiler env (before this current repl entry is run),   compiler.GlobalEnv
 */
export function transform(
  program: Program<[Type, Location]>,
  env: compiler.GlobalEnv
): Program<[Type, Location]> {
  /*
   * Note on how this is used to support comprehensions:

    * Traverse the entire program
    * Keep track of the current scope we're in as we traverse (ie., Program, FuncDef)
    * Whenever we see a comprehension:
    *   add a new local temp var def to the current scope (with the right list type & a new unique generated name)
    * Transform the comprehension into a block ast (which will use the newly created local temp var def)
    * Replace the comprehension in the program with this block ast
    * At the end, return the transformed program AST
   */

  let current_scope: CurrentScope = program;

  for (let i in program.funs) {
    [current_scope, program.funs[i]] = transformFunDef(program.funs[i], current_scope, env);
  }
  for (let i in program.classes) {
    [current_scope, program.classes[i]] = transformClass(program.classes[i], current_scope, env);
  }
  for (let i in program.stmts) {
    [current_scope, program.stmts[i]] = transformStmt(program.stmts[i], current_scope, env);
  }
  for (let i in program.closures) {
    [current_scope, program.closures[i]] = transformClosureDef(
      program.closures[i],
      current_scope,
      env
    );
  }

  return program;
}
