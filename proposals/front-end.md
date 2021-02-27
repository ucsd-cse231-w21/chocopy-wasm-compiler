# Front-end Project Proposal

## 10 Representative Examples: 
1. Tooltip on printed output (types): <br>
When the cursor hovers onto a printed output, a tooltip will appear which displays the type of the output. 

2. Media queries for different breakpoints: <br>
Reorganize entries on the webpage based on the size of the tab. 

3. Underlining where in program errors have occurred (after compiling): <br>
The part of the program will have a red underline if it is causing errors. 

4. Autocomplete basic keywords (like return, class, etc.): <br>
Program textarea will autocomplete language keywords when typing. 

5. Autocomplete variables/function definitions (could be combined with 4 but not entirely sure if feasible) <br>
When the user attempts to type variables or functions that have already been defined or initialized, the editor will autocomplete the name. 

6. Highlight syntax errors<br>
If there’s any syntax error in the user’s code, after the user clicks “run”, highlight the lines with errors. Like follows:

7. Change style (theme) of the code editor. <br>
There will be a dropdown menu of available themes for the user to choose from. 

8. Optimize the appearance of the web page<br>
Edit css(sass) file to add titles and hints in the current REPL page. Also change the sizes and layouts of the textboxes and buttons to make them look better.

9. A button for clearing the REPLs and resetting the environment: <br>
One button named “Clear”, which will clear all existing REPL entries and reset the global environment, which has the same functionality as refreshing the tab. 

10. Save repl code and load repl code<br>
Add an option to save the chocopy code in the editor to the local file folder, or load the chocopy code from a local file folder into the editor.

11. Multiple editor tabs: <br>
We are still exploring details regarding whether this is possible to implement. Therefore this is outside of our 10 objectives but we list it here in case we are able to implement in the future. 


## How to add tests for features
Due to the nature of front-end development, while we will definitely attempt to write test cases for our JavaScript, we will probably dedicate more time on QA rather than writing test cases. 

## New AST to Add
We do not expect to add new AST forms while implementing front-end features. 

## Changes to Existing Functions, Datatypes or Files
Existing functions: There will be changes made to files such as `webstart.ts` to implement our tooltip design when the cursor is hovering over a printed output. These changes to files will be mainly to HTML attributes. 

Datatypes: An example of datatype changes is that if we are to implement autocomplete for variable and class names, we will be required to store such information inside the global environment during type checking, which can then be utilized in our autocomplete functions. 


## Memory Layout and Value Representation for New Runtime Values
We do not expect to have any new runtime values from our front-end development. 


## 2 of 10 Examples
We will first commit to having working examples for tooltip for printed output(1) and breakpoints for different sizes(2) by March 4th. 