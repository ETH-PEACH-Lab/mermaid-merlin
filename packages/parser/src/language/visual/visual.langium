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
  ArrayDiagram | MatrixDiagram | StackDiagram | GraphDiagram | TreeDiagram | LinkedListDiagram | TextDiagram | NeuralNetworkDiagram | BlockDiagram 
;

BlockDiagram:
  diagramType="architecture" NEWLINE*
  ('position:' position=PositionDefinition NEWLINE*)?
  ('title:' diagramTitle=STRING NEWLINE*)?
  '@' NEWLINE*
  (elements += Block NEWLINE*)*
  (diagram=Diagram NEWLINE*)?
  '@' NEWLINE*
;

Diagram:
   'diagram' NEWLINE*
   ('layout:' layout=LayoutDiagram NEWLINE*)?
   ('gap:' gap=NUMBER NEWLINE*)?
   (uses=UseBlock NEWLINE*)?
   (connects=ConnectSection NEWLINE*)?
;

UseBlock:
   'use:' NEWLINE*
    items+=Use* NEWLINE* 
;

Use:
   name=ID ':' block=ID ('anchor:' anchor=ID)? 
;

ConnectSection:
  'connect:' NEWLINE*
   connections+=Connection* NEWLINE*
;

Connection:
  from=ScopedEndpoint '->' to=ScopedEndpoint ('style:' style=EdgeStyle)? ('transition:' transition=EdgeTransition)? ('color:' color=STRING)? ('label:' label=STRING)? ('arrowheads:' arrowheads=NUMBER)? ('gap:' gap=NUMBER)? 
;

ScopedEndpoint:
    instanceName=ID '.' nodeName=ID '.' anchor=Anchor ('[' portIndex=NUMBER ']')?
  | instanceName=ID '.' edgeName=ID '.' edgeAnchor=EdgeAnchor
;

Block:
   'block' name=ID NEWLINE*
   ('layout:' layout=LayoutBlock NEWLINE*)?
   ('gap:' gap=NUMBER NEWLINE*)?
   ('size:' size=SizeDefinition NEWLINE*)?
   ('color:' color=STRING NEWLINE*)?
   ('style:' style=BlockStyle NEWLINE*)?
   (annotations+=Annotation NEWLINE*)*
   (nodes=Nodes NEWLINE*)?
   (edges=Edges NEWLINE*)?
   (groups=Groups NEWLINE*)?

;

Groups:
   'groups' NEWLINE*
   (items+=Group NEWLINE*)*
;

Group:
   name=ID ':' (members+=ID)* ('layout:' layout=LayoutBlock)? ('anchor:' anchor=ID)? ('gap:' gap=NUMBER)? ('color:' color=STRING)? ('stroke:' stroke=STRING)? ('markerType:' markerType=CNNGroupType)? ('markerLabel:' markerLabel=STRING)? ('markerPosition:' markerPosition=CNNGroupPosition)? (annotations+=Annotation)* ('colorBoxSize:' colorBoxSize=SizeDefinition)?
;

Annotation:
  'annotation' '.' side=Side ':' value=STRING
;

Nodes:
   'nodes' NEWLINE*
   (nodes+=Node NEWLINE*)*
;

Node:
   type=NodeTypeDefault name=ID ('label:' label=STRING)? ('label.orientation:' labelOrientation=LabelOrientation)? ('labelSubtext:' labelSubtext=STRING)? ('opLabel:' opLabel=STRING)? ('opLabelSubtext:' opLabelSubtext=STRING)? (annotations+=Annotation)* ('size:' size=SizeDefinition)? ('style:' style=BlockStyle)? ('color:' color=STRING)? ('stroke:' stroke=STRING)? 
   | type='text' name=ID ('label:' label=STRING)? ('label.orientation:' labelOrientation=LabelOrientation)? ('labelSubtext:' labelSubtext=STRING)? ('opLabel:' opLabel=STRING)? ('opLabelSubtext:' opLabelSubtext=STRING)? (annotations+=Annotation)* ('color:' color=STRING)?
   | type='stacked' name=ID 'shape:' shape=CNNShapeSpecial ('kernelSize:' kernelSize=KernelSizeFormat)? ('label:' label=STRING)? ('labelSubtext:' labelSubtext=STRING)? ('opLabel:' opLabel=STRING)? ('opLabelSubtext:' opLabelSubtext=STRING)? (annotations+=Annotation)* ('size:' size=SizeDefinition)? ('color:' color=STRING)? 
   | type=CNNStageType name=ID 'shape:' shape=CNNShape ('label:' label=STRING)? ('labelSubtext:' labelSubtext=STRING)? ('opLabel:' opLabel=STRING)? ('opLabelSubtext:' opLabelSubtext=STRING)? (annotations+=Annotation)* ('size:' size=SizeDefinition)? ('color:' color=CNNColor)?
;

Edges:
   'edges' NEWLINE*
   (edges+=Edge NEWLINE*)*
;

Edge:
   name=ID ':' from=Endpoint '->' to=Endpoint ('label:' label=STRING)? ('style:' style=EdgeStyle)? ('transition:' transition=EdgeTransition)? ('color:' color=STRING)? ('arrowheads:' arrowheads=NUMBER)? ('gap:' gap=NUMBER)?
;

Endpoint:
    nodeName=ID '.' anchor=Anchor ('[' portIndex=NUMBER ']')?
  | edgeName=ID '.' edgeAnchor=EdgeAnchor
;

CNNColor:
   color=STRING | '{' color+=STRING (',' color+=STRING)* '}'
;

CNNShapeSpecial:
   shape3D=Shape3D 
;

CNNShape:
   shape2D=Shape2D | '{' layers+=CNNNeurons (',' layers+=CNNNeurons)* '}'
;

CNNNeurons: 
   neurons=NUMBER (':' '{' labels+=STRING (',' labels+=STRING)* '}')?
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
   layer=Value ('{' 'color:' color=STRING '}')? nodes+=NeuralNetworkElement* NEWLINE* 
;

NeuralNetworkElement:
   value=Value ('{' 'color:' color=STRING '}')?
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

terminal CNN_SHAPE_3D: /[0-9]+x[0-9]+x[0-9]+/;
terminal CNN_SHAPE_2D: /[0-9]+x[0-9]+/;
terminal NUMBER returns number: /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?/;
terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
terminal STRING: /"([^"\\]|\\.)*"/;
Orientation returns string:
  'TD' | 'LR'
;

PositionLabels returns string:
  'top' | 'bottom'
;

LabelOrientation returns string:
  'horizontal' | 'vertical'
;

BlockStyle returns string:
  'box' | 'rounded'
;

LayoutBlock returns string:
  'horizontal' | 'vertical' | 'grid'
;

LayoutDiagram returns string:
  'horizontal' | 'vertical' | 'grid'
;

NodeTypeDefault returns string:
  'rect' | 'circle'
;

NodeTypeSpecial returns string:
  'text'
;

Anchor returns string:
  'left' | 'right' | 'top' | 'bottom'
;

EdgeAnchor returns string:
  'start' | 'mid' | 'end' 
;

EdgeStyle returns string:
  'straight' | 'bow'
;

EdgeTransition returns string:
  'default' | 'featureMap' | 'flatten' | 'fullyConnected'
;

Side returns string:
  'left' | 'top' | 'right' | 'bottom'
;

CNNGroupPosition returns string: 
  'top' | 'bottom'
;

CNNGroupType returns string: 
  'bracket' | 'brace'
;

KernelSizeFormat returns string: 
  'null' | CNN_SHAPE_2D
;

CNNStageType returns string: 
  'flatten' | 'fullyConnected'
;

Shape3D returns string:
  CNN_SHAPE_3D
;

Shape2D returns string:
  CNN_SHAPE_2D
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


  