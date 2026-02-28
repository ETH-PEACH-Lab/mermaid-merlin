grammar VisualDiagram

entry VisualDiagram:
  NEWLINE*
  "visual" NEWLINE*
  ('size:' size=SizeDefinition NEWLINE*)?
  pages+=VisualPage+
;

VisualPage:
  "page" NEWLINE*
  ('layout:' layout=LayoutDefinition NEWLINE*)?
  subDiagrams+=SubDiagram*
;

SubDiagram:
  ArrayDiagram | MatrixDiagram | StackDiagram | GraphDiagram | TreeDiagram | LinkedListDiagram | TextDiagram | NeuralNetworkDiagram
;

NeuralNetworkDiagram:
  diagramType="neural-network" NEWLINE*
  ('position:' position=PositionDefinition NEWLINE*)?
  (orientation=Orientation NEWLINE*)?
  ('title:' diagramTitle=STRING NEWLINE*)?
  (showWeights?="showWeights" NEWLINE*)?
  (showLabels?="showLabels" NEWLINE*)?
  ('positionLabels:' positionLabels=PositionLabels NEWLINE*)?
  (showArrowheads?="showArrowheads" NEWLINE*)?
  (showBias?="showBias" NEWLINE*)?
  '@' NEWLINE*
  elements+=NeuralNetworkLayer* NEWLINE*
  '@' NEWLINE*
;

NeuralNetworkLayer:
   layer=Layer ('{' 'color:' color=STRING '}')? nodes+=NeuralNetworkElement+ NEWLINE* 
;

NeuralNetworkElement:
   value=Value2 ('{' 'color:' color=STRING '}')?
;

ArrayDiagram:
  diagramType="array" NEWLINE*
  ('position:' position=PositionDefinition NEWLINE*)?
  (orientation=Orientation NEWLINE*)?
  ('title:' diagramTitle=STRING NEWLINE*)?
  (showIndex="showIndex" NEWLINE*)?
  '@' NEWLINE*
  elements+=ArrayElement* NEWLINE*
  '@' NEWLINE*
  ('label:' label=STRING NEWLINE*)?
;

ArrayElement:
   value=Value  ('{' 'color:' color=STRING  (',' 'arrow:' arrowLabel=STRING)? (',' 'hidden:' hidden=STRING)? '}')? NEWLINE*
;

MatrixDiagram:
  diagramType="matrix" NEWLINE*
  ('position:' position=PositionDefinition NEWLINE*)?
  ('title:' diagramTitle=STRING NEWLINE*)?
  (showIndex="showIndex" NEWLINE*)?
  '@' NEWLINE*
  rows+=MatrixRow*
  '@' NEWLINE*
  ('label:' label=STRING NEWLINE*)?
;

MatrixRow:
  elements+=MatrixElement (',' elements+=MatrixElement)* NEWLINE
;

MatrixElement:
  value=Value  ('{' 'color:' color=STRING  (',' 'arrow:' arrowLabel=STRING)? (',' 'hidden:' hidden=STRING)? '}')?
;

MatrixAttributes:
    name=ID ':' value=STRING
;

StackDiagram:
  diagramType="stack" NEWLINE*
  ('position:' position=PositionDefinition NEWLINE*)?
  (orientation=Orientation NEWLINE*)?
  ('title:' diagramTitle=STRING NEWLINE*)?
  (showIndex="showIndex" NEWLINE*)?
  'size:' size=NUMBER NEWLINE*
  '@' NEWLINE*
  elements+=StackElement* NEWLINE*
  '@' NEWLINE*
  ('label:' label=STRING NEWLINE*)?
;

StackElement:
  value=Value  ('{' 'color:' color=STRING  (',' 'arrow:' arrowLabel=STRING)? (',' 'hidden:' hidden=STRING)? '}')? NEWLINE*
;

StackAttribute:
    name=ID ':' value=STRING
;

GraphDiagram:
  diagramType="graph" NEWLINE*
  ('position:' position=PositionDefinition NEWLINE*)?
  ('title:' diagramTitle=STRING NEWLINE*)?
  '@' NEWLINE*
  elements+=GraphElement*
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
  type='edge:' '(' start=ID ',' end=ID ')' ('{' 'value:' value=STRING (',' 'color:' color=STRING)? (',' 'arrow:' arrowLabel=STRING)? (',' 'hidden:' hidden=STRING)? '}')? NEWLINE
;

EdgeAttributes:
  name=ID ':' value=Value
;

TreeDiagram:
  diagramType="tree" NEWLINE*
  ('position:' position=PositionDefinition NEWLINE*)?
  ('title:' diagramTitle=STRING NEWLINE*)?
  '@' NEWLINE*
  elements+=TreeElement*
  '@' NEWLINE*
  ('label:' label=STRING NEWLINE*)?
;

// Node identifier that allows keywords like 'left' and 'right'
NodeID returns string:
  ID | 'left' | 'right' | 'above' | 'below'
;

TreeElement:
  TreeNodeDefinition | TreeChildDefinition
;

TreeNodeDefinition:
  type='node:' nodeId=NodeID ('{' 'value:' value=STRING (',' 'color:' color=STRING)? (',' 'arrow:' arrowLabel=STRING)? (',' 'hidden:' hidden=STRING)? '}')? NEWLINE*
;

TreeChildDefinition:
  type='child:' '(' parent=NodeID ',' child=NodeID ')' NEWLINE*
;



LinkedListDiagram:
  diagramType="linkedList" NEWLINE*
  ('position:' position=PositionDefinition NEWLINE*)?
  (double='double' NEWLINE*)?
  ('title:' diagramTitle=STRING NEWLINE*)?
  (showIndex="showIndex" NEWLINE*)?
  '@' NEWLINE*
  elements+=LinkedListElement* NEWLINE*
  '@' NEWLINE*
  ('label:' label=STRING NEWLINE*)?
;

LinkedListElement:
  nodeId=ID  ('{' 'value:'  value=STRING ( ',' 'color:' color=STRING)?  (',' 'arrow:' arrowLabel=STRING)? (',' 'hidden:' hidden=STRING)? '}')? NEWLINE*
;

TextDiagram:
  diagramType="text" NEWLINE*
  ('position:' position=PositionDefinition NEWLINE*)?
  ('placement:' placement=('above' | 'below' | 'left' | 'right') NEWLINE*)?
  ('title:' diagramTitle=STRING NEWLINE*)?
  ('fontSize:' fontSize=NUMBER NEWLINE*)?
  ('color:' color=STRING NEWLINE*)?
  ('fontWeight:' fontWeight=STRING NEWLINE*)?
  ('fontFamily:' fontFamily=STRING NEWLINE*)?
  ('align:' align=STRING NEWLINE*)?
  ('lineSpacing:' lineSpacing=NUMBER NEWLINE*)?
  ('width:' width=NUMBER NEWLINE*)?
  ('height:' height=NUMBER NEWLINE*)?
  elements+=TextElement* NEWLINE*
  ('label:' label=STRING NEWLINE*)?
;

TextElement:
  value=STRING ('{' attributes+=TextElementAttribute (',' attributes+=TextElementAttribute)* '}')? NEWLINE*
;

TextElementAttribute:
  ('fontSize:' fontSize=NUMBER) |
  ('color:' color=STRING) |
  ('fontWeight:' fontWeight=STRING) |
  ('fontFamily:' fontFamily=STRING) |
  ('align:' align=STRING)
;

Value returns string:
  NUMBER | ID | STRING | 'null' | '\\null'
;

Value2 returns string:
  MIXED | NUMBER | ID | STRING | 'null' 
;

Layer returns string:
  NUMBER | ID | STRING
;

SizeDefinition:
  '(' width=NUMBER ',' height=NUMBER ')'
;

LayoutDefinition:
  '(' columns=NUMBER ',' rows=NUMBER ')'
;

PositionDefinition:
  '(' column=PositionRange ',' row=PositionRange ')' | 'previous'
;

PositionRange:
  single=NUMBER | (start=NUMBER '..' end=NUMBER)
;

terminal NUMBER returns number:
/-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?![a-zA-Z_])/;
terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
terminal STRING: /"([^"\\]|\\.)*"/;
terminal MIXED: /(?=[a-zA-Z0-9_]*[a-zA-Z])[a-zA-Z0-9_]+/;
Orientation returns string:
  'TD' | 'LR'
;

PositionLabels returns string:
  'top' | 'bottom'
;

  

fragment TitleAndAccessibilities:
  ((accDescr=ACC_DESCR | accTitle=ACC_TITLE | title=TITLE) EOL)+
;

fragment EOL returns string:
  NEWLINE+ | EOF
;

terminal NEWLINE: /\r?\n/;
terminal ACC_DESCR: /[\t ]*accDescr(?:[\t ]*:([^\n\r]*?(?=%%)|[^\n\r]*)|\s*{([^}]*)})/;
terminal ACC_TITLE: /[\t ]*accTitle[\t ]*:(?:[^\n\r]*?(?=%%)|[^\n\r]*)/;
terminal TITLE: /[\t ]*title(?:[\t ][^\n\r]*?(?=%%)|[\t ][^\n\r]*|)/;

hidden terminal WHITESPACE: /[\t ]+/;
hidden terminal YAML: /---[\t ]*\r?\n(?:[\S\s]*?\r?\n)?---(?:\r?\n|(?!\S))/;
hidden terminal DIRECTIVE: /[\t ]*%%{[\S\s]*?}%%(?:\r?\n|(?!\S))/;
hidden terminal SINGLE_LINE_COMMENT: /[\t ]*%%[^\n\r]*/;


  