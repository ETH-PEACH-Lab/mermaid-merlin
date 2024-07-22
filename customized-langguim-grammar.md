# Definition of Languim for visual type

The grammar start with 'visual' or 'slides' or 'slide' which are case-insensitive. then it has several pages.
There is an optional title.
Here is an incomplete example:

```
Visual
title: visualDemo
page
...
page
...
page
...
```

In each the page there are diagrams. Each page may have several diagrams (1 or more). There are 5 types of diagram are supported in the slides:

- array
- matrix
- stack
- tree
- graph

they have different grammar as follows:

- array

array's grammar always start with 'array', which is case-insensitive.
then there is an optional identifier 'LR' or 'TD' to control the array should be horizontal or vertical
then in the new line there is a optional 'title', the valid value for title can consists of any numbers/characters.
then the new line is optional 'showIndex'.
then is each unit of the array, starts with an @. the value of each unit can be number/characters/string. following by a optional {} of the attribute of the array, there are 2 type of attributes (optional): arrow and color. the valid value for buth attribute are numbers/character/string.
then there is optional label: the valid value for label is numbers/character/string

Here is an example:

```
array TD
title: arrayDemo
showIndex
@ 1 {color:red, This is 1}
@ 2 {arrow: This is 2, color:blue}
@ 3
@ 4
label: This is text-label for array
```

- matrix
  matrix's grammar always starts with 'matrix', which is case-insensitive.
  then in the new line there is a optional 'title', the valid value for title can consists of any numbers/characters.
  then there is optional 'showIndex' in the new line
  then there is each unit of the matrix. the matrix start with @ and ends with @. the unit is seperated by ',', and the valid value for each unit is number/character/string. the unit has an optional attribute color. the valid value for color is string consisting of characters and numbers.
  then there is optional label: the valid value for label is numbers/character/string

Here is an example:

```
matrix
title: matrixDemo
showIndex
@
0,0,0 {color: red}
0 {color: OEX550},0
hello
hello, world
@
label: This is text-label for matrix
```

- stack
  stack's grammar always starts with 'stack', which is case-insensitive.
  then there is an optional identifier 'LR' or 'TD' to control the stack should be horizontal or vertical
  then in the new line there is a optional 'title', the valid value for title can consists of any numbers/characters.
  then there is optional 'showIndex' in the new line
  then is a optional size, the valid value for size is number.
  then there is each unit of the stack. the valid for each unit should be numbers/characters/string. The unit has two optional attribute: color and arrow. the valid value for color is string consisting of characters and numbers, the valid value for arrow is string.
  then there is optional label: the valid value for label is numbers/characters/string.

Here is an example:

```
stack TD
title: stackDemo
showIndex
size: 8
@ 1
@ 2
@ 3
@ 4
@ 5 {color: blue, arrow: top}
label: This is text-label for stack
```

- graph
  graph's grammar always strat with 'graph', which is case-insensitive.
  then in the new line there is a optional 'title', the valid value for title can consists of any numbers/characters.
  then there is each unit of the graph. the graph start with @ and ends with @. there are nodes and edges. the valid value for nodes consisting of characters and numbers. there are 2 kinds of edges '-->' and '---' to represent directed edge and undirected edge. For node there are four optional attributes: value, color arrow and hiden. The valid value for each are respectively: number/characters/string(value), string(color), number/characters/string(arrow), True or False(hiden). the edge has 2 optional artributes color and value. The valid value for color is string and for value is number/characters/string.
  There can be node independently but can't be edges independently. The edges can only be between two nodes.
  then there is optional label: the valid value for label is numbers/characters/string.
  Here is an example of granph:

```
graph
title: graphDemo
@
node1{value:1, color:blue, arrow: head, hiden:False} - {color: red, value: 1} -> node2
node2{value:2, color:blue, arrow: head, hiden:False} - {color: red, value: hello} -- node3
node3 --> node1
node3 --- node1
node4
@
label: This is text-label for graph
```

- tree
  tree's grammar always strat with 'tree', which is case-insensitive.
  then there is an optional identifier 'LR' or 'TD' to control the tree should be horizontal or vertical
  then in the new line there is a optional 'title', the valid value for title can consists of any numbers/characters.
  then there is each unit of the tree. the graph start with @ and ends with @. there are nodes and edges. the valid value for nodes consisting of characters and numbers. there are 2 kinds of edges '-->' and '---' to represent directed edge and undirected edge. For node there are four optional attributes: value, color arrow and hiden. The valid value for each are respectively: number/characters/string(value), string(color), number/characters/string(arrow), True or False(hiden). the edge has 2 optional artributes color and value. The valid value for color is string and for value is number/characters/string.
  There can be node independently but can't be edges independently. The edges can only be between two nodes.
  then there is optional label: the valid value for label is numbers/characters/string.
  Here is an example of granph:

```
tree
title: treeDemo
@
father{value:1, color:blue, arrow: father, hiden:False} - {color: red, value: 1} -> leftson1
leftson1{value:2, color:blue, arrow: head, hiden:False} - {color: red, value: hello} -- leftgrandson1
father --> leftson1
leftson1 --- leftgrandson1
mother
@
label: This is text-label for tree
```
