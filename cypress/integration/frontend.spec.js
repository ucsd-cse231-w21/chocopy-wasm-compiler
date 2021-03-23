Cypress.on("uncaught:exception", (err, runnable) => {
  expect(err.message).to.include("wabt is not defined");
  return false;
});

describe("Frontend Tests", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("Simple Test Code Mirror", () => {
    cy.get('div[class="CodeMirror cm-s-neo CodeMirror-simplescroll"]')
      .click()
      .find("textarea", { force: true })
      .type("x:int = 0\nx\n", { force: true });
    cy.get('button[id="run"]').click();
    cy.get('div[id="output"]').contains("pre", "0");
  });

  it("Simple Test Repl", () => {
    cy.get('textarea[id="next-code"]').type("x:int = 0\nx\n");
    cy.get('div[id="output"]').contains("pre", "0");
  });

  it("Pretty print object", () => {
    cy.get('div[class="CodeMirror cm-s-neo CodeMirror-simplescroll"]')
      .click()
      .find("textarea", { force: true })
      .type("class Rat(object):\na:int=1\n", { force: true })
      .type("{backspace}{backspace}{backspace}{backspace}")
      .type("x : Rat = None\n{backspace}{backspace}x = Rat()\nx", { force: true });
    cy.get('button[id="run"]').click();
    cy.get('button[class="accordion"]').click();
    cy.get('div[id="output"]').contains('b[class="tag"]', "a");
  });

  it("Pretty print nested objects", () => {
    cy.get('div[class="CodeMirror cm-s-neo CodeMirror-simplescroll"]')
      .click()
      .find("textarea", { force: true })
      .type("class Rat(object):\na:int=1\n{backspace}{backspace}b:Rat=None\n", { force: true })
      .type("{backspace}{backspace}{backspace}{backspace}")
      .type("x : Rat = None\n{backspace}{backspace}x = Rat()\nx.b=Rat()\nx.b", { force: true });
    cy.get('button[id="run"]').click();
    cy.get('button[class="accordion"]').click();
    cy.get('div[id="output"]').contains('b[class="tag"]', "a");
  });

  it("Pretty print object with list field", () => {
    cy.get('div[class="CodeMirror cm-s-neo CodeMirror-simplescroll"]')
      .click()
      .find("textarea", { force: true })
      .type("class Rat(object):\na:int=1\n{backspace}{backspace}b:[int]=None\n", { force: true })
      .type("{backspace}{backspace}{backspace}{backspace}")
      .type("x : Rat = None\n{backspace}{backspace}x = Rat()\nx.b=[1,2,3,4]\nx", { force: true });
    cy.get('button[id="run"]').click();
    cy.get('button[class="accordion"]').click({ multiple: true });
    cy.get('div[id="output"]').contains('b[class="tag"]', "3");
  });

  it("Pretty print object with dict field", () => {
    cy.get('div[class="CodeMirror cm-s-neo CodeMirror-simplescroll"]')
      .click()
      .find("textarea", { force: true })
      .type("class Rat(object):\na:int=1\n{backspace}{backspace}b:[int,int]=None\n", {
        force: true,
      })
      .type("{backspace}{backspace}{backspace}{backspace}")
      .type("x : Rat = None\n{backspace}{backspace}x = Rat()\nx.b={{}1:2, 3:4{}}\nx", {
        force: true,
      });
    cy.get('button[id="run"]').click();
    cy.get('button[class="accordion"]').click({ multiple: true });
    cy.get('div[id="output"]').contains('b[class="tag"]', "3");
  });

  it("Pretty print list", () => {
    cy.get('div[class="CodeMirror cm-s-neo CodeMirror-simplescroll"]')
      .click()
      .find("textarea", { force: true })
      .type("a : [int] = None\n{backspace}{backspace}", { force: true })
      .type("a = [1,2,3,4]\na", { force: true });
    cy.get('button[id="run"]').click();
    cy.get('button[class="accordion"]').click();
    cy.get('div[id="output"]').contains('b[class="tag"]', "1");
  });

  it("Pretty print list of lists", () => {
    cy.get('div[class="CodeMirror cm-s-neo CodeMirror-simplescroll"]')
      .click()
      .find("textarea", { force: true })
      .type("a : [[int]] = None\n{backspace}{backspace}", { force: true })
      .type("a = [[1],[2]]\na", { force: true });
    cy.get('button[id="run"]').click();
    cy.get('button[class="accordion"]').click({ multiple: true });
    cy.get('div[id="output"]').contains('b[class="tag"]', "0");
    cy.get('div[id="output"]').contains('p[class="val"]', "1");
    cy.get('div[id="output"]').contains('b[class="tag"]', "1");
    cy.get('div[id="output"]').contains('p[class="val"]', "2");
  });

  it("Pretty print list of objects", () => {
    cy.get('div[class="CodeMirror cm-s-neo CodeMirror-simplescroll"]')
      .click()
      .find("textarea", { force: true })
      .type("class Rat(object):\na:int=1\n", { force: true })
      .type("{backspace}{backspace}{backspace}{backspace}")
      .type("a : [Rat] = None\n{backspace}{backspace}", { force: true })
      .type("a = [Rat(), Rat()]\na", { force: true });
    cy.get('button[id="run"]').click();
    cy.get('button[class="accordion"]').click({ multiple: true });
    cy.get('div[id="output"]').contains('b[class="tag"]', "a");
    cy.get('div[id="output"]').contains('p[class="val"]', "1");
  });

  it("Pretty print list of dicts", () => {
    cy.get('div[class="CodeMirror cm-s-neo CodeMirror-simplescroll"]')
      .click()
      .find("textarea", { force: true })
      .type("a : [[int,int]] = None\n{backspace}{backspace}", { force: true })
      .type("a = [{{}1:2{}},{{}3:4{}}]\na", { force: true });
    cy.get('button[id="run"]').click();
    cy.get('button[class="accordion"]').click({ multiple: true });
    cy.get('div[id="output"]').contains('b[class="tag"]', "1");
    cy.get('div[id="output"]').contains('p[class="val"]', "2");
    cy.get('div[id="output"]').contains('b[class="tag"]', "3");
    cy.get('div[id="output"]').contains('p[class="val"]', "4");
  });

  it("Pretty print dict", () => {
    cy.get('div[class="CodeMirror cm-s-neo CodeMirror-simplescroll"]')
      .click()
      .find("textarea", { force: true })
      .type("a : [int,int] = None\n{backspace}{backspace}", { force: true })
      .type("a = {{}1:2, 3:4{}}\na", { force: true });
    cy.get('button[id="run"]').click();
    cy.get('button[class="accordion"]').click();
    cy.get('div[id="output"]').contains('b[class="tag"]', "1");
  });

  it("Pretty print nested dict", () => {
    cy.get('div[class="CodeMirror cm-s-neo CodeMirror-simplescroll"]')
      .click()
      .find("textarea", { force: true })
      .type("a : [int,[int,bool]] = None\n{backspace}{backspace}", { force: true })
      .type("a = {{}1:{{}2:True{}}, 3:{{}4:False{}} {}}\na", { force: true });
    cy.get('button[id="run"]').click();
    cy.get('button[class="accordion"]').click({ multiple: true });
    cy.get('div[id="output"]').contains('b[class="tag"]', "2");
    cy.get('div[id="output"]').contains('p[class="val"]', "true");
    cy.get('div[id="output"]').contains('b[class="tag"]', "4");
    cy.get('div[id="output"]').contains('p[class="val"]', "false");
  });
  it("Pretty print dict of objects", () => {
    cy.get('div[class="CodeMirror cm-s-neo CodeMirror-simplescroll"]')
      .click()
      .find("textarea", { force: true })
      .type("class Rat(object):\nb:int=1\n", { force: true })
      .type("{backspace}{backspace}{backspace}{backspace}")
      .type("a : [int,Rat] = None\n{backspace}{backspace}", { force: true })
      .type("a = {{} 1:Rat(), 2: Rat() {}}\n", { force: true })
      .type("a[1].b=4\n", { force: true })
      .type("a", { force: true });
    cy.get('button[id="run"]').click();
    cy.get('button[class="accordion"]').click({ multiple: true });
    cy.get('div[id="output"]').contains('b[class="tag"]', "b");
    cy.get('div[id="output"]').contains('p[class="val"]', "4");
    cy.get('div[id="output"]').contains('b[class="tag"]', "b");
    cy.get('div[id="output"]').contains('p[class="val"]', "1");
  });

  it("Pretty print dict of lists", () => {
    cy.get('div[class="CodeMirror cm-s-neo CodeMirror-simplescroll"]')
      .click()
      .find("textarea", { force: true })
      .type("a : [int,[bool]] = None\n{backspace}{backspace}", { force: true })
      .type("a = {{}1:[True, True], 3:[False, False, False, False] {}}\na", { force: true });
    cy.get('button[id="run"]').click();
    cy.get('button[class="accordion"]').click({ multiple: true });
    cy.get('div[id="output"]').contains('b[class="tag"]', "0");
    cy.get('div[id="output"]').contains('p[class="val"]', "true");
    cy.get('div[id="output"]').contains('b[class="tag"]', "3");
    cy.get('div[id="output"]').contains('p[class="val"]', "false");
  });

  it("Theme dropdown", () => {
    cy.get('select[id="themes"]').select("nord");
    cy.get('div[class="CodeMirror CodeMirror-simplescroll cm-s-nord"');
  });

  it("Underline error", () => {
    cy.get('div[class="CodeMirror cm-s-neo CodeMirror-simplescroll"]')
      .click()
      .find("textarea", { force: true })
      .type("x:int = False\n", { force: true });
    cy.get('button[id="run"]').click();
    cy.get('div[class="error-marker"]');
    cy.get("div[class='error-message']").contains("Expected type 'number'; got type 'bool'");
  });

  it("Tooltip on printed output", () => {
    cy.get('div[class="CodeMirror cm-s-neo CodeMirror-simplescroll"]')
      .click()
      .find("textarea", { force: true })
      .type("x:int = 1\n{backspace}{backspace}x", { force: true });
    cy.get('button[id="run"]').click();
    cy.get("pre[title='num']");
  });

  it("Clear REPL button", () => {
    cy.get('div[class="CodeMirror cm-s-neo CodeMirror-simplescroll"]')
      .click()
      .find("textarea", { force: true })
      .type("x:int = 1\n{backspace}{backspace}x", { force: true });
    cy.get('button[id="run"]').click();
    cy.get('button[id="clear"').click();
    cy.get('div[id="output"]').not("pre[title='num']");
  });
  it("Reset button", () => {
    cy.get('div[class="CodeMirror cm-s-neo CodeMirror-simplescroll"]')
      .click()
      .find("textarea", { force: true })
      .type("x:int = 1\n{backspace}{backspace}x", { force: true });
    cy.get('button[id="run"]').click();
    cy.get('button[id="reset"').click();
    cy.get('div[id="output"]').not("pre[title='num']");
  });
});
