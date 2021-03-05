Cypress.on('uncaught:exception', (err, runnable) => {
  expect(err.message).to.include("wabt is not defined")
  return false
})

describe("Frontend Tests", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("Simple Test Code Mirror", () => {
    cy.get('div[class="CodeMirror cm-s-neo"]').click().find('textarea', { force: true })
      .type("x:int = 0\nx\n", { force: true })
    cy.get('button[id="run"]').click() 
    cy.get('div[id="output"]').contains('pre', '0')
  });

  it("Simple Test Repl", () => {
    cy.get('textarea[id="next-code"]').type("x:int = 0\nx\n")
    cy.get('div[id="output"]').contains('pre', '0')
  });
});