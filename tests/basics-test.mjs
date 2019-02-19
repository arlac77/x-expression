import test from "ava";
import { ExpressionParser } from "../src/grammar";
import { createValue } from "../src/util";

function exp(expression) {
  const parser = new ExpressionParser();

  const ast = parser.parse(expression);
  return ast.value;
}

test("null expansion", async t => {
  t.deepEqual(
    await exp({
      name: "a1"
    }),
    {
      name: "a1"
    }
  );
});

test("os", async t => {
  t.is(await exp("os.arch"), "x64");
  t.truthy(
    ["aix", "darwin", "freebsd", "linux", "win32"].includes(
      await exp("os.platform")
    )
  );
});

test("string concat", async t => t.is(await exp("'x' + 'y'"), "xy"));
test("addition", async t => t.is(await exp("1 + 2"), 3));
test("substraction", async t => t.is(await exp("3 - 2"), 1));
test("multiplication", async t => t.is(await exp("3 * 2"), 6));
test("division", async t => t.is(await exp("8/2"), 4));
test("number", async t => t.is(await exp("number('77')"), 77));

test("greater than false", async t => t.falsy(await exp("1 > 2")));
test("greater than true", async t => t.truthy(await exp("2 > 1")));
test("greater equal false", async t => t.falsy(await exp("1 >= 2")));
test("greater equal true", async t => t.truthy(await exp("2 >= 1")));
test("less than false", async t => t.falsy(await exp("2 < 1")));
test("less than true", async t => t.truthy(await exp("1 < 2")));

test("less equal than false", async t => t.falsy(await exp("2 <= 1")));
test("less equal than true", async t => t.truthy(await exp("1 <= 2")));

test("equal true", async t => t.truthy(await exp("1 == 1")));
test("equal false", async t => t.falsy(await exp("1 == 2")));

test("not equal true", async t => t.truthy(await exp("2 != 1")));
test("not equal false", async t => t.falsy(await exp("2 != 2")));

test("or false", async t => t.falsy(await exp("0 || 0")));
test("or true", async t => t.truthy(await exp("1 || 0")));

test("and false", async t => t.falsy(await exp("1 && 0")));
test("and true", async t => t.truthy(await exp("1 && 1")));

test("or true cobined", async t => t.truthy(await exp("1 > 2 || 1 > 0")));
test("or false cobined", async t => t.falsy(await exp("1 > 2 || 1 < 0")));

test("and false cobined", async t => t.falsy(await exp("1>0 && 0>1")));
test("and true cobined", async t => t.truthy(await exp("1>0 && 2>0")));

test("tenery true 1st.", async t => t.is(await exp("2 > 1 ? 22 : 11"), 22));
test("tenery false 2nd.", async t => t.is(await exp("2 < 1 ? 22 : 11"), 11));
test("tenery combined false 2nd.", async t =>
  t.is(await exp("2 < 1 ? 22+1 : 11+1"), 12));
test("tenery combined true 2nd.", async t =>
  t.is(await exp("2*0 < 1 ? 22+1 : 11+1"), 23));
test("tenery combined true 2nd. with function call", async t =>
  t.is(await exp("'a'=='b' ? 22+1 : substring('abc',1,2)"), "b"));
test("tenery combined true with property access", async t =>
  t.is(await exp("os.platform=='darwin' || os.platform=='linux' ? 1 : 0"), 1));

test("toUpperCase", async t =>
  t.is(await exp("toUpperCase('lower')"), "LOWER"));
test("toLowerCase", async t =>
  t.is(await exp("toLowerCase('UPPER')"), "upper"));
test("substring", async t => t.is(await exp("substring('lower',1,3)"), "ow"));
test("replace", async t =>
  t.is(await exp("replace('lower','ow','12')"), "l12er"));

test("unknown function", async t =>
  t.throwsAsync(async () => exp("  thisFunctionIsUnknown()"), {
    message: '1,2: Unknown function "thisFunctionIsUnknown"'
  }));

test("missing argument", async t =>
  t.throwsAsync(async () => exp("toUpperCase()"), {
    message: '1,0: Missing argument "toUpperCase"'
  }));

test("wrong argument type", async t =>
  t.throwsAsync(async () => exp("toUpperCase(2)"), {
    message: '1,0: Wrong argument type string != number "toUpperCase"'
  }));

test("length (string)", async t => t.is(await exp("length('abc')"), 3));
test("length (array)", async t => t.is(await exp("length([1,2,3])"), 3));

test("first", async t => t.is(await exp("first(1,2,3)"), 1));

test("split", async t =>
  t.deepEqual(await exp("split('1,2,3,4',',')"), ["1", "2", "3", "4"]));

test("substring with expressions", async t =>
  t.is(await exp("substring('lower',1,1+2*1)"), "ow"));

test("encrypt/decrypt", async t =>
  t.is(await exp("decrypt('key',encrypt('key','secret'))"), "secret"));

test("user defined functions", async t =>
  t.is(
    await exp("myFunction()", {
      functions: {
        myFunction: {
          arguments: [],
          apply: () => {
            return createValue(77);
          }
        }
      }
    }),
    77
  ));

test("function promise arg", async t =>
  t.is(
    await exp(
      "substring(string(document('../tests/fixtures/short.txt')),0,4)",
      {
        constants: {
          basedir: __dirname
        }
      }
    ),
    "line"
  ));

test("two promises binop", async t =>
  t.is(
    (await exp(
      "document('../tests/fixtures/short.txt') + document('../tests/fixtures/short2.txt')",
      {
        constants: {
          basedir: __dirname
        }
      }
    )).toString(),
    "line 1\nline 2\n"
  ));

test("left only promise binop", async t =>
  t.is(
    (await exp("document('../tests/fixtures/short.txt') + 'XX'", {
      constants: {
        basedir: __dirname
      }
    })).toString(),
    "line 1\nXX"
  ));

test("array access", async t =>
  t.is(
    await exp("myArray[2-1]", {
      constants: {
        myArray: ["a", "b", "c"]
      }
    }),
    "b"
  ));

test("array access cascade", async t =>
  t.is(
    await exp("myArray[1][2]", {
      constants: {
        myArray: ["a", [0, 0, 4711], "c"]
      }
    }),
    4711
  ));

test("object paths one level", async t =>
  t.is(
    await exp("myObject.att1", {
      constants: {
        myObject: {
          att1: "val1"
        }
      }
    }),
    "val1"
  ));

test("object paths with promise", async t =>
  t.deepEqual(
    await exp("include('../tests/fixtures/with_sub.json').sub", {
      constants: {
        basedir: __dirname,
        c1: "vc1"
      }
    }),
    {
      key: "value in other sub vc1"
    }
  ));

test("object paths several levels", async t =>
  t.deepEqual(
    await exp("myObject.level1.level2", {
      constants: {
        myObject: {
          level1: {
            level2: "val2"
          }
        }
      }
    }),
    "val2"
  ));

test("array literals", async t => t.deepEqual(await exp("[1,2,3]"), [1, 2, 3]));
test("array literals nested", async t =>
  t.deepEqual(await exp("[1,['a'],3]"), [1, ["a"], 3]));

test("access objects first than array", async t =>
  t.deepEqual(
    await exp("myObject.level1.level2[1]", {
      constants: {
        myObject: {
          level1: {
            level2: [1, "val2"]
          }
        }
      }
    }),
    "val2"
  ));

test("access objects first than array #2", async t =>
  t.deepEqual(
    await exp("myObject.level1[1].level2", {
      constants: {
        myObject: {
          level1: [
            {},
            {
              level2: "val2"
            }
          ]
        }
      }
    }),
    "val2"
  ));

test.skip("split with array access", async t =>
  t.is(await exp("split('a:b:c:d',':')[2]"), "c"));

test.skip("condition", async t =>
  t.deepEqual(await exp([{ "if true": { a: 1, b: 2 } }]), [{ a: 1, b: 2 }]));
