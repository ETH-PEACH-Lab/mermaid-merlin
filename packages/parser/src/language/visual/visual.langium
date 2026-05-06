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
   ('rotateRight:' rotateRight=NUMBER NEWLINE*)?
   (uses=UseBlock NEWLINE*)?
   (connects=ConnectSection NEWLINE*)?
   (annotations=Annotation NEWLINE*)?
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
  from=ScopedEndpoint '->' to=ScopedEndpoint ('shape:' shape=EdgeShape)? ('style:' style=EdgeStyle)? ('transition:' transition=EdgeTransition)? ('color:' color=STRING)? (labelProperties=LabelPropertyEdgeConnect)? ('arrowheads:' arrowheads=NUMBER)? ('gap:' gap=NUMBER)? ('alignToIndexedPort:' alignToIndexedPort=Boolean)? ('fromEdgeAnchorOffset:' fromEdgeAnchorOffset=NUMBER)? ('toEdgeAnchorOffset:' toEdgeAnchorOffset=NUMBER)? ('curveHeight:' curveHeight=NUMBER)? ('width:' width=NUMBER)? ('bidirectional:' bidirectional=Boolean)? ('headOnly:' headOnly=Boolean)?
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
   ('stroke.color:' strokeColor=STRING NEWLINE*)? 
   ('stroke.style:' strokeStyle=StrokeStyle NEWLINE*)?
   ('stroke.width:' strokeWidth=NUMBER NEWLINE*)? 
   ('shape:' shape=BlockShape NEWLINE*)?
   (labelProperties=BlockLabelProperty NEWLINE*)?
   (annotations=Annotation NEWLINE*)?
   (nodes=Nodes NEWLINE*)?
   (edges=Edges NEWLINE*)?
   (groups=Groups NEWLINE*)?

;

BlockLabelProperty:
  ('block.fontColor' ':' fontColor=STRING)? ('block.fontFamily' ':' fontFamily=STRING)? ('block.fontSize' ':' fontSize=NUMBER)? ('block.fontWeight' ':' fontWeight=NUMBER)? ('block.fontStyle' ':' fontStyle=FontStyle)?
;

Groups:
   'groups' NEWLINE*
   (items+=Group NEWLINE*)*
;

Group:
   name=ID ':' (members+=ID)* ('layout:' layout=LayoutBlock)? ('anchor.source:' anchorSource=ID)? ('anchor.target:' anchorTarget=ID)? ('gap:' gap=NUMBER)? ('color:' color=STRING)? ('colorBoxAdjustments:' colorBoxAdjustments=ColorBoxAdjustments)? ('stroke.color:' strokeColor=STRING)? ('stroke.style:' strokeStyle=StrokeStyle)? ('stroke.width:' strokeWidth=NUMBER)? (markerProperties=MarkerProperty)? (annotations=Annotation)? ('align:' align=Boolean)? ('shape:' shape=BlockShape NEWLINE*)? (shiftProperties=ShiftProperty)?
;

AnnotationValue:
  'annotation' '.' side=Side ':' value=STRING ('.shift.left' ':' shiftLeft=NUMBER)? ('.shift.right' ':' shiftRight=NUMBER)? ('.shift.bottom' ':' shiftBottom=NUMBER)? ('.shift.top' ':' shiftTop=NUMBER)?

;

Annotation:
  (annotationValues+=AnnotationValue)* 
  (annotationProperties=AnnotationProperty)?
;

AnnotationProperty:
   ('annotation.gap' ':' gap=NUMBER)? ('annotation.fontFamily' ':' fontFamily=STRING)? ('annotation.fontSize' ':' fontSize=NUMBER)? ('annotation.fontWeight' ':' fontWeight=NUMBER)? ('annotation.fontStyle' ':' fontStyle=FontStyle)? ('annotation.fontColor' ':' fontColor=STRING)?
;

LabelProperty:
  ('label.text' ':' labelText=STRING)? ('label.orientation' ':' labelOrientation=LabelOrientation)? ('label.fontColor' ':' labelFontColor=STRING)? ('label.fontFamily' ':' labelFontFamily=STRING)? ('label.fontSize' ':' labelFontSize=NUMBER)? ('label.fontWeight' ':' labelFontWeight=NUMBER)? ('label.fontStyle' ':' labelFontStyle=FontStyle)?
;

SubLabelProperty:
  ('subLabel.text' ':' subLabelText=STRING)? ('subLabel.fontColor' ':' subLabelFontColor=STRING)? ('subLabel.fontFamily' ':' subLabelFontFamily=STRING)? ('subLabel.fontSize' ':' subLabelFontSize=NUMBER)? ('subLabel.fontWeight' ':' subLabelFontWeight=NUMBER)? ('subLabel.fontStyle' ':' subLabelFontStyle=FontStyle)?
;

LabelPropertySpecial:
  ('label.text' ':' labelText=STRING)? ('label.fontColor' ':' labelFontColor=STRING)? ('label.fontFamily' ':' labelFontFamily=STRING)? ('label.fontSize' ':' labelFontSize=NUMBER)? ('label.fontWeight' ':' labelFontWeight=NUMBER)? ('label.fontStyle' ':' labelFontStyle=FontStyle)? 
;

SubLabelPropertySpecial:
  ('subLabel.text' ':' subLabelText=STRING)? ('subLabel.fontColor' ':' subLabelFontColor=STRING)? ('subLabel.fontFamily' ':' subLabelFontFamily=STRING)? ('subLabel.fontSize' ':' subLabelFontSize=NUMBER)? ('subLabel.fontWeight' ':' subLabelFontWeight=NUMBER)? ('subLabel.fontStyle' ':' subLabelFontStyle=FontStyle)?
;

OpLabelProperty:
  ('opLabel.text' ':' opLabelText=STRING)? ('opLabel.fontColor' ':' opLabelFontColor=STRING)? ('opLabel.fontFamily' ':' opLabelFontFamily=STRING)? ('opLabel.fontSize' ':' opLabelFontSize=NUMBER)? ('opLabel.fontWeight' ':' opLabelFontWeight=NUMBER)? ('opLabel.fontStyle' ':' opLabelFontStyle=FontStyle)? ('opLabel.subtext' ':' opLabelSubtext=STRING)?
;

LabelPropertyEdgeConnect:
  ('label.text' ':' labelText=STRING)? ('label.fontColor' ':' labelFontColor=STRING)? ('label.fontFamily' ':' labelFontFamily=STRING)? ('label.fontSize' ':' labelFontSize=NUMBER)? ('label.fontWeight' ':' labelFontWeight=NUMBER)? ('label.fontStyle' ':' labelFontStyle=FontStyle)? ('label.shift.left' ':' labelShiftLeft=NUMBER)? ('label.shift.right' ':' labelShiftRight=NUMBER)? ('label.shift.top' ':' labelShiftTop=NUMBER)? ('label.shift.bottom' ':' labelShiftBottom=NUMBER)?
;

MarkerProperty:
  ('marker.type:' markerType=MarkerType)? ('marker.color:' markerColor=STRING)? ('marker.position:' markerPosition=MarkerPosition)? ('marker.text:' markerLabelText=STRING)? ('marker.fontColor' ':' markerLabelFontColor=STRING)? ('marker.fontFamily' ':' markerLabelFontFamily=STRING)? ('marker.fontSize' ':' markerLabelFontSize=NUMBER)? ('marker.fontWeight' ':' markerLabelFontWeight=NUMBER)? ('marker.fontStyle' ':' markerLabelFontStyle=FontStyle)? ('marker.left' ':' markerLeft=NUMBER)? ('marker.right' ':' markerRight=NUMBER)? ('marker.bottom' ':' markerBottom=NUMBER)? ('marker.top' ':' markerTop=NUMBER)? 
;

ShiftProperty: 
  ('shift.left:' shiftLeft=NUMBER)? ('shift.right:' shiftRight=NUMBER)? ('shift.bottom:' shiftBottom=NUMBER)? ('shift.top:' shiftTop=NUMBER)?
;

Nodes:
   'nodes' NEWLINE*
   (nodes+=Node NEWLINE*)*
;

Node:
   type=NodeTypeDefault name=ID (labelProperties=LabelProperty)? (subLabelProperties=SubLabelProperty)? (opLabelProperties=OpLabelProperty)? (annotations=Annotation)? ('size:' size=SizeDefinition)? ('color:' color=STRING)? ('stroke.color:' strokeColor=STRING)? ('stroke.style:' strokeStyle=StrokeStyle)? ('stroke.width:' strokeWidth=NUMBER)? 
   | type='rect' name=ID (labelProperties=LabelProperty)? (subLabelProperties=SubLabelProperty)? (opLabelProperties=OpLabelProperty)? (annotations=Annotation)? ('size:' size=SizeDefinition)? ('shape:' shape=BlockShape)? ('color:' color=STRING)? ('stroke.color:' strokeColor=STRING)? ('stroke.style:' strokeStyle=StrokeStyle)? ('stroke.width:' strokeWidth=NUMBER)?
   | type='text' name=ID (labelProperties=LabelProperty)? (subLabelProperties=SubLabelProperty)? (opLabelProperties=OpLabelProperty)? (annotations=Annotation)?
   | type='stacked' name=ID 'shape:' shape=CNNShapeSpecial ('kernelSize:' kernelSize=KernelSizeFormat)? ('filterSpacing:' filterSpacing=NUMBER)? (labelProperties=LabelPropertySpecial)? (subLabelProperties=SubLabelPropertySpecial)? (opLabelProperties=OpLabelProperty)? (annotations=Annotation)? ('size:' size=SizeDefinition)? ('color:' color=STRING)? ('stroke.color:' strokeColor=STRING)? ('stroke.style:' strokeStyle=StrokeStyle)? ('stroke.width:' strokeWidth=NUMBER)? ('outerStroke.color:' outerStrokeColor=STRING)? ('outerStroke.style:' outerStrokeStyle=StrokeStyle)? ('outerStroke.width:' outerStrokeWidth=NUMBER)?
   | type='cuboid' name=ID 'shape:' shape=CNNShapeSpecial (labelProperties=LabelPropertySpecial)? (subLabelProperties=SubLabelPropertySpecial)? (opLabelProperties=OpLabelProperty)? (annotations=Annotation)? ('size:' size=SizeDefinition)? ('color:' color=STRING)? ('stroke.color:' strokeColor=STRING)? ('stroke.style:' strokeStyle=StrokeStyle)? ('stroke.width:' strokeWidth=NUMBER)? 
   | type=CNNStageType name=ID 'shape:' shape=CNNShape (labelProperties=LabelPropertySpecial)? (subLabelProperties=SubLabelPropertySpecial)? (opLabelProperties=OpLabelProperty)? (annotations=Annotation)? ('size:' size=SizeDefinition)? ('color:' color=CNNColor)?
   | type='trapezoid' name=ID (labelProperties=LabelProperty)? (subLabelProperties=SubLabelProperty)? (opLabelProperties=OpLabelProperty)? (annotations=Annotation)? ('size:' size=SizeDefinition)? ('color:' color=STRING)? ('stroke.color:' strokeColor=STRING)? ('stroke.style:' strokeStyle=StrokeStyle)? ('stroke.width:' strokeWidth=NUMBER)? ('direction:' direction=TrapezoidDirection)? 
;

Edges:
   'edges' NEWLINE*
   (edges+=Edge NEWLINE*)*
;

Edge:
   name=ID ':' from=Endpoint '->' to=Endpoint (labelProperties=LabelPropertyEdgeConnect)? ('shape:' shape=EdgeShape)? ('style:' style=EdgeStyle)? ('transition:' transition=EdgeTransition)? ('color:' color=STRING)? ('arrowheads:' arrowheads=NUMBER)? ('gap:' gap=NUMBER)? ('alignToIndexedPort:' alignToIndexedPort=Boolean)? ('fromEdgeAnchorOffset:' fromEdgeAnchorOffset=NUMBER)? ('toEdgeAnchorOffset:' toEdgeAnchorOffset=NUMBER)? ('curveHeight:' curveHeight=NUMBER)? ('width:' width=NUMBER)? ('bidirectional:' bidirectional=Boolean)? ('headOnly:' headOnly=Boolean)?
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
  ('edgeWidth:' edgeWidth=NUMBER NEWLINE*)?
  ('edgeColor:' edgeColor=STRING NEWLINE*)?
  ('layerSpacing:' layerSpacing=NUMBER NEWLINE*)?
  ('neuronSpacing:' neuronSpacing=NUMBER NEWLINE*)?
  '@' NEWLINE*
  elements+=NeuralNetworkLayer* NEWLINE*
  '@' NEWLINE*
;

NeuralNetworkLayer:
   layer=Value ('{' 'color:' color=STRING (',' 'stroke:' stroke=STRING)? '}')? nodes+=NeuralNetworkElement* NEWLINE* 
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

LabelOrientationSide returns string:
   'left' | 'right'
;

TrapezoidDirection returns string:
   'left' | 'right' | 'bottom' | 'top'
;


LabelOrientation:
  '(' orientation='vertical' ',' side=LabelOrientationSide ')'
;

ColorBoxAdjustments:
  '(' top=NUMBER ',' right=NUMBER ',' bottom=NUMBER ',' left=NUMBER ')'
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

BlockShape returns string:
  'rounded'
;

LayoutBlock returns string:
  'horizontal' | 'vertical' | 'grid'
;

LayoutDiagram returns string:
  'horizontal' | 'vertical' | 'grid'
;

NodeTypeDefault returns string:
  'circle' | 'arrow'
;

Anchor returns string:
  'left' | 'right' | 'top' | 'bottom'
;

EdgeAnchor returns string:
  'start' | 'mid' | 'end' 
;

EdgeShape returns string:
  'straight' | 'bow' | 'arc'
;

EdgeStyle returns string:
  'solid' | 'dashed' | 'dotted'
;

StrokeStyle returns string:
  'solid' | 'dashed' | 'dotted'
;

EdgeTransition returns string:
  'default' | 'featureMap' | 'flatten' | 'fullyConnected'
;

Boolean returns string: 
  'true' | 'false'
;

Side returns string:
  'left' | 'top' | 'right' | 'bottom'
;

FontStyle returns string:
  'normal' | 'italic' | 'oblique'
;

MarkerPosition returns string: 
  'top' | 'bottom' | 'left' | 'right'
;

MarkerType returns string: 
  'bracket' | 'brace' | 'arrow'
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


  