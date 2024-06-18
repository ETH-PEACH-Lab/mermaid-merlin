grammar VisSlidesDiagram
import "../common/common"

entry VisSlidesDiagram:
  NEWLINE*
  "visslides" NEWLINE*
  ( TitleAndAccessibilities )?
  pages+=VisSlidePage+
;

VisSlidePage:
  "page" NEWLINE*
  subDiagrams+=SubDiagram+
;

SubDiagram:
  ArrayDiagram | MatrixDiagram
;

ArrayDiagram:
  "array" NEWLINE*
  (showIndex="showIndex" NEWLINE*)?
  elements+=ArrayElement* NEWLINE*
;

ArrayElement:
  '@' value=Value (':' arrow='arrow' ('::' context=ID)?)? ( '&' color=Color '&' )? NEWLINE
;

MatrixDiagram:
  "matrix" NEWLINE*
  '@' NEWLINE
  rows+=MatrixRow+
  '@' NEWLINE*
;

MatrixRow:
  elements+=MatrixElement (',' elements+=MatrixElement)* NEWLINE
;

MatrixElement:
  value=Value ( '{' color=Color '}' )?
;

Value returns string:
  INT | ID
;

Color returns string:
  'blue' | 'red' | 'green'
;

terminal INT returns number: /0|[1-9][0-9]*/;
terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
