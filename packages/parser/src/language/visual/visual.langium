grammar VisualDiagram
import "../common/common"

entry VisualDiagram:
  NEWLINE*
  "visual" NEWLINE*
  ( TitleAndAccessibilities )?
  pages+=VisualPage+
;

VisualPage:
  "page" NEWLINE*
  subDiagrams+=SubDiagram+
;

SubDiagram:
  ArrayDiagram | MatrixDiagram | StackDiagram | GraphDiagram | TreeDiagram | LinkedListDiagram | TextDiagram
;

ArrayDiagram:
  diagramType="array" NEWLINE*
  (orientation=Orientation NEWLINE*)?
  ('title:' title=STRING NEWLINE*)?
  (showIndex="showIndex" NEWLINE*)?
  elements+=ArrayElement* NEWLINE*
  ('label:' label=STRING NEWLINE*)?
;

ArrayElement:
  '@' value=Value  ('{' 'color:' color=STRING (',' 'arrow:' arrowLabel=STRING)? '}')? NEWLINE*
;

MatrixDiagram:
  diagramType="matrix" NEWLINE*
  ('title:' title=STRING NEWLINE*)?
  (showIndex="showIndex" NEWLINE*)?
  '@' NEWLINE
  rows+=MatrixRow+
  '@' NEWLINE*
  ('label:' label=STRING NEWLINE*)?
;

MatrixRow:
  elements+=MatrixElement (',' elements+=MatrixElement)* NEWLINE
;

MatrixElement:
  value=Value ( '{' 'color:' color=STRING '}' )?
;

MatrixAttributes:
    name=ID ':' value=STRING
;

StackDiagram:
  diagramType="stack" NEWLINE*
  (orientation=Orientation NEWLINE*)?
  ('title:' title=STRING NEWLINE*)?
  (showIndex="showIndex" NEWLINE*)?
  'size:' size=INT NEWLINE*
  elements+=StackElement* NEWLINE*
  ('label:' label=STRING NEWLINE*)?
;

StackElement:
  '@' value=Value ('{' 'color:' color=STRING (',' 'arrow:' arrowLabel=STRING)? '}')? NEWLINE*
;

StackAttribute:
    name=ID ':' value=STRING
;

GraphDiagram:
  diagramType="graph" NEWLINE*
  ('title:' title=STRING NEWLINE*)?
  '@' NEWLINE
  elements+=GraphElement+
  '@' NEWLINE*
  ('label:' label=STRING NEWLINE*)?
;

GraphElement:
  NodeDefinition | EdgeDefinition 
;

NodeDefinition:
  type='node:' nodeId=ID ('{' 'value:' value=STRING (',' 'color:' color=STRING)? (',' 'arrow:' arrowLabel=STRING)? (',' 'hidden:' hidden=STRING)?'}')?NEWLINE
;

NodeAttributes:
  name=ID ':' value=Value 
;

EdgeDefinition:
  type='edge:' '(' start=ID ',' end=ID ')' ('{' 'value:' value=STRING (',' 'color:' color=STRING)? '}')? NEWLINE
;

EdgeAttributes:
  name=ID ':' value=Value
;

TreeDiagram:
  diagramType="tree" NEWLINE*
  ('title:' title=STRING NEWLINE*)?
  '@' NEWLINE
  elements+=TreeElement+
  '@' NEWLINE*
  ('label:' label=STRING NEWLINE*)?
;

TreeElement:
  nodeId=ID ':' '[' left=(ID | 'None') ',' right=(ID | 'None')']' ('{' 'value:' value=STRING (',' 'color:' color=STRING)? '}')? NEWLINE*
;

LinkedListDiagram:
  diagramType="linkedList" NEWLINE*
  (double='double' NEWLINE*)?
  ('title:' title=STRING NEWLINE*)?
  (showIndex="showIndex" NEWLINE*)?
  elements+=LinkedListElement* NEWLINE*
  ('label:' label=STRING NEWLINE*)?
;

LinkedListElement:
  '@' nodeId=ID  ('{' 'value:'  value=STRING ( ',' 'color:' color=STRING)? (',' 'arrow:' arrowLabel=STRING)? '}')? NEWLINE*
;

TextDiagram:
  diagramType="text" NEWLINE*
  ('title:' title=STRING NEWLINE*)?
  elements+=TextElement* NEWLINE*
  ('label:' label=STRING NEWLINE*)?
;

TextElement:
  value=STRING NEWLINE*
;

Value returns string:
  INT | ID
;

terminal INT returns number: /0|[1-9][0-9]*/;
terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
terminal STRING: /"([^"\\]|\\.)*"/;
terminal Orientation: "TD" | "LR";