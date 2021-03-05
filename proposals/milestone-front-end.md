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
