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
  ArrayDiagram | MatrixDiagram | StackDiagram | GraphDiagram | TreeDiagram
;

ArrayDiagram:
  diagramType="array" NEWLINE*
  (orientation=Orientation NEWLINE*)?
  (title=STRING NEWLINE*)?
  (showIndex="showIndex" NEWLINE*)?
  elements+=ArrayElement* NEWLINE*
  ('label:' label=STRING NEWLINE*)?
;

ArrayElement:
  '@' value=Value ( '{' arrayAttributes+=ArrayAttribute (',' arrayAttributes+=ArrayAttribute)* '}' )? NEWLINE*
;

ArrayAttribute:
    name=ID ':' value=STRING
;

MatrixDiagram:
  diagramType="matrix" NEWLINE*
  (title=STRING NEWLINE*)?
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
  value=Value ( '{' matrixAttributes=MatrixAttributes '}' )?
;

MatrixAttributes:
    name=ID ':' value=STRING
;

StackDiagram:
  diagramType="stack" NEWLINE*
  (orientation=Orientation NEWLINE*)?
  (title=STRING NEWLINE*)?
  (showIndex="showIndex" NEWLINE*)?
  'size:' size=INT NEWLINE*
  elements+=StackElement* NEWLINE*
  ('label:' label=STRING NEWLINE*)?
;

StackElement:
  '@' value=Value ( '{' stackAttributes+=StackAttribute (',' stackAttributes+=StackAttribute)* '}' )? NEWLINE*
;

StackAttribute:
    name=ID ':' value=STRING
;

GraphDiagram:
  diagramType="graph" NEWLINE*
  (title=STRING NEWLINE*)?
  '@' NEWLINE
  elements+=GraphElement+
  '@' NEWLINE*
  ('label:' label=STRING NEWLINE*)?
;

GraphElement:
  NodeDefinition | EdgeDefinition NEWLINE
;

NodeDefinition:
  'node' nodeId=ID ('{' nodeAttributes=NodeAttributes (',' nodeAttributes+=NodeAttributes)* '}')? 
;

NodeAttributes:
  name=ID ':' value=Value
;

EdgeDefinition:
  'edge' '(' start=ID ',' end=ID ')' ('{' edgeAttributes=EdgeAttributes (',' edgeAttributes+=EdgeAttributes)* '}')? 
;

EdgeAttributes:
  name=ID ':' value=Value
;

TreeDiagram:
  diagramType="tree" NEWLINE*
  (title=STRING NEWLINE*)?
  '@' NEWLINE
  elements+=TreeElement+
  '@' NEWLINE*
  ('label:' label=STRING NEWLINE*)?
;

TreeElement:
  TreeNodeDefinition | TreeEdgeDefinition NEWLINE
;

TreeNodeDefinition:
  'node' nodeId=ID ('{' nodeAttributes=NodeAttributes (',' nodeAttributes+=NodeAttributes)* '}')? 
;

TreeEdgeDefinition:
  'edge' '(' father=ID ',' son=ID ')' ('{' edgeAttributes=EdgeAttributes (',' edgeAttributes+=EdgeAttributes)* '}')? 
;

Value returns string:
  INT | ID
;

terminal INT returns number: /0|[1-9][0-9]*/;
terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
terminal STRING: /"([^"\\]|\\.)*"/;
terminal Orientation: "TD" | "LR";
