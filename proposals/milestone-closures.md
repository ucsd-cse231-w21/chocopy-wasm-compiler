# Closures/First Class/Anonymous Functions
Project Milestone
 
By March 4th, we've successfully implemented nested functions (w/o nonlocal declarations) without escape as decribed in our proposal.

##  A description of examples work by March 11
We are going to work on more complex examples of closures where escape analysis is needed. This would correspond to example 3. In addition, we plan to implement lambda expression which is example 4 in the proposal.

## A description of the biggest challenge in implementation
Our biggest challenge is that our escape analysis need to synchronize with other groups' features where we have to track which variables are used.