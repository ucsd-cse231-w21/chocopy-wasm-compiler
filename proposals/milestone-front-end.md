## Code and Tests demonstrating the working 2 programs. 
The two features we proposed are 1. showing the type of printed output when the cursor is hovering the printed output, which is `webstart.ts`, and 2. The editor and REPL entries will rearrange when the size of the tab is resized,the media query responsible for this feature is in `style.scss`. 

Due to the nature of front-end development, we performed some testing by resizing the tab and manually printing the output rather than writing automated tests. 


## What examples will work by March 11th? 
From our progress so far, we would expect that 9 of our 10 examples from our initial proposal will work by March 11th. The one that will unlikely work are: 

6. Highlight syntax error. 

For example 6: Codemirror does not have such functionality by default, while there is a community project (codemirror.net/1/contrib/python), but the functionality is very minimal, and requires us to integrate a very big amount of code into our Codemirror instance that can look quite messy, therefore we will neglect this task for the final product. 

With that being said, we also decided to add more features to our project such as pretty printing objects with collapsibles, and new buttons to clear REPL entries only. 


## Biggest Challenge that We Faced. 

The biggest challenge for the front-end team was figuring out how to implement autocomplete on variables and functions. We limited ourselves by thinking that the global environment was only populated when clicking “Run”. We could get a working autocomplete if we try compiling the code in the background (without actually running the code) via some heuristic (ie maybe every 3 seconds or something). Then the information we need is in the global environment to have autocomplete functionality. In addition, once we can get those strings for variables/classes/functions, we need to figure out how to prevent the default autocomplete behavior (provided by CodeMirror’s Python mode) from being overwritten by our custom autocomplete function (following CodeMirror’s API). Right now we are attempting an autocomplete after the “Run” button is clicked as a starting point but we have noticed those default autocomplete for Python keywords is no longer showing up when we use our custom autocomplete function.

<br>

# Final Report (March 11th)

## Working Examples from Proposal (9 out of 11): 
1. Tooltip on printed output (types): <br>
When the mouse hover over the printed output string, a tooltip will appear and displays the type of the printed output. 

2. Media queries for different breakpoints: <br>
We add breakpoints to change the layouts and sizes of the editor and interactions panels based on the size of the tab. The two panels are resized to fit the tab and are vertically aligned once the window size is smaller than 840px. The sizes of the editor and interactions panels will get larger if the tab is larger than 800px to provide better user experience when their device has a large screen. The change of the size of the CodeMirror editor is done by overriding the .CodeMirror class.



3. Underlining where in program errors have occurred (after compiling): <br>
We worked with the error-reporting team and implemented this feature. From error-reporting’s error callStack, it contains the line numbers and the error messages of the error. So once we grab the line number and error message, we will use that to highlight the line in the code editor with light red background, and also a lint-like red small rectangular next to the line number, which will show the error message once the cursor hovers over. 


4. Autocomplete basic keywords (like return, class, etc.): <br>
We were able to autocomplete basic keywords and built-in function names. We defined a list of words to autocomplete based on https://docs.python.org/3/library/functions.html and https://www.programiz.com/python-programming/keyword-list.



5. Autocomplete variables/function definitions:<br>
We were also able to autocomplete variable names, class names, top-level functions, and class method names. We used the repl’s environment to grab the respective strings and insert into our list of words that we could potentially autocomplete. Whenever the “enter” button is pressed in the code editor, the compiler compiles the code in the background (doesn’t render errors) such that the autocomplete could have a richer set of words to suggest. We thought this heuristic fits well considering Python uses whitespace indentation and new lines of code are written usually after “enter” is pressed.



6. Change style (theme) of the code editor. <br>
We created a dropdown menu for the user to choose all available editor themes provided by CodeMirror. When a user clicks on the dropdown and chooses the desired theme, the editor will change the theme accordingly. 



7. Optimize the appearance of the web page<br>
We used SCSS to style the web page.  HTML elements are manipulated in webstart.js when objects, lists, dicts are printed, so that we have a better presentation of those structures.  The REPLs/Outputs panel can be hidden if the user chooses to enter a full-screen edit mode in the editor. A hotkey of (Ctrl + R) for running the code is added.


8. A button for clearing the REPLs and resetting the environment: <br>
We created a button on the editor side of the webpage. This removes the REPL outputs, creates a new environment and removes any of text in the editor. This functionality is exactly like pressing the “refresh button” on a browser.




9. Save repl code and load repl code<br>
We added a button to download the chocopy code in the editor with the user selected name to the local file folder and added a button to load the code (with extensions of .txt or .py) from a local file folder into the editor. This enables the users to import and run their code efficiently.


## Neglected Examples from Proposal(2 out of 11)
1. Highlight syntax error. <br>
Codemirror does not have such functionality by default, while there is a community project (codemirror.net/1/contrib/python), but the functionality is very minimal, and most of the implementation does not relate to any compiler knowledge we have studied during this class, therefore we decided to neglect this example. 

2. Multiple editor tabs: <br>
After some review, we think that this functionality is almost identical to having multiple browser tabs open, therefore we have neglected this example for our final implementation. 



## Additional Implemented features not in proposal(2 new features)


1. A button to just remove REPL outputs<br>
We added a button to just the REPL side of the webpage to remove outputs and any REPL executed code. This would be useful if the user has many outputs or has utilized the REPL many times as the user can declutter their workspace.

2. Pretty print objects, lists and dictionaries. <br>
Based on the professor's suggestion, we worked with the list team and dictionary team to implement a feature called pretty printing, which has similar functionality to how Chrome browser developer tool console prints objects. 
When an object, list, or dictionary is being rendered and evaluated, we will have a collapsible which can be expanded to display all the items according to their fields, indices, or keys. 





## Three features that we did not implement. 

1. Changing REPL entry to CodeMirror editor. <br>
Currently we are only using CodeMirror for the main program editor, because we think that CodeMirror does not have a very user-friendly way to reference the editor when in different parts of the program(e.g. Set program editor theme in an onclick event). Our current scheme when referencing the main program editor is to get the list of all CodeMirror editor by using `document.querySelector(“.CodeMirror”)`, but if the REPL entries are also CodeMirror editors, we will need to use querySelectorAll(“.CodeMirror”), which returns a list and it greatly complicates our design that we do not think we have enough time to handle before the project deadline. If given enough time, we will refactor our current design and add necessary implementations to have REPL entries as CodeMirror editor. 

2. General autocomplete drawbacks <br>
Currently, in order to have the right variable names, function names, class names, etc. to suggest during autocomplete, we trigger the compiler to compile the code in the editor whenever the user presses “enter”. This can cause parsing errors or type errors to appear in the browser’s Developer’s Console. This probably would have required creating a separate repl function that did not typecheck, so that we could populate the repl environment with as much information that did compile properly (even if we do not actually execute the compiled code).
In addition, the autocomplete right now is unable to differentiate between all the defined classes such that when the user types a class method on an object, it would only suggest class methods that pertain to that particular class. The autocomplete right now suggests all possible class methods for any object.

3. Load and save REPLs<br>
Currently we only support load and save code to the main editor but do not support load and save REPLs. If this function is demanded by users, then the way to implement this is choosing a data structure to store and exchange the REPL data, like using json or XML. After the user loads the REPL codes into REPL entries, then we can auto-run the program to set the environment as well as print the results.
