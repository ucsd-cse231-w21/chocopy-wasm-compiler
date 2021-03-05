describe("Frontend Tests", () => {
  beforeEach(() => {
    cy.visit("/");
    cy.on('uncaught:exception', (err, runnable) => {
      expect(err.message).to.include("wabt is not defined")
      return false
    })
  
  });

  it("Sample Test", () => {
    console.log("Running sample test")
    cy.get('textarea[id="next-code"]').type("x:int = 0\nx\n")
  });
});

    // cy.get('div[class="CodeMirror cm-s-neo"]')
    // .type("x:int = 0\nx")